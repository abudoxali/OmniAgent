import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { enOverrides } from './en'
import { arMessages, type Messages } from './messages'

export type Language = 'ar' | 'en'
export type ThemePreference = 'system' | 'dark' | 'light'
export type EffectiveTheme = 'dark' | 'light'

const LANGUAGE_STORAGE_KEY = 'omniagent_language_v1'
const THEME_STORAGE_KEY = 'omniagent_theme_v1'

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends Array<infer U>
    ? Array<U extends object ? DeepPartial<U> : U>
    : T[K] extends object
      ? DeepPartial<T[K]>
      : T[K]
}

function deepMerge<T>(target: T, source?: DeepPartial<T>): T {
  if (!source) {
    return target
  }

  if (Array.isArray(target) || Array.isArray(source)) {
    return (source as T) ?? target
  }

  const result: Record<string, unknown> = { ...(target as Record<string, unknown>) }
  for (const key of Object.keys(source as Record<string, unknown>)) {
    const sourceValue = (source as Record<string, unknown>)[key]
    const targetValue = (target as Record<string, unknown>)[key]
    if (
      sourceValue &&
      targetValue &&
      typeof sourceValue === 'object' &&
      typeof targetValue === 'object' &&
      !Array.isArray(sourceValue) &&
      !Array.isArray(targetValue)
    ) {
      result[key] = deepMerge(targetValue, sourceValue as DeepPartial<typeof targetValue>)
    } else if (sourceValue !== undefined) {
      result[key] = sourceValue
    }
  }
  return result as T
}

const messagesByLanguage: Record<Language, Messages> = {
  ar: arMessages,
  en: deepMerge(arMessages, enOverrides),
}

const modeLabels: Record<Language, Record<string, string>> = {
  ar: {
    custom: 'مخصص',
    summarize: 'تلخيص',
    rewrite: 'إعادة صياغة',
    explain: 'شرح',
    translate: 'ترجمة',
    generate_reply: 'إنشاء رد',
  },
  en: {
    custom: 'Custom',
    summarize: 'Summarize',
    rewrite: 'Rewrite',
    explain: 'Explain',
    translate: 'Translate',
    generate_reply: 'Generate reply',
  },
}

const statusLabels: Record<Language, Record<string, string>> = {
  ar: {
    ok: 'جاهز',
    error: 'خطأ',
    offline: 'غير متصل',
    online: 'متصل',
    unconfigured: 'غير مهيأ',
    configured: 'مهيأ',
    connected: 'متصل',
    disconnected: 'غير متصل',
    checking: 'جارٍ التحقق',
    disabled: 'معطل',
    unavailable: 'غير متاح',
    captured: 'تم الالتقاط',
    failed: 'فشل',
    unknown: 'غير معروف',
    validation_error: 'خطأ في التحقق',
    refused: 'مرفوض',
    healthy: 'سليم',
    non_text: 'ليس نصًا',
    empty: 'فارغ',
    unsupported: 'غير مدعوم',
    timeout: 'انتهت المهلة',
    skipped: 'تم التخطي',
    partial: 'جزئي',
    model_not_found: 'النموذج غير مثبت',
    missing_server: 'الخادم غير متاح',
    no_model_loaded: 'لا يوجد موديل محمّل',
    bad_model: 'الموديل غير متاح',
    misconfigured: 'الإعداد غير مكتمل',
    bad_credentials: 'بيانات الدخول غير صالحة',
    starting: 'جارٍ التشغيل',
    warning: 'تنبيه',
  },
  en: {
    ok: 'Ready',
    error: 'Error',
    offline: 'Offline',
    online: 'Online',
    unconfigured: 'Unconfigured',
    configured: 'Configured',
    connected: 'Connected',
    disconnected: 'Disconnected',
    checking: 'Checking',
    disabled: 'Disabled',
    unavailable: 'Unavailable',
    captured: 'Captured',
    failed: 'Failed',
    unknown: 'Unknown',
    validation_error: 'Validation error',
    refused: 'Refused',
    healthy: 'Healthy',
    non_text: 'Non-text',
    empty: 'Empty',
    unsupported: 'Unsupported',
    timeout: 'Timed out',
    skipped: 'Skipped',
    partial: 'Partial',
    model_not_found: 'Model not installed',
    missing_server: 'Server unavailable',
    no_model_loaded: 'No model loaded',
    bad_model: 'Model unavailable',
    misconfigured: 'Configuration incomplete',
    bad_credentials: 'Invalid credentials',
    starting: 'Starting',
    warning: 'Warning',
  },
}

