"""Routes requests to the appropriate model provider."""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone
import httpx

from core.provider_settings import get_effective_model, load_provider_settings
from core import provider_tests as provider_tests_module
from .base import sanitize_base_url, sanitize_error_message
from .lmstudio_provider import LMStudioProvider
from .ollama_provider import OllamaProvider
from .openai_compatible_provider import OpenAICompatibleProvider


DEFAULT_TEST_PROMPT = "اكتب جملة عربية قصيرة تؤكد أن مزود النموذج جاهز للاستخدام."
PROVIDER_DISPLAY_NAMES_AR = {
    "ollama": "أولاما",
    "lmstudio": "إل إم ستوديو",
    "openai_compatible": "متوافق مع OpenAI",
}
READINESS_STATUS_OK = "online"
DEFAULT_ACTION_NONE = "لا يوجد إجراء مطلوب الآن."


def save_provider_test_result(provider_id: str, record: dict):
    return provider_tests_module.save_provider_test_result(provider_id, record)


def append_diagnostics_event(event: dict):
    return provider_tests_module.append_diagnostics_event(event)


def load_provider_test_history():
    return provider_tests_module.load_provider_test_history()


def load_diagnostics_history(limit: int | None = None):
    if limit is None:
        return provider_tests_module.load_diagnostics_history()
    return provider_tests_module.load_diagnostics_history(limit)


def _warning_contains(warnings: list[str], fragment: str) -> bool:
    if not fragment:
        return False
    return any(fragment in (warning or "") for warning in warnings)


def _lmstudio_guidance(status: str, model: str) -> tuple[str, str, dict | None]:
    base_steps = [
        "افتح تطبيق LM Studio على الحاسوب المحلي.",
        "انتقل إلى Local Server ثم اضغط Start.",
        "تأكد أن العنوان الظاهر هو http://127.0.0.1:1234/v1.",
        "ارجع إلى OmniAgent واضغط \"اختبار المزود\".",
    ]
    if status == "missing_server":
        guidance = {
            "title": "تشغيل خادم LM Studio",
            "steps": base_steps,
            "command_hint": "Local Server → Start (http://127.0.0.1:1234/v1)",
            "severity": "error",
            "provider": "lmstudio",
        }
        return (
            "خادم LM Studio غير متصل.",
            "افتح LM Studio ثم شغّل Local Server قبل إعادة المحاولة.",
            guidance,
        )
    if status == "no_model_loaded":
        guidance = {
            "title": "تحميل نموذج داخل LM Studio",
            "steps": [
                "افتح LM Studio واختر النموذج المطلوب من تبويب Models.",
                "إذا لم يكن النموذج مثبتًا، قم بتحميله من داخل LM Studio.",
                "بعد تحميل النموذج، شغّل Local Server ثم اختبر المزود هنا.",
            ],
            "severity": "warning",
            "provider": "lmstudio",
        }
        return (
            "لا يوجد نموذج محمّل في LM Studio الآن.",
            "اختر نموذجًا من LM Studio ثم اضغط تحديث الحالة هنا.",
            guidance,
        )
    if status == "bad_model":
        guidance = {
            "title": "تحديث اسم النموذج في LM Studio",
            "steps": [
                f"النموذج {model or 'المطلوب'} غير متاح حاليًا داخل LM Studio.",
                "اختر نموذجًا مطابقًا داخل LM Studio أو حدّث اسم النموذج في الإعدادات.",
                "شغّل Local Server ثم اضغط \"اختبار المزود\"." ,
            ],
            "severity": "warning",
            "provider": "lmstudio",
        }
        return (
            f"النموذج {model or ''} غير متاح في LM Studio.",
            "حمّل النموذج الصحيح داخل LM Studio أو حدّث النموذج الافتراضي في الإعدادات.",
            guidance,
        )
    return ("LM Studio متصل وجاهز.", DEFAULT_ACTION_NONE, None)


