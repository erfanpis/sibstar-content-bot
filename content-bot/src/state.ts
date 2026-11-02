import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runtimeFromEnv } from "./runtimePersist.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const STATE_PATH = process.env.BOT_STATE_PATH || join(root, "data", "state.json");

export type CaptionTemplates = {
  updatesTitle: string;
  updatesListHeader: string;
  updatesFooterNote: string;
  updateTitle: string;
  updateBody: string;
  bankTitle: string;
  bankBody: string;
  introRecommendDefault: string;
  introRecommendGame: string;
  introRecommendSleep: string;
};

export type BotState = {
  introducedIds: string[];
  nextKind: "game" | "app";
  banking: Record<string, string>; // appId -> fingerprint
  /** اسلاگ‌هایی که وقتی به سایت وصل شد، آپدیت‌شان اعلام شود (خالی = همه) */
  watchlist: string[];
  lastDailyAt?: string;
  lastBankCheckAt?: string;
  /** ادمین‌های اضافه (غیر از ADMIN_USER_IDS / صاحبان) */
  extraAdminIds?: number[];
  /** قالب‌های کپشن قابل ویرایش */
  templates?: Partial<CaptionTemplates>;
};

function empty(): BotState {
  return { introducedIds: [], nextKind: "game", banking: {}, watchlist: [], extraAdminIds: [] };
}

export function loadState(): BotState {
  const fromEnv = runtimeFromEnv();
  try {
    const base = empty();
    if (existsSync(STATE_PATH)) {
      const j = JSON.parse(readFileSync(STATE_PATH, "utf8")) as BotState;
      const extra = Array.isArray(j.extraAdminIds)
        ? j.extraAdminIds.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0)
        : [];
      base.introducedIds = Array.isArray(j.introducedIds) ? j.introducedIds : [];
      base.nextKind = j.nextKind === "app" ? "app" : "game";
      base.banking = j.banking && typeof j.banking === "object" ? j.banking : {};
      base.watchlist = Array.isArray(j.watchlist) ? j.watchlist.map(String) : [];
      base.lastDailyAt = j.lastDailyAt;
      base.lastBankCheckAt = j.lastBankCheckAt;
      base.extraAdminIds = [...new Set(extra)];
      base.templates = j.templates && typeof j.templates === "object" ? j.templates : undefined;
    }
    // Variable گیت‌هاب منبع حقیقت برای ادمین/قالب بین جاب‌هاست
    if (fromEnv) {
      base.extraAdminIds = [...new Set([...(base.extraAdminIds || []), ...fromEnv.extraAdminIds])];
      if (fromEnv.templates) {
        base.templates = { ...(base.templates || {}), ...fromEnv.templates };
      }
    }
    return base;
  } catch {
    if (fromEnv) {
      return { ...empty(), extraAdminIds: fromEnv.extraAdminIds, templates: fromEnv.templates };
    }
    return empty();
  }
}

export function saveState(state: BotState): void {
  mkdirSync(dirname(STATE_PATH), { recursive: true });
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), "utf8");
}