const phaseLabelsAr: Record<string, string> = {
  'Phase 1C - Controlled Model Router + First Real AI Run': 'المرحلة 1C - موجّه نماذج مضبوط وأول تشغيل فعلي للذكاء الاصطناعي',
  'Phase 1D - Arabic RTL Interface + Font System': 'المرحلة 1D - واجهة عربية RTL ونظام خطوط',
  'Phase 1E - Real Provider Validation + Arabic Provider Setup UX': 'المرحلة 1E - التحقق الفعلي من المزود وتجربة إعداد عربية',
  'Phase 1F - Live Provider Connection + Model Selection Persistence': 'المرحلة 1F - ربط مزود حي مع حفظ اختيار النموذج',
  'Phase 1G - Live Provider End-to-End QA + First Real Completion': 'المرحلة 1G - تحقق حي من المزود وأول استجابة فعلية',
  'Phase 1H - Preview MVP Stabilization + Release Readiness': 'المرحلة 1H - استقرار نسخة المعاينة والاستعداد للإصدار',
  'Phase 2A - Approval-Based Text Actions': 'المرحلة 2A - إجراءات نصية بعد موافقة المستخدم',
  'Phase 2B - Global Overlay Workflow + Active App Text Assistant': 'المرحلة 2B - مساعد النصوص العائم فوق أي تطبيق',
  'Phase 2C - Overlay Target Capture + UX Reliability': 'المرحلة 2C - تحسين التقاط النافذة المستهدفة وموثوقية الواجهة',
  'Self-Contained Desktop Runtime - Backend Bundling Feasibility': 'تشغيل ذاتي للتطبيق المكتبي مع إمكانية تضمين الخلفية المحلية',
  'Phase 3A - Local Workspace: Notes, Tasks, Saved Results, and Session History': 'المرحلة 3A - مساحة عمل محلية للملاحظات والمهام والنتائج المحفوظة وسجل الجلسات',
  'Phase 3E Technical Scope Complete - Pending Human GUI Verification Bundle': 'المرحلة 3E - اكتمال النطاق التقني بانتظار باقة تحقق GUI بشرية',
  'Post-Phase 3E - Services Visibility and Product Hardening': 'ما بعد المرحلة 3E - وضوح الخدمات وتقوية المنتج',
  'Post-Phase 3E Master Hardening - Branding, Bilingual UI, Theme, Help, Services Clarity, and Final Internal Release Polish':
    'ما بعد المرحلة 3E - التقوية الرئيسية للعلامة واللغات والسمة والمساعدة وتوضيح الخدمات',
}

const providerLabels: Record<Language, Record<string, string>> = {
  ar: {
    Ollama: 'أولاما',
    'LM Studio': 'إل إم ستوديو',
    'OpenAI Compatible': 'متوافق مع OpenAI',
    ollama: 'أولاما',
    lmstudio: 'إل إم ستوديو',
    openai_compatible: 'متوافق مع OpenAI',
  },
  en: {
    Ollama: 'Ollama',
    'LM Studio': 'LM Studio',
    'OpenAI Compatible': 'OpenAI-compatible',
    ollama: 'Ollama',
    lmstudio: 'LM Studio',
    openai_compatible: 'OpenAI-compatible',
  },
}

