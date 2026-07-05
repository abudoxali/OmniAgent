"""Controlled agent execution endpoint."""
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field, model_validator

from agent.planner import detect_unsafe_request
from agent.prompts import build_prompt
from config import settings
from context_engine.context_builder import build_context
from model_router.router import run_prompt

router = APIRouter()

SUPPORTED_SELECTED_FILE_EXTENSIONS = {".txt", ".md", ".json", ".csv"}
MAX_SELECTED_INPUT_CHARS = 64_000
MAX_SELECTED_INPUT_BYTES = 64 * 1024

SELECTED_INPUT_ACTION_PROMPTS = {
    "summarize": "لخص النص التالي بالعربية مع التركيز على أهم الأفكار والنتائج العملية.",
    "rewrite": "أعد صياغة النص التالي بلغة عربية واضحة مع المحافظة على المعنى الأصلي والخلفية.",
    "classify": "حلّل النص التالي وصِف مجاله أو فئته الرئيسية وسبب هذا التصنيف بلغة مختصرة.",
    "extract": "استخرج أهم النقاط أو العناصر التنفيذية من النص التالي وضعها في قائمة نقطية قصيرة.",
}


class AgentRunRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    instruction: str = Field(min_length=1, max_length=12000)
    mode: Literal["custom", "summarize", "rewrite", "explain", "translate", "generate_reply"] = "custom"
    include_clipboard_context: bool = True
    include_selected_text_context: bool = False
    include_active_window_context: bool = True
    provider: str | None = None
    model: str | None = None
    prompt: str | None = None

    @model_validator(mode="before")
    @classmethod
    def support_legacy_prompt(cls, values):
        if isinstance(values, dict):
            if not values.get("instruction") and values.get("prompt"):
                values["instruction"] = values["prompt"]
        return values


@router.post("/agent/run")
async def run_agent(request: AgentRunRequest):
    """Run a safe text-only AI request using the selected provider."""
    refusal_reason = detect_unsafe_request(request.instruction)
    if refusal_reason:
        return {
            "provider": "safety-layer",
            "model": "preview-only",
            "output_text": (
                f"أستطيع مساعدتك في شرح الطلب أو إعادة صياغته، لكن لا يمكنني تنفيذه في المرحلة 2A. {refusal_reason}"
            ),
            "latency_ms": 0,
            "status": "refused",
            "warnings": [refusal_reason],
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    context = build_context()
    prompt, prompt_warnings = build_prompt(
        instruction=request.instruction,
        mode=request.mode,
        context=context,
        include_clipboard_context=request.include_clipboard_context,
        include_selected_text_context=request.include_selected_text_context,
        include_active_window_context=request.include_active_window_context,
        max_prompt_chars=settings.max_prompt_chars,
        max_context_chars=settings.max_context_chars,
    )

    result = await run_prompt(
        prompt=prompt,
        provider_name=request.provider,
        model_name=request.model,
    )
    result["warnings"] = prompt_warnings + result.get("warnings", [])
    result["mode"] = request.mode
    result["timestamp"] = datetime.now(timezone.utc).isoformat()
    return result


class SelectedInputRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    action: Literal["summarize", "rewrite", "classify", "extract"]
    input_text: str = Field(min_length=1, max_length=MAX_SELECTED_INPUT_CHARS + 2000)
    source_type: Literal["paste", "file"]
    file_name: str | None = Field(default=None, max_length=200)
    file_extension: str | None = Field(default=None, max_length=20)
    file_size: int | None = Field(default=None, ge=0, le=MAX_SELECTED_INPUT_BYTES)
    provider: str | None = None
    model: str | None = None

    @model_validator(mode="before")
    @classmethod
    def validate_file_payload(cls, values):
        if not isinstance(values, dict):
            return values
        source = values.get("source_type")
        if source == "file":
            extension = str(values.get("file_extension") or values.get("file_ext") or "").lower()
            name = str(values.get("file_name") or "")
            size = values.get("file_size")
            if not name:
                raise ValueError("يجب توفير اسم الملف عند اختيار مصدر ملف.")
            if not extension:
                extension = Path(name).suffix.lower()
                values["file_extension"] = extension
            if extension not in SUPPORTED_SELECTED_FILE_EXTENSIONS:
                raise ValueError("الصيغة المختارة غير مدعومة حاليًا.")
            if size is None:
                raise ValueError("يجب توفير حجم الملف عند اختيار مصدر ملف.")
            if size > MAX_SELECTED_INPUT_BYTES:
                raise ValueError("يتجاوز الملف الحد المسموح به (64 كيلوبايت).")
        else:
            # Remove file metadata when source is paste to avoid storing stale values.
            values.pop("file_name", None)
            values.pop("file_extension", None)
            values.pop("file_size", None)
        return values


def _sanitize_file_name(name: str | None) -> str | None:
    if not name:
        return None
    return Path(name).name[:200]


@router.post("/agent/selected-input")
async def run_selected_input(request: SelectedInputRequest):
    """Run summarize/rewrite/classify/extract on explicit pasted or file text."""
    instruction_text = (request.input_text or "").strip()
    if not instruction_text:
        raise HTTPException(status_code=400, detail="النص المدخل فارغ بعد التنظيف.")

    warnings: list[str] = []
    if len(instruction_text) > MAX_SELECTED_INPUT_CHARS:
        instruction_text = instruction_text[:MAX_SELECTED_INPUT_CHARS]
        warnings.append("تم تقليص النص ليتوافق مع الحد الآمن (64 ألف حرف).")

    refusal_reason = detect_unsafe_request(instruction_text)
    if refusal_reason:
        return {
            "provider": "safety-layer",
            "model": "preview-only",
            "output_text": f"لا يمكن تنفيذ هذا الطلب بسبب قيود الأمان: {refusal_reason}",
            "latency_ms": 0,
            "status": "refused",
            "warnings": [refusal_reason],
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    prompt_header = SELECTED_INPUT_ACTION_PROMPTS[request.action]
    prompt = f"{prompt_header}\n\n---\n{instruction_text}\n---"

    result = await run_prompt(
        prompt=prompt,
        provider_name=request.provider,
        model_name=request.model,
    )
    result["warnings"] = warnings + result.get("warnings", [])
    result["selected_input"] = {
        "action": request.action,
        "source_type": request.source_type,
        "file_name": _sanitize_file_name(request.file_name),
        "file_extension": (request.file_extension or "").lower() or None,
        "file_size": request.file_size,
    }
    result["timestamp"] = datetime.now(timezone.utc).isoformat()
    return result
