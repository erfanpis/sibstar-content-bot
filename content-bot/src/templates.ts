import { loadState, saveState, type CaptionTemplates } from "./state.js";

export type TemplateKey = keyof CaptionTemplates;

export const TEMPLATE_META: { key: TemplateKey; title: string; hint: string }[] = [
  {
    key: "updatesTitle",
    title: "عنوان آپدیت‌های امروز",
    hint: "بدون جای‌نگهدار",
  },
  {
    key: "updatesListHeader",
    title: "سرتیتر لیست امروز",
    hint: "بدون جای‌نگهدار",
  },
  {
    key: "updatesFooterNote",
    title: "فوتر لیست امروز",
    hint: "بدون جای‌نگهدار",
  },
  {
    key: "updateTitle",
    title: "عنوان آپدیت تکی",
    hint: "جای‌نگهدار: {kind}",
  },
  {
    key: "updateBody",
    title: "بدنه آپدیت تکی",
    hint: "بدون جای‌نگهدار",
  },
  {
    key: "bankTitle",
    title: "عنوان آپدیت بانکی",
    hint: "بدون جای‌نگهدار",
  },
  {
    key: "bankBody",
    title: "بدنه آپدیت بانکی",
    hint: "بدون جای‌نگهدار",
  },
  {
    key: "introRecommendDefault",
    title: "پیشنهاد معرفی (پیش‌فرض)",
    hint: "بدون جای‌نگهدار",
  },
  {
    key: "introRecommendGame",
    title: "پیشنهاد معرفی (بازی)",
    hint: "بدون جای‌نگهدار",
  },
  {
    key: "introRecommendSleep",
    title: "پیشنهاد معرفی (خواب/آلارم)",
    hint: "بدون جای‌نگهدار",
  },
];

export const DEFAULT_TEMPLATES: CaptionTemplates = {
  updatesTitle: "✨ <b>بروزرسانی‌های امروز به استور سیب‌استار اضافه شد</b>",
  updatesListHeader: "⭐️ <b>لیست برنامه‌های امروز</b>",
  updatesFooterNote: "پشتیبانی · آموزش نصب · اینستاگرام",
  updateTitle: "✨ <b>آپدیت جدید {kind} منتشر شد!</b>",
  updateBody: "🟢 جدیدترین نسخه برنامه به سایت اضافه شد و هم‌اکنون آماده دریافت است.",
  bankTitle: "✨ <b>آپدیت جدید بانکی منتشر شد!</b>",
  bankBody: "🟢 جدیدترین نسخه برنامه به سایت اضافه شد و هم‌اکنون آماده دریافت است.",
  introRecommendDefault: "👑 بشدت پیشنهادش می‌کنم؛ دوستان خودم استفاده می‌کنن ازش، دانلود نسخه پریمیوم:",
  introRecommendGame: "👑 بشدت پیشنهادش می‌کنم؛ خودم و دوستام روش وقت می‌ذاریم — دانلود نسخه کامل:",
  introRecommendSleep: "👑 بشدت پیشنهادش می‌کنم؛ دوستان خودم استفاده می‌کنن ازش، دانلود نسخه پریمیوم:",
};

export function getTemplates(): CaptionTemplates {
  const st = loadState();
  return { ...DEFAULT_TEMPLATES, ...(st.templates || {}) };
}

export function getTemplate(key: TemplateKey): string {
  return getTemplates()[key];
}

export function setTemplate(key: TemplateKey, value: string): void {
  const st = loadState();
  st.templates = { ...getTemplates(), [key]: value.trim() };
  saveState(st);
}

export function resetTemplate(key: TemplateKey): void {
  const st = loadState();
  const next = { ...getTemplates() };
  next[key] = DEFAULT_TEMPLATES[key];
  st.templates = next;
  saveState(st);
}

export function resetAllTemplates(): void {
  const st = loadState();
  st.templates = { ...DEFAULT_TEMPLATES };
  saveState(st);
}

export function fillTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, k: string) => (k in vars ? vars[k]! : `{${k}}`));
}

export function isTemplateKey(s: string): s is TemplateKey {
  return TEMPLATE_META.some((m) => m.key === s);
}