def _ollama_guidance(status: str, model: str) -> tuple[str, str, dict | None]:
    if status == "missing_server":
        guidance = {
            "title": "تشغيل خدمة Ollama",
            "steps": [
                "افتح نافذة الأوامر أو PowerShell على جهازك.",
                "نفّذ الأمر \"ollama serve\" واتركه يعمل في الخلفية.",
                "بعد التأكد من تشغيل الخدمة على http://127.0.0.1:11434 اضغط \"اختبار المزود\".",
            ],
            "command_hint": "ollama serve",
            "severity": "error",
            "provider": "ollama",
        }
        return (
            "لا يمكن الوصول إلى خادم Ollama المحلي.",
            "تأكد أن خدمة Ollama تعمل محليًا (ollama serve) ثم اضغط تحديث.",
            guidance,
        )
    if status == "no_model_loaded":
        guidance = {
            "title": "تثبيت نموذج داخل Ollama",
            "steps": [
                "شغّل \"ollama list\" للتأكد من وجود نماذج مثبتة.",
                "ثبّت نموذجًا مناسبًا عبر الأمر أدناه.",
                "بعد اكتمال التحميل، حدّث اختيار النموذج واضغط \"اختبار المزود\".",
            ],
            "command_hint": "ollama pull llama3.2",
            "severity": "warning",
            "provider": "ollama",
        }
        return (
            "خادم Ollama يعمل ولكن لا توجد نماذج مثبتة.",
            "ثبّت نموذجًا عبر: ollama pull llama3.2 (أو اسم النموذج المطلوب).",
            guidance,
        )
    if status == "bad_model":
        guidance = {
            "title": "تحميل النموذج المحدد في Ollama",
            "steps": [
                f"النموذج {model or 'المطلوب'} غير موجود حاليًا داخل Ollama.",
                "شغّل أمر التثبيت أدناه أو اختر نموذجًا آخر مثبتًا.",
                "بعد ذلك اختبر المزود مرة أخرى للتأكد من الجاهزية.",
            ],
            "command_hint": f"ollama pull {model or '<model>'}",
            "severity": "warning",
            "provider": "ollama",
        }
        return (
            f"النموذج {model or ''} غير موجود ضمن نماذج Ollama المثبتة.",
            f"ثبّت النموذج عبر: ollama pull {model or '<model>'} ثم حدّث الحالة.",
            guidance,
        )
    return ("Ollama متصل وجاهز محليًا.", DEFAULT_ACTION_NONE, None)


def _openai_guidance(status: str, env_name: str | None) -> tuple[str, str, dict | None]:
    env_label = env_name or "OPENAI_COMPATIBLE_API_KEY"
    if status == "misconfigured":
        return (
            "إعدادات مزود OpenAI-compatible غير مكتملة.",
            "أدخل العنوان واسم النموذج في الإعدادات ثم احفظ مرة أخرى.",
            None,
        )
    if status == "bad_credentials":
        return (
            "لم يتم العثور على مفتاح API صالح.",
            f"ضع المفتاح داخل متغير البيئة {env_label} ثم أعد تشغيل التطبيق أو حدث الحالة.",
            None,
        )
    if status == "missing_server":
        return (
            "تعذر الوصول إلى خادم OpenAI-compatible الحالي.",
            "تحقق من صحة العنوان أو الاتصال بالإنترنت ثم أعد الاختبار.",
            None,
        )
    return ("مزود OpenAI-compatible متصل وجاهز.", DEFAULT_ACTION_NONE, None)


def _diagnostic_for_provider(provider_id: str, provider, health: dict) -> dict:
    warnings = list(health.get("warnings") or [])
    health_status = health.get("health_status") or "unknown"
    models = list(health.get("models") or [])
    base_url = sanitize_base_url(provider.base_url)
    default_model = (provider.default_model or "").strip()

    status = "unknown"
    message = ""
    action = DEFAULT_ACTION_NONE
    is_ready = False

    if not base_url:
        status = "misconfigured"
    elif provider_id == "openai_compatible" and getattr(provider, "require_api_key", False) and not provider.api_key:
        status = "bad_credentials"
    elif not default_model:
        status = "no_model_loaded"
    elif health_status == "offline":
        status = "missing_server"
    elif health_status == "unconfigured":
        status = "misconfigured"
    elif health_status == "online":
        status = READINESS_STATUS_OK
    else:
        status = health_status

    if status == READINESS_STATUS_OK:
        if _warning_contains(warnings, "لا توجد نماذج"):
            status = "no_model_loaded"
        elif _warning_contains(warnings, "غير موجود"):
            status = "bad_model"
        else:
            is_ready = True

    guidance_metadata = None
    if provider_id == "lmstudio":
        message, action, guidance_metadata = _lmstudio_guidance(status, default_model)
    elif provider_id == "ollama":
        message, action, guidance_metadata = _ollama_guidance(status, default_model)
    else:
        message, action, guidance_metadata = _openai_guidance(status, getattr(provider, "api_key_env", None))

    return {
        "status": status,
        "message": message,
        "action": action,
        "warnings": warnings,
        "models": models,
        "is_ready": is_ready,
        "guidance": guidance_metadata,
    }


