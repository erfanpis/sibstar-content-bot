/** Daily updates collage — polished poster + HTML caption with app links. */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createCanvas, GlobalFonts, loadImage, type SKRSContext2D } from "@napi-rs/canvas";
import sharp from "sharp";
import { parseCatalogShamsi, shamsiDayTitle, shamsiKey } from "./shamsi.js";
import { absUrl, appPageUrl, type SibApp } from "./sibstar.js";
import { getTemplates } from "./templates.js";

const W = 1080;
const H = 1080;
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const FONTS = join(root, "assets/fonts");
const SIBSTAR_LOGO = join(root, "assets", "sibstar-logo.png");

let fontsReady = false;
function ensureFonts() {
  if (fontsReady) return;
  const map: [string, string][] = [
    ["NotoSansArabic-Bold.ttf", "FaBold"],
    ["NotoSansArabic-Regular.ttf", "FaReg"],
    ["Sahel-Black-FD-WOL.ttf", "BrandFa"],
  ];
  for (const [file, name] of map) {
    const p = join(FONTS, file);
    if (existsSync(p)) GlobalFonts.registerFromPath(p, name);
  }
  try {
    GlobalFonts.registerFromPath("/usr/share/fonts/truetype/noto/NotoSansArabic-Bold.ttf", "FaBold");
    GlobalFonts.registerFromPath("/usr/share/fonts/truetype/noto/NotoSansArabic-Regular.ttf", "FaReg");
  } catch {
    /* ignore */
  }
  fontsReady = true;
}

