import { config } from "./config.js";
import { syncRuntimeBlob } from "./runtimePersist.js";
import { loadState, saveState } from "./state.js";

async function persistAdmins(): Promise<string> {
  const st = loadState();
  const sync = await syncRuntimeBlob({
    extraAdminIds: [...(st.extraAdminIds || [])],
    templates: st.templates,
  });
  if (!sync.ok) console.warn("[admins] sync failed", sync.detail);
  return sync.ok ? "ok" : sync.detail;
}

/** صاحبان از env — همیشه ادمین؛ فقط آن‌ها می‌توانند ادمین اضافه/حذف کنند */
export function ownerIds(): number[] {
  return [...config.adminIds];
}

export function isOwner(userId?: number): boolean {
  return !!userId && ownerIds().includes(userId);
}

/** ادمین‌های اضافه از state (+ Variable گیت‌هاب هنگام استارت) */
export function extraAdminIds(): number[] {
  const st = loadState();
  return (st.extraAdminIds || []).filter((n) => Number.isFinite(n));
}

export function allAdminIds(): number[] {
  return [...new Set([...ownerIds(), ...extraAdminIds()])];
}

export function isAdmin(userId?: number): boolean {
  return !!userId && allAdminIds().includes(userId);
}

/** ارقام فارسی/عربی → انگلیسی */
export function normalizeDigits(s: string): string {
  const fa = "۰۱۲۳۴۵۶۷۸۹";
  const ar = "٠١٢٣٤٥٦٧٨٩";
  return s.replace(/[۰-۹٠-٩]/g, (ch) => {
    const i = fa.indexOf(ch);
    if (i >= 0) return String(i);
    const j = ar.indexOf(ch);
    return j >= 0 ? String(j) : ch;
  });
}

export function parseTelegramUserId(text: string): number | null {
  const t = normalizeDigits(text).replace(/[^\d]/g, "");
  if (!t || t.length < 5 || t.length > 15) return null;
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function addAdmin(
  userId: number,
): Promise<{ ok: true; already: boolean; sync: string } | { ok: false; reason: string }> {
  if (!Number.isFinite(userId) || userId <= 0) return { ok: false, reason: "آیدی نامعتبر" };
  if (isOwner(userId)) return { ok: true, already: true, sync: "owner" };
  const st = loadState();
  const list = st.extraAdminIds || [];
  if (list.includes(userId)) {
    return { ok: true, already: true, sync: await persistAdmins() };
  }
  st.extraAdminIds = [...list, userId];
  saveState(st);
  return { ok: true, already: false, sync: await persistAdmins() };
}

export async function removeAdmin(
  userId: number,
): Promise<{ ok: true; sync: string } | { ok: false; reason: string }> {
  if (isOwner(userId)) return { ok: false, reason: "صاحب ربات را نمی‌شود حذف کرد (در Secrets است)" };
  const st = loadState();
  const before = st.extraAdminIds || [];
  if (!before.includes(userId)) return { ok: false, reason: "این آیدی ادمین نیست" };
  st.extraAdminIds = before.filter((id) => id !== userId);
  saveState(st);
  return { ok: true, sync: await persistAdmins() };
}