def _build_provider_map(provider_settings: dict | None = None) -> dict:
    current_settings = provider_settings or load_provider_settings()
    return {
        "ollama": OllamaProvider(
            provider_id="ollama",
            label="Ollama",
            base_url=current_settings["ollama_base_url"],
            default_model=get_effective_model(current_settings, "ollama"),
            timeout_seconds=current_settings["request_timeout_seconds"],
        ),
        "lmstudio": LMStudioProvider(
            base_url=current_settings["lmstudio_base_url"],
            default_model=get_effective_model(current_settings, "lmstudio"),
            timeout_seconds=current_settings["request_timeout_seconds"],
        ),
        "openai_compatible": OpenAICompatibleProvider(
            provider_id="openai_compatible",
            label="OpenAI Compatible",
            base_url=current_settings["openai_compatible_base_url"],
            default_model=get_effective_model(current_settings, "openai_compatible"),
            timeout_seconds=current_settings["request_timeout_seconds"],
            api_key_env=current_settings["openai_compatible_api_key_env"],
            require_api_key=True,
        ),
    }


def get_provider(name: str, provider_settings: dict | None = None):
    """Return the provider instance for the given name, or None if not found."""
    return _build_provider_map(provider_settings).get(name)


def _build_provider_summary(provider_id: str, provider, health: dict, provider_settings: dict, last_tests: dict | None = None) -> dict:
    diagnostics = _diagnostic_for_provider(provider_id, provider, health)
    models = diagnostics["models"]
    api_key_env = getattr(provider, "api_key_env", None)
    api_key_value = getattr(provider, "api_key", "")
    display_name = PROVIDER_DISPLAY_NAMES_AR.get(provider_id, provider.label)
    base_url = sanitize_base_url(provider.base_url)
    last_test = (last_tests or {}).get(provider_id, {})

    return {
        "id": provider_id,
        "label": provider.label,
        "display_name": display_name,
        "display_name_ar": display_name,
        "status": health["health_status"],
        "diagnostic_status": diagnostics["status"],
        "diagnostic_message": diagnostics["message"],
        "diagnostic_action": diagnostics["action"],
        "configured": provider.configured,
        "enabled": bool(provider.base_url),
        "base_url": base_url,
        "selected_model": provider.default_model,
        "health_status": health["health_status"],
        "warnings": diagnostics["warnings"],
        "models": models,
        "discovered_models": models,
        "is_active": provider_id == provider_settings["active_provider"],
        "api_key_env": api_key_env,
        "api_key_configured": bool(api_key_value) if api_key_env else None,
        "is_ready": diagnostics["is_ready"],
        "guidance": diagnostics.get("guidance"),
        "last_test_at": last_test.get("tested_at"),
        "last_test_success": last_test.get("success"),
        "last_test_status": last_test.get("status"),
        "last_test_message": last_test.get("message") or last_test.get("diagnostic_message"),
        "last_test_latency_ms": last_test.get("latency_ms"),
    }


async def get_provider_summaries() -> dict:
    provider_settings = load_provider_settings()
    provider_map = _build_provider_map(provider_settings)
    last_tests = load_provider_test_history()
    providers = await asyncio.gather(
        *[
            _collect_provider_summary(provider_id, provider, provider_settings, last_tests)
            for provider_id, provider in provider_map.items()
        ]
    )

    return {"active_provider": provider_settings["active_provider"], "active_model": provider_settings["active_model"], "providers": providers}


async def _collect_provider_summary(provider_id: str, provider, provider_settings: dict, last_tests: dict | None = None) -> dict:
    try:
        health = await provider.health_check()
    except Exception:
        health = {
            "health_status": "error",
            "warnings": [f"تعذر فحص حالة مزود {provider.label}."],
            "models": [],
        }

    if health["health_status"] == "online" and not isinstance(health.get("models"), list):
        try:
            health["models"] = await provider.list_models()
        except Exception:
            health["warnings"] = [
                *health.get("warnings", []),
                f"تعذر تحميل قائمة النماذج من مزود {provider.label}.",
            ]
            health["models"] = []

    return _build_provider_summary(provider_id, provider, health, provider_settings, last_tests)


async def run_prompt(prompt: str, provider_name: str | None = None, model_name: str | None = None, provider_settings: dict | None = None) -> dict:
    provider_settings = provider_settings or load_provider_settings()
    selected_provider_name = provider_name or provider_settings["active_provider"]
    provider = get_provider(selected_provider_name, provider_settings)

    if provider is None:
        return {
            "provider": selected_provider_name,
            "model": model_name or "unknown",
            "output_text": "",
            "output_preview": "",
            "latency_ms": 0,
            "status": "error",
            "warnings": [f"مزود النموذج '{selected_provider_name}' غير معروف."],
            "raw_error": "Unknown provider.",
            "safe_error_message": "Unknown provider.",
        }

    try:
        result = await provider.generate(prompt, model_name)
    except Exception as exc:
        return {
            "provider": selected_provider_name,
            "model": model_name or provider.resolve_model(),
            "output_text": "",
            "output_preview": "",
            "latency_ms": 0,
            "status": "timeout" if isinstance(exc, httpx.TimeoutException) else "error",
            "warnings": [provider._timeout_warning()] if isinstance(exc, httpx.TimeoutException) else [provider._connection_warning()],
            "raw_error": sanitize_error_message(str(exc)),
            "safe_error_message": sanitize_error_message(str(exc)),
        }

    return result.to_dict()


