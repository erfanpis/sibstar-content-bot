import dotenv from "dotenv";

// .env محلی روی متغیرهای inject‌شده اولویت دارد (آزمایشی / عوض کردن کانال)
dotenv.config({ override: true });

function required(name: string): string {
  const v = (process.env[name] || "").trim();
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function list(name: string): number[] {
  return (process.env[name] || "")
    .split(/[,\s]+/)
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => Number(x))
    .filter((n) => Number.isFinite(n));
}

function numEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export const config = {
  token: required("TELEGRAM_BOT_TOKEN"),
  channelId: required("TELEGRAM_CHANNEL_ID"),
  adminIds: list("ADMIN_USER_IDS"),
  sibstarBase: (process.env.SIBSTAR_BASE_URL || "https://beta.sibstars.ir").replace(/\/$/, ""),
  aiCaptions: (process.env.AI_CAPTIONS || "1") !== "0",
  channelUrl: (process.env.SIBSTAR_CHANNEL_URL || "https://t.me/sibstar98").trim(),
  supportUrl: (process.env.SIBSTAR_SUPPORT_URL || "https://t.me/sibstarSUP").trim(),
  groupUrl: (process.env.SIBSTAR_GROUP_URL || "https://t.me/gsibstar").trim(),
  installUrl: (process.env.SIBSTAR_INSTALL_URL || "").trim(),
  instagramUrl: (process.env.SIBSTAR_INSTAGRAM_URL || "https://instagram.com/sibstar98").trim(),
  /** پیش‌فرض ۰ = بدون پست خودکار تا تأیید ادمین */
  dailyEveryHours: numEnv("DAILY_EVERY_HOURS", 0),
  bankEveryMinutes: numEnv("BANK_EVERY_MINUTES", 0),
  /** برای پست کانال با ایموجی پرموم (MTProto) — از my.telegram.org */
  tgApiId: Number(process.env.TELEGRAM_API_ID || "") || 0,
  tgApiHash: (process.env.TELEGRAM_API_HASH || "").trim(),
  tgUserSession: (process.env.TELEGRAM_USER_SESSION || "").trim(),
};

if (!config.adminIds.length) {
  throw new Error("ADMIN_USER_IDS must include at least one numeric Telegram user id");
}
