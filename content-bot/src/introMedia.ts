/**
 * عکس معرفی روزانه — اسکرین‌شات سیب‌استار، بعد بهترین عکس وب.
 * قالب کاور آپدیت اینجا استفاده نمی‌شود.
 */
import sharp from "sharp";
import { DuckDuckGo } from "duck-poacher";
import type { SibApp } from "./sibstar.js";
import { absUrl } from "./sibstar.js";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";

export type WebSnippet = { title: string; description: string; url: string };

function brandQuery(app: SibApp): string {
  const name = (app.name || app.nameFa || app.slug).trim();
  const kind = app.kind === "game" ? "game" : "app";
  return `${name} ${kind} iPhone`;
}

function imageQueries(app: SibApp): string[] {
  const name = (app.name || app.nameFa || app.slug).trim();
  const kind = app.kind === "game" ? "game" : "app";
  return [
    `${name} ${kind} iPhone screenshot high quality`,
    `${name} iOS app store screenshots`,
    `${name} ${kind} iPhone`,
  ];
}

async function download(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "image/*,*/*" },
      redirect: "follow",
      signal: AbortSignal.timeout(18000),
    });
    if (!res.ok) return null;
    const ctype = (res.headers.get("content-type") || "").toLowerCase();
    if (ctype && !ctype.includes("image") && !ctype.includes("octet-stream")) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 12_000 || buf.length > 12_000_000) return null;
    return buf;
  } catch {
    return null;
  }
}

async function scoreImage(buf: Buffer): Promise<{ score: number; w: number; h: number } | null> {
  try {
    const meta = await sharp(buf).metadata();
    const w = meta.width || 0;
    const h = meta.height || 0;
    if (w < 500 || h < 400) return null;
    if (w * h < 400_000) return null;
    const aspect = w / h;
    let score = w * h;
    if (aspect >= 0.55 && aspect <= 2.2) score *= 1.25;
    if (w >= 1000 || h >= 1000) score *= 1.35;
    if (w >= 1400 || h >= 1400) score *= 1.2;
    if (meta.format === "jpeg" || meta.format === "png" || meta.format === "webp") score *= 1.05;
    return { score, w, h };
  } catch {
    return null;
  }
}

async function collectImageUrls(app: SibApp): Promise<string[]> {
  const ddg = new DuckDuckGo();
  const urls: string[] = [];
  const seen = new Set<string>();
  for (const q of imageQueries(app)) {
    try {
      const hits = await ddg.imageSearch(q, { size: "Large", safeSearch: true });
      for (const h of hits || []) {
        const u = (h.imageUrl || "").trim();
        if (!u || !/^https?:\/\//i.test(u)) continue;
        if (seen.has(u)) continue;
        if (/\/th\?|mm\.bing\.net\/th\//i.test(u)) continue;
        seen.add(u);
        urls.push(u);
        if (urls.length >= 28) return urls;
      }
    } catch (e) {
      console.warn("imageSearch fail", q, e);
    }
  }
  return urls;
}

async function normalizePhoto(raw: Buffer): Promise<Buffer | null> {
  try {
    return await sharp(raw)
      .rotate()
      .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 92, mozjpeg: true })
      .toBuffer();
  } catch {
    return null;
  }
}

/** بهترین عکس معرفی — اول سیب‌استار، بعد سرچ وب */
export async function findBestIntroPhoto(app: SibApp): Promise<Buffer> {
  let best: { buf: Buffer; score: number } | null = null;

  // 1) اسکرین‌شات‌های خود کاتالوگ
  for (const shot of (app.screenshots || []).slice(0, 6)) {
    const u = absUrl(shot);
    const raw = u ? await download(u) : null;
    if (!raw) continue;
    const normalized = await normalizePhoto(raw);
    if (!normalized) continue;
    const scored = await scoreImage(normalized);
    if (!scored) continue;
    // اسکرین‌شات رسمی سایت کمی امتیاز بیشتر
    const score = scored.score * 1.15;
    if (!best || score > best.score) best = { buf: normalized, score };
  }

  // 2) سرچ وب
  const candidates = await collectImageUrls(app);
  for (const url of candidates.slice(0, 16)) {
    const raw = await download(url);
    if (!raw) continue;
    const normalized = await normalizePhoto(raw);
    if (!normalized) continue;
    const scored = await scoreImage(normalized);
    if (!scored) continue;
    if (!best || scored.score > best.score) best = { buf: normalized, score: scored.score };
  }

  if (best) return best.buf;

  const iconUrl = absUrl(app.icon);
  const icon = iconUrl ? await download(iconUrl) : null;
  if (icon) {
    return sharp(icon)
      .resize(1200, 1200, { fit: "contain", background: { r: 12, g: 24, b: 48, alpha: 1 } })
      .jpeg({ quality: 90 })
      .toBuffer();
  }

  throw new Error("عکس مناسبی برای معرفی پیدا نشد");
}

/** تحقیق وب برای ساخت کپشن واقعی‌تر */
export async function researchApp(app: SibApp): Promise<WebSnippet[]> {
  const ddg = new DuckDuckGo();
  const name = (app.name || app.nameFa || app.slug).trim();
  const queries = [`${name} smart features how it works`, `${name} app review features`, brandQuery(app)];
  const out: WebSnippet[] = [];
  const seen = new Set<string>();
  for (const q of queries) {
    try {
      const hits = await ddg.webSearch(q);
      for (const h of hits || []) {
        const title = String(h.title || "").replace(/<[^>]+>/g, "").trim();
        const description = String(h.description || "")
          .replace(/<[^>]+>/g, "")
          .replace(/&nbsp;/g, " ")
          .replace(/&#x27;/g, "'")
          .replace(/&amp;/g, "&")
          .replace(/\s+/g, " ")
          .trim();
        const url = String(h.url || "");
        if (!description || description.length < 40) continue;
        const key = description.slice(0, 80);
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ title, description, url });
        if (out.length >= 6) return out;
      }
    } catch (e) {
      console.warn("webSearch fail", q, e);
    }
  }
  return out;
}
