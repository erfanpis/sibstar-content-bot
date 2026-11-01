import { config } from "./config.js";
import { loadState, saveState } from "./state.js";

/** صاحبان از env — همیشه ادمین؛ فقط آن‌ها می‌توانند ادمین اضافه/حذف کنند */
export function ownerIds(): number[] {
  return [...config.adminIds];
}

export function isOwner(userId?: number): boolean {
  return !!userId && ownerIds().includes(userId);
}

/** ادمین‌های اضافه از state (روی Actions با cache ماندگار می‌شود) */
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

export function addAdmin(userId: number): { ok: true; already: boolean } | { ok: false; reason: string } {
  if (!Number.isFinite(userId) || userId <= 0) return { ok: false, reason: "آیدی نامعتبر" };
  if (isOwner(userId)) return { ok: true, already: true };
  const st = loadState();
  const list = st.extraAdminIds || [];
  if (list.includes(userId)) return { ok: true, already: true };
  st.extraAdminIds = [...list, userId];
  saveState(st);
  return { ok: true, already: false };
}

export function removeAdmin(userId: number): { ok: true } | { ok: false; reason: string } {
  if (isOwner(userId)) return { ok: false, reason: "صاحب ربات را نمی‌شود حذف کرد (در Secrets است)" };
  const st = loadState();
  const before = st.extraAdminIds || [];
  if (!before.includes(userId)) return { ok: false, reason: "این آیدی ادمین نیست" };
  st.extraAdminIds = before.filter((id) => id !== userId);
  saveState(st);
  return { ok: true };
}
