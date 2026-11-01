import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const STATE_PATH = process.env.BOT_STATE_PATH || join(root, "data", "state.json");

export type BotState = {
  introducedIds: string[];
  nextKind: "game" | "app";
  banking: Record<string, string>; // appId -> fingerprint
  /** اسلاگ‌هایی که وقتی به سایت وصل شد، آپدیت‌شان اعلام شود (خالی = همه) */
  watchlist: string[];
  lastDailyAt?: string;
  lastBankCheckAt?: string;
};

function empty(): BotState {
  return { introducedIds: [], nextKind: "game", banking: {}, watchlist: [] };
}

export function loadState(): BotState {
  try {
    if (!existsSync(STATE_PATH)) return empty();
    const j = JSON.parse(readFileSync(STATE_PATH, "utf8")) as BotState;
    return {
      introducedIds: Array.isArray(j.introducedIds) ? j.introducedIds : [],
      nextKind: j.nextKind === "app" ? "app" : "game",
      banking: j.banking && typeof j.banking === "object" ? j.banking : {},
      watchlist: Array.isArray(j.watchlist) ? j.watchlist.map(String) : [],
      lastDailyAt: j.lastDailyAt,
      lastBankCheckAt: j.lastBankCheckAt,
    };
  } catch {
    return empty();
  }
}

export function saveState(state: BotState): void {
  mkdirSync(dirname(STATE_PATH), { recursive: true });
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), "utf8");
}
