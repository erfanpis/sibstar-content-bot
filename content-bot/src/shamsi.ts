import * as jalaali from "jalaali-js";

const MONTHS = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
];

const FA = "۰۱۲۳۴۵۶۷۸۹";

function toFaDigits(n: number | string): string {
  return String(n).replace(/\d/g, (d) => FA[Number(d)]!);
}

export function faDigitsToEn(s: string): string {
  return String(s || "").replace(/[۰-۹]/g, (d) => String(FA.indexOf(d)));
}

/** کلید تاریخ شمسی مثل 1405/8/10 */
export function shamsiKey(date = new Date(), timeZone = "Asia/Tehran"): string {
  const parts = new Intl.DateTimeFormat("en-US-u-ca-persian", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value || 0);
  return `${get("year")}/${get("month")}/${get("day")}`;
}

/** پارس تاریخ کاتالوگ مثل ۱۴۰۵/۸/۱۰ یا 1405/8/10 */
export function parseCatalogShamsi(raw: string): { y: number; m: number; d: number; key: string } | null {
  const t = faDigitsToEn(raw).trim();
  const m = t.match(/^(\d{3,4})\/(\d{1,2})\/(\d{1,2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!y || !mo || !d) return null;
  return { y, m: mo, d, key: `${y}/${mo}/${d}` };
}

/** مثال: ۲ آبان ماه */
export function shamsiDayTitle(date = new Date()): string {
  // از تاریخ تهران استفاده کن تا با lastUpdated کاتالوگ یکی باشد
  const key = shamsiKey(date);
  const [jy, jm, jd] = key.split("/").map(Number);
  return `${toFaDigits(jd!)} ${MONTHS[(jm || 1) - 1]} ماه`;
}

export function shamsiParenDate(date = new Date()): string {
  return `(${shamsiDayTitle(date)})`;
}
