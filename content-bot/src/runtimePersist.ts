/**
 * ماندگاری ادمین/قالب روی GitHub Actions Variable
 * تا با کنسل/ری‌اسپاون جاب از بین نرود (cache کافی نیست).
 */
import type { CaptionTemplates } from "./state.js";

export type RuntimeBlob = {
  extraAdminIds: number[];
  templates?: Partial<CaptionTemplates>;
};

function repoSlug(): string {
  return (process.env.GITHUB_REPOSITORY || process.env.STATE_SYNC_REPO || "").trim();
}

function token(): string {
  return (process.env.STATE_SYNC_TOKEN || process.env.RESPAWN_PAT || process.env.GH_TOKEN || "").trim();
}

export function runtimeFromEnv(): RuntimeBlob | null {
  const raw = (process.env.SIBSTAR_BOT_RUNTIME || "").trim();
  if (!raw) return null;
  try {
    const j = JSON.parse(raw) as RuntimeBlob;
    const ids = Array.isArray(j.extraAdminIds)
      ? j.extraAdminIds.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0)
      : [];
    return {
      extraAdminIds: [...new Set(ids)],
      templates: j.templates && typeof j.templates === "object" ? j.templates : undefined,
    };
  } catch (e) {
    console.warn("[runtimePersist] bad SIBSTAR_BOT_RUNTIME", e);
    return null;
  }
}

/** همگام‌سازی فوری به GitHub Variable */
export async function syncRuntimeBlob(blob: RuntimeBlob): Promise<{ ok: boolean; detail: string }> {
  const t = token();
  const repo = repoSlug();
  if (!t || !repo) {
    return { ok: false, detail: "STATE_SYNC_TOKEN یا GITHUB_REPOSITORY نیست — فقط همین جاب نگه می‌دارد" };
  }
  const body = JSON.stringify(blob);
  if (body.length > 45_000) {
    return { ok: false, detail: "داده runtime خیلی بزرگ است" };
  }
  const headers: Record<string, string> = {
    Authorization: `Bearer ${t}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
  };
  const base = `https://api.github.com/repos/${repo}/actions/variables/SIBSTAR_BOT_RUNTIME`;
  try {
    const patch = await fetch(base, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ name: "SIBSTAR_BOT_RUNTIME", value: body }),
    });
    if (patch.ok) return { ok: true, detail: "variable updated" };
    if (patch.status === 404) {
      const create = await fetch(`https://api.github.com/repos/${repo}/actions/variables`, {
        method: "POST",
        headers,
        body: JSON.stringify({ name: "SIBSTAR_BOT_RUNTIME", value: body }),
      });
      if (create.ok) return { ok: true, detail: "variable created" };
      const err = await create.text();
      return { ok: false, detail: `create ${create.status}: ${err.slice(0, 200)}` };
    }
    const err = await patch.text();
    return { ok: false, detail: `patch ${patch.status}: ${err.slice(0, 200)}` };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : String(e) };
  }
}