interface AppPreferencesValue {
  language: Language
  setLanguage: (language: Language) => void
  messages: Messages
  locale: string
  direction: 'rtl' | 'ltr'
  themePreference: ThemePreference
  setThemePreference: (theme: ThemePreference) => void
  effectiveTheme: EffectiveTheme
  formatDateTime: (value?: string | number | Date | null) => string
  formatTime: (value?: string | number | Date | null) => string
  formatNumber: (value: number) => string
}

const AppPreferencesContext = createContext<AppPreferencesValue | null>(null)

function getStoredLanguage(): Language {
  try {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY)
    return stored === 'en' ? 'en' : 'ar'
  } catch {
    return 'ar'
  }
}

function getStoredTheme(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    return stored === 'dark' || stored === 'light' || stored === 'system' ? stored : 'dark'
  } catch {
    return 'dark'
  }
}

function getSystemTheme(): EffectiveTheme {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'dark'
  }
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

export function translateMode(mode: string, language: Language = 'ar'): string {
  return modeLabels[language][mode] ?? mode
}

export function translateStatus(status: string, language: Language = 'ar'): string {
  return statusLabels[language][status] ?? status.split('_').join(' ')
}

export function translatePhase(phase: string, language: Language = 'ar'): string {
  if (language === 'en') {
    return phase
  }
  return phaseLabelsAr[phase] ?? phase
}

export function translateProviderLabel(label: string, language: Language = 'ar'): string {
  return providerLabels[language][label] ?? label
}

export function AppPreferencesProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(getStoredLanguage)
  const [themePreference, setThemePreference] = useState<ThemePreference>(getStoredTheme)
  const [systemTheme, setSystemTheme] = useState<EffectiveTheme>(getSystemTheme)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return
    }
    const media = window.matchMedia('(prefers-color-scheme: light)')
    const handleChange = () => setSystemTheme(media.matches ? 'light' : 'dark')
    handleChange()
    media.addEventListener('change', handleChange)
    return () => media.removeEventListener('change', handleChange)
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
    } catch {
      // ignore storage errors
    }
  }, [language])

  useEffect(() => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, themePreference)
    } catch {
      // ignore storage errors
    }
  }, [themePreference])

  const messages = useMemo(() => messagesByLanguage[language], [language])
  const locale = language === 'ar' ? 'ar-EG' : 'en-US'
  const direction: 'rtl' | 'ltr' = language === 'ar' ? 'rtl' : 'ltr'
  const effectiveTheme = themePreference === 'system' ? systemTheme : themePreference

  useEffect(() => {
    document.documentElement.lang = language
    document.documentElement.dir = direction
    document.documentElement.dataset.theme = effectiveTheme
    document.body.dataset.theme = effectiveTheme
    document.title = messages.brand.name
  }, [direction, effectiveTheme, language, messages.brand.name])

  const value = useMemo<AppPreferencesValue>(() => ({
    language,
    setLanguage,
    messages,
    locale,
    direction,
    themePreference,
    setThemePreference,
    effectiveTheme,
    formatDateTime(value) {
      if (!value) {
        return '-'
      }
      const date = new Date(value)
      if (Number.isNaN(date.getTime())) {
        return String(value)
      }
      return new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' }).format(date)
    },
    formatTime(value) {
      if (!value) {
        return '-'
      }
      const date = new Date(value)
      if (Number.isNaN(date.getTime())) {
        return String(value)
      }
      return new Intl.DateTimeFormat(locale, { timeStyle: 'short' }).format(date)
    },
    formatNumber(value) {
      return new Intl.NumberFormat(locale).format(value)
    },
  }), [direction, effectiveTheme, language, locale, messages, themePreference])

  return <AppPreferencesContext.Provider value={value}>{children}</AppPreferencesContext.Provider>
}

export function useAppPreferences() {
  const value = useContext(AppPreferencesContext)
  if (!value) {
    throw new Error('useAppPreferences must be used inside AppPreferencesProvider')
  }
  return value
}