async def test_provider(provider_name: str | None = None, model_name: str | None = None, test_prompt: str | None = None) -> dict:
    provider_settings = load_provider_settings()
    resolved_provider = provider_name or provider_settings["active_provider"]
    provider = get_provider(resolved_provider, provider_settings)
    result = await run_prompt(
        prompt=(test_prompt or DEFAULT_TEST_PROMPT).strip(),
        provider_name=resolved_provider,
        model_name=model_name,
        provider_settings=provider_settings,
    )
    output_text = (result.get("output_text") or "").strip()
    result["output_preview"] = output_text[:500]
    tested_at = datetime.now(timezone.utc).isoformat()
    diagnostic_status = "online" if result.get("status") == "ok" else (result.get("status") or "unknown")
    safe_message = result.get("safe_error_message") or output_text[:160]
    last_record = {
        "provider": resolved_provider,
        "provider_label": PROVIDER_DISPLAY_NAMES_AR.get(resolved_provider, resolved_provider),
        "tested_model": result.get("model") or (provider.resolve_model() if provider else model_name) or "",
        "diagnostic_status": diagnostic_status,
        "diagnostic_message": safe_message,
        "status": result.get("status"),
        "success": result.get("status") == "ok",
        "message": safe_message,
        "latency_ms": result.get("latency_ms"),
        "tested_at": tested_at,
        "base_url": sanitize_base_url(provider.base_url) if provider else "",
    }
    save_provider_test_result(resolved_provider, last_record)
    append_diagnostics_event(
        {
            "provider": resolved_provider,
            "provider_label": PROVIDER_DISPLAY_NAMES_AR.get(resolved_provider, resolved_provider),
            "diagnostic_status": diagnostic_status,
            "success": last_record["success"],
            "message": safe_message,
            "latency_ms": result.get("latency_ms"),
            "tested_at": tested_at,
            "guidance_provider": resolved_provider if diagnostic_status != "online" else None,
        }
    )
    result["tested_at"] = tested_at
    return result


def _build_checklist_rows(provider_settings: dict, active_summary: dict | None) -> list[dict]:
    checklist: list[dict] = []
    backend_ok = True
    checklist.append({"id": "backend", "label_key": "backendHealthy", "status": "pass" if backend_ok else "fail"})

    active_provider_id = provider_settings.get("active_provider") or ""
    has_active_provider = bool(active_provider_id)
    checklist.append({"id": "active_provider", "label_key": "activeProvider", "status": "pass" if has_active_provider else "fail"})

    base_configured = bool((active_summary or {}).get("base_url"))
    checklist.append({"id": "base_url", "label_key": "baseUrlConfigured", "status": "pass" if base_configured else "fail"})

    server_reachable = (active_summary or {}).get("diagnostic_status") not in {"missing_server", "offline", "error"}
    checklist.append({"id": "server", "label_key": "serverReachable", "status": "pass" if server_reachable else "fail"})

    model_configured = bool((active_summary or {}).get("selected_model"))
    checklist.append({"id": "model", "label_key": "modelConfigured", "status": "pass" if model_configured else "fail"})

    last_test_exists = bool((active_summary or {}).get("last_test_at"))
    checklist.append({"id": "last_test_exists", "label_key": "lastTestRecorded", "status": "pass" if last_test_exists else "fail"})

    last_test_success = bool((active_summary or {}).get("last_test_success"))
    checklist.append({"id": "last_test_success", "label_key": "lastTestPassed", "status": "pass" if last_test_success else "fail"})

    if active_summary and active_summary.get("guidance") and (active_summary.get("diagnostic_status") not in {"online", READINESS_STATUS_OK}):
        checklist.append({"id": "guidance", "label_key": "guidanceAction", "status": "warn"})

    return checklist


async def get_provider_diagnostics_payload() -> dict:
    summaries = await get_provider_summaries()
    providers = summaries.get("providers", [])
    active_provider_id = summaries.get("active_provider")
    active_summary = next((provider for provider in providers if provider.get("id") == active_provider_id), providers[0] if providers else None)
    checklist = _build_checklist_rows(summaries, active_summary)
    history = load_diagnostics_history()
    return {
        "active_provider": active_provider_id,
        "checklist": checklist,
        "history": history,
        "providers": providers,
    }
