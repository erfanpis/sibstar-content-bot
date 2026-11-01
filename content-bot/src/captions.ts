import { config } from "./config.js";
import type { SibApp } from "./sibstar.js";
import { fillTemplate, getTemplates } from "./templates.js";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function tme(handleOrUrl: string): string {
  const t = handleOrUrl.trim();
  if (!t) return "https://t.me/sibstar98";
  if (t.startsWith("http")) return t;
  return `https://t.me/${t.replace(/^@/, "")}`;
}

/** فوتر آپدیت — نقل‌قول کانال/پشتیبانی/گروه */
function footerQuote(): string {
  const channel = tme(config.channelUrl || "https://t.me/sibstar98");
  const support = tme(config.supportUrl || "https://t.me/sibstarSUP");
  const group = tme(config.groupUrl || "https://t.me/gsibstar");
  const inner = [
    `🔥 <a href="${esc(channel)}">کانال رسمی سیب‌استار</a>`,
    `👨‍💻 <a href="${esc(support)}">پشتیبانی و پاسخ‌گویی</a>`,
    `💬 <a href="${esc(group)}">گروه گفت‌وگوی کاربران</a>`,
  ].join("\n");
  return `<blockquote>${inner}</blockquote>`;
}

/** فوتر معرفی روزانه — مثل نمونه کانال */
function introFooterLine(): string {
  const support = tme(config.supportUrl || "https://t.me/sibstarSUP");
  const install = tme(config.installUrl || config.channelUrl || "https://t.me/sibstar98");
  const insta = (config.instagramUrl || "https://instagram.com/sibstar98").trim();
  return [
    `<a href="${esc(support)}">پشتیبانی</a>`,
    `<a href="${esc(install)}">آموزش نصب</a>`,
    `<a href="${esc(insta)}">اینستاگرام</a>`,
  ].join(" | ");
}