function roundRect(ctx: SKRSContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

async function loadIcon(app: SibApp, size: number): Promise<Buffer | null> {
  const url = absUrl(app.icon);
  if (!url) return null;
  try {
    const res = await fetch(url, { headers: { "User-Agent": "SibStarChannelBot/1.0" }, redirect: "follow" });
    if (!res.ok) return null;
    const raw = Buffer.from(await res.arrayBuffer());
    if (raw.length < 400) return null;
    const r = Math.round(size * 0.223);
    const icon = await sharp(raw).resize(size, size, { fit: "cover" }).png().toBuffer();
    const mask = Buffer.from(
      `<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="#fff"/></svg>`,
    );
    return sharp(icon)
      .composite([{ input: mask, blend: "dest-in" }])
      .png()
      .toBuffer();
  } catch {
    return null;
  }
}

export async function buildUpdatesCard(apps: SibApp[], date = new Date()): Promise<Buffer> {
  ensureFonts();
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  // clean white studio bg
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  // soft blue wash top
  const wash = ctx.createLinearGradient(0, 0, 0, 420);
  wash.addColorStop(0, "#e8f1ff");
  wash.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, W, 420);

  // decorative rings (lighter)
  ctx.strokeStyle = "rgba(37, 99, 235, 0.10)";
  ctx.lineWidth = 40;
  ctx.beginPath();
  ctx.arc(-40, 300, 220, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(1100, 860, 260, 0, Math.PI * 2);
  ctx.stroke();

  // header card
  ctx.save();
  ctx.shadowColor = "rgba(29, 78, 216, 0.28)";
  ctx.shadowBlur = 32;
  ctx.shadowOffsetY = 14;
  const bx = 100,
    by = 64,
    bw = 880,
    bh = 156;
  roundRect(ctx, bx, by, bw, bh, 36);
  const hg = ctx.createLinearGradient(bx, by, bx + bw, by + bh);
  hg.addColorStop(0, "#1a73e8");
  hg.addColorStop(1, "#1557c0");
  ctx.fillStyle = hg;
  ctx.fill();
  ctx.restore();

  // header texts — Noto (approved)
  ctx.textAlign = "center";
  ctx.direction = "rtl";
  ctx.fillStyle = "#ffffff";
  ctx.font = "60px FaBold";
  ctx.fillText("آپدیت‌های امروز", W / 2, by + 82);
  ctx.font = "28px FaReg";
  ctx.fillStyle = "rgba(255,255,255,0.88)";
  ctx.fillText(shamsiDayTitle(date), W / 2, by + 128);

  // icons
  const take = apps.slice(0, 8);
  const iconSize = 178;
  const gapX = 40;
  const gapY = 44;
  const cols = 4;
  const gridW = cols * iconSize + (cols - 1) * gapX;
  const startX = Math.round((W - gridW) / 2);
  const startY = 292;

  for (let i = 0; i < take.length; i++) {
    const buf = await loadIcon(take[i]!, iconSize);
    if (!buf) continue;
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = startX + col * (iconSize + gapX);
    const y = startY + row * (iconSize + gapY);

    ctx.save();
    ctx.shadowColor = "rgba(15, 23, 42, 0.14)";
    ctx.shadowBlur = 20;
    ctx.shadowOffsetY = 8;
    roundRect(ctx, x, y, iconSize, iconSize, 40);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.restore();

    const img = await loadImage(buf);
    ctx.drawImage(img, x, y, iconSize, iconSize);
  }

  // footer: divider + logo beside brand word (fits in frame)
  const footY = 918;
  ctx.strokeStyle = "rgba(37, 99, 235, 0.35)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(200, footY);
  ctx.lineTo(880, footY);
  ctx.stroke();

  // لوگو + سیب‌استار با فونت برند (Sahel Black)
  const logoSize = 70;
  const y0 = footY + 30;
  const mid = W / 2;
  if (existsSync(SIBSTAR_LOGO)) {
    const logoRaw = await sharp(readFileSync(SIBSTAR_LOGO))
      .resize(logoSize, logoSize, { fit: "cover" })
      .png()
      .toBuffer();
    const lx = mid - 150;
    ctx.save();
    roundRect(ctx, lx, y0, logoSize, logoSize, 18);
    ctx.clip();
    ctx.drawImage(await loadImage(logoRaw), lx, y0, logoSize, logoSize);
    ctx.restore();
  }
  ctx.textAlign = "center";
  ctx.direction = "rtl";
  ctx.fillStyle = "#0b4bb8";
  ctx.font = "52px BrandFa";
  ctx.fillText("سیب‌استار", mid + 55, y0 + 50);

  return canvas.toBuffer("image/jpeg");
}

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function shortBlurb(app: SibApp): string {
  let d = (app.description || "").replace(/\s+/g, " ").trim();
  d = d.replace(/\*+/g, "").replace(/\s{2,}/g, " ").trim();
  if (!d) {
    if (app.isBanking) return "نسخه رسمی خدمات بانکی برای آیفون";
    return app.kind === "game" ? "بازی محبوب برای آیفون" : "برنامه کاربردی برای آیفون";
  }
  let s = d.split(/(?<=[.!?。！؟])\s+|،\s+/)[0] || d;
  s = s.replace(/^[\|\s«»"']+/, "").trim();
  if (s.length > 70) {
    const cut = s.slice(0, 70);
    const sp = cut.lastIndexOf(" ");
    s = (sp > 36 ? cut.slice(0, sp) : cut).trim();
  }
  return s;
}

function tagFor(app: SibApp): string {
  const name = `${app.nameFa} ${app.name}`.toLowerCase();
  if (/premium|پریمیوم/.test(name)) return " · پریمیوم";
  if (app.kind === "game" && /port|پورت/.test(name)) return " · پورت شده";
  return "";
}

/** HTML caption — app names are tappable links to SibStar pages. */
export function updatesCaption(apps: SibApp[], date = new Date()): string {
  const t = getTemplates();
  const lines: string[] = [t.updatesTitle, "", t.updatesListHeader, ""];
  for (const app of apps.slice(0, 8)) {
    const kind = app.kind === "game" ? "🎮 بازی" : "📱 برنامه";
    const tag = tagFor(app);
    const ver = app.version ? ` — <code>v.${escHtml(app.version)}</code>` : "";
    const href = appPageUrl(app.slug);
    const title = escHtml(app.nameFa || app.name);
    lines.push(`${kind} <a href="${href}"><b>${title}</b></a>${escHtml(tag)}`);
    lines.push(`${escHtml(shortBlurb(app))}${ver}`);
    lines.push("");
  }
  lines.push(`📆 ${escHtml(shamsiDayTitle(date))}`);
  lines.push("");
  lines.push(t.updatesFooterNote);
  return lines.join("\n").trim();
}

/** آپدیت‌های واقعی امروز بر اساس lastUpdated شمسی کاتالوگ */
export function appsUpdatedToday(all: SibApp[], date = new Date()): SibApp[] {
  const today = shamsiKey(date);
  return all
    .filter((a) => {
      const p = parseCatalogShamsi(a.lastUpdated);
      return !!p && p.key === today && !!a.icon;
    })
    .sort((a, b) => {
      // بازی/برنامه مخلوط، نام فارسی
      if (a.kind !== b.kind) return a.kind === "game" ? -1 : 1;
      return (a.nameFa || a.name).localeCompare(b.nameFa || b.name, "fa");
    });
}

/** انتخاب تصادفی فقط وقتی لیست امروز خالی است (پشتیبان) */
export function pickUpdateApps(all: SibApp[], count = 8): SibApp[] {
  const today = appsUpdatedToday(all);
  if (today.length) return today.slice(0, count);

  const withIcon = all.filter((a) => a.icon);
  const copy = [...withIcon];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy.slice(0, count);
}