function cleanDesc(raw: string): string {
  return raw
    .replace(/\r/g, "")
    .replace(/\*+/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function firstSentences(text: string, maxLen = 220): string {
  const t = cleanDesc(text).replace(/\n+/g, " ").trim();
  if (!t) return "";
  // strip leading emoji spam for body
  const plain = t.replace(/^[\p{Emoji_Presentation}\p{Extended_Pictographic}\s]+/u, "").trim() || t;
  const parts = plain.split(/(?<=[.!?؟])/).map((x) => x.trim()).filter(Boolean);
  let out = "";
  for (const p of parts) {
    const next = out ? `${out} ${p}` : p;
    if (next.length > maxLen) break;
    out = next;
    if (out.length >= 110) break;
  }
  if (!out) out = plain.slice(0, maxLen);
  return out.length > maxLen ? out.slice(0, maxLen - 1) + "…" : out;
}

function displayName(app: SibApp): string {
  // برای کپشن داستانی اسم انگلیسی/برند را ترجیح بده اگر خوانا باشد
  const en = (app.name || "").trim();
  const fa = (app.nameFa || "").trim();
  if (en && /^[A-Za-z0-9]/.test(en) && en.length <= 42) return en;
  return fa || en || app.slug;
}

function hookFor(app: SibApp): string {
  const name = displayName(app);
  const d = (app.description || "").toLowerCase();
  const cat = `${app.category} ${app.categories.join(" ")}`.toLowerCase();
  const hay = `${d} ${cat} ${name.toLowerCase()} ${app.slug}`;

  if (app.kind === "game") {
    if (/فوتبال|soccer|football|fifa|pes/.test(hay))
      return `⚽ اگه دنبال یه تجربه فوتبالی واقعی روی آیفون هستی، <b>${esc(name)}</b> رو از دست نده.`;
    if (/رانندگی|racing|drive|car|race/.test(hay))
      return `🏎 اگه هیجان سرعت و رانندگی حالته، <b>${esc(name)}</b> همونه که باید تست کنی.`;
    if (/پازل|puzzle|فکری/.test(hay))
      return `🧠 اگه دوست داری مغزت رو با یه پازل حسابی درگیر کنی، <b>${esc(name)}</b> رو امتحان کن.`;
    return `🎮 اگه دنبال یه بازی جمع‌وجور و اعتیادآوری، <b>${esc(name)}</b> رو پیشنهاد می‌کنم.`;
  }
  if (app.isBanking || /بانک|پرداخت|کارت|wallet|finance/.test(hay))
    return `💳 اگه کارهای بانکی‌ت رو سریع و بی‌دردسر می‌خوای جمع کنی، <b>${esc(name)}</b> گزینه خوبیه.`;
  if (/خواب|sleep|آلارم|بیدار|alarm|calm|آرامش|soothing/.test(hay))
    return `⏰ اگه بعضی صبح‌ها با صدای آلارم بیدار می‌شی ولی مغزت هنوز خوابه، <b>${esc(name)}</b> رو امتحان کن.`;
  if (/آب|water|hydrat|نوشیدن/.test(hay))
    return `💧 اگه وسط روز یادت می‌ره آب بخوری، <b>${esc(name)}</b> کمکت می‌کنه عادت سالم بسازی.`;
  if (/عکس|photo|camera|ویرایش|edit|filter|instagram/.test(hay))
    return `📸 اگه عاشق ادیت عکس و استوری‌های چشم‌گیری، <b>${esc(name)}</b> رو ببین.`;
  if (/موسیقی|music|آهنگ|spotify|podcast|صدا/.test(hay))
    return `🎧 اگه موسیقی بخش ثابت روزته، <b>${esc(name)}</b> می‌تونه تجربه گوش‌دادنت رو بهتر کنه.`;
  if (/ویدئو|video|فیلم|netflix|stream|تماشا/.test(hay))
    return `🎬 اگه دنبال تماشای راحت فیلم و سریال روی آیفون هستی، <b>${esc(name)}</b> رو جدی بگیر.`;
  if (/یادداشت|note|todo|کار|habit|عادت|planner|تقویم|calendar/.test(hay))
    return `📝 اگه دوست داری برنامه‌هات منظم‌تر پیش بره، <b>${esc(name)}</b> رو امتحان کن.`;
  if (/ورزش|fitness|gym|workout|سلامت|health|step/.test(hay))
    return `🏃 اگه می‌خوای ورزش و سلامتی‌ت رو جدی‌تر دنبال کنی، <b>${esc(name)}</b> همراه‌ته.`;
  if (/vpn|پروکسی|proxy|شبکه|network/.test(hay))
    return `🛡 اگه دنبال اتصال پایدار و امن‌تری، <b>${esc(name)}</b> رو چک کن.`;
  if (/آموزش|learn|زبان|language|study|درس/.test(hay))
    return `📚 اگه دوست داری یادگیری‌ت رو روی گوشی جلو ببری، <b>${esc(name)}</b> گزینه قوی‌ایه.`;
  return `✨ دنبال یه برنامه کاربردی می‌گردی؟ <b>${esc(name)}</b> رو امتحان کن.`;
}

function isBoilerplate(text: string): boolean {
  return /app store|download .+ on the|see screenshots|customer ratings|learn more about|google play|available on the/i.test(
    text,
  );
}

/** از نتایج سرچ، جمله‌های کاربردی واقعی را برای بدنه کپشن می‌کشد */
function bodyFromResearch(snippets: { title: string; description: string }[]): string {
  const useful = snippets
    .map((s) => s.description.replace(/\s+/g, " ").trim())
    .filter((t) => t.length >= 60 && !isBoilerplate(t));
  if (!useful.length) return "";
  // اگر فارسی بود همان را؛ وگرنه فقط وقتی کاتالوگ خالی است استفاده می‌شود
  const persian = useful.find((t) => /[\u0600-\u06FF]/.test(t));
  const pick = persian || useful[0]!;
  const clipped = firstSentences(pick, 280);
  return clipped ? `💤 ${esc(clipped)}` : "";
}

function bodyFor(app: SibApp, snippets: { title: string; description: string }[] = []): string {
  // اولویت با توضیح فارسی خود سیب‌استار (مثل نمونه Sleep Cycle)
  const catalog = firstSentences(app.description || "", 280);
  if (catalog && /[\u0600-\u06FF]/.test(catalog)) return `💤 ${esc(catalog)}`;
  if (catalog && catalog.length >= 80) return `💤 ${esc(catalog)}`;

  const researched = bodyFromResearch(snippets);
  if (researched) return researched;
  if (catalog) return `💤 ${esc(catalog)}`;

  if (app.kind === "game")
    return `💤 گیم‌پلی روان، حس‌وحال جذاب و تجربه‌ای که سریع واردش می‌شی — مناسب وقتی می‌خوای چند دقیقه باکیفیت بازی کنی.`;
  return `💤 رابط ساده، تمرکز روی کار اصلی، و حسی که باعث می‌شه واقعاً ازش استفاده کنی نه فقط نصبش کنی.`;
}

function recommendLine(app: SibApp): string {
  const t = getTemplates();
  if (app.kind === "game") return t.introRecommendGame;
  if (/خواب|sleep|آلارم|alarm|calm|آرامش/.test(`${app.description} ${app.name} ${app.nameFa}`.toLowerCase())) {
    return t.introRecommendSleep;
  }
  return t.introRecommendDefault;
}

/** کپشن معرفی روزانه — استایل داستانی کانال (مثل نمونه Sleep Cycle) + یافته‌های سرچ وب */
export async function introCaption(
  app: SibApp,
  link: string,
  _useAi: boolean,
  research: { title: string; description: string }[] = [],
): Promise<string> {
  const name = displayName(app);
  const lines = [
    hookFor(app),
    "",
    bodyFor(app, research),
    "",
    recommendLine(app),
    `🔗 <a href="${esc(link)}">دانلود ${esc(name)} Premium</a>`,
    "",
    introFooterLine(),
  ];
  let caption = lines.join("\n");
  if (caption.length > 1024) {
    caption = [
      hookFor(app),
      "",
      bodyFor(app, research).slice(0, 150) + "…",
      "",
      `👑 نسخه پریمیوم آماده دانلود:`,
      `🔗 <a href="${esc(link)}">دانلود ${esc(name)} Premium</a>`,
      "",
      introFooterLine(),
    ].join("\n");
  }
  return caption.slice(0, 1024);
}

/** قالب کپشن آپدیت — زیر همان عکس */
export function updateReleaseCaption(app: SibApp, link: string): string {
  const kind = app.kind === "game" ? "بازی" : "برنامه";
  const name = esc(app.nameFa || app.name);
  const version = esc(app.version || "—");
  const t = getTemplates();
  return [
    fillTemplate(t.updateTitle, { kind }),
    "",
    `📱 ${kind}: <a href="${esc(link)}"><b>${name}</b></a>`,
    `🗂 نسخه: <code>${version}</code>`,
    "",
    t.updateBody,
    "",
    "📥 دریافت آخرین نسخه:",
    `🔗 <a href="${esc(link)}">لینک دانلود</a>`,
    "",
    footerQuote(),
  ].join("\n");
}

export async function bankUpdateCaption(app: SibApp, link: string, _useAi: boolean): Promise<string> {
  const name = esc(app.nameFa || app.name);
  const version = esc(app.version || "—");
  const t = getTemplates();
  return [
    t.bankTitle,
    "",
    `📱 برنامه: <a href="${esc(link)}"><b>${name}</b></a>`,
    `🗂 نسخه: <code>${version}</code>`,
    "",
    t.bankBody,
    "",
    "📥 دریافت آخرین نسخه:",
    `🔗 <a href="${esc(link)}">لینک دانلود</a>`,
    "",
    footerQuote(),
  ].join("\n");
}
