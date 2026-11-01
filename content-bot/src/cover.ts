/**
 * کاور آپدیت — قالب رسمی SibStar با تم رنگی استخراج‌شده از آیکون.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { themeFromIcon } from "./iconTheme.js";
import { absUrl, type SibApp } from "./sibstar.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const TPL = join(root, "assets", "update-template");
const TEMPLATE_SVG = join(TPL, "template.svg");
const LOGO_PNG = join(TPL, "sibstar-logo.png");

function esc(value: string): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function dataUri(buffer: Buffer, mime: string): string {
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

async function fetchIconRaw(app: SibApp): Promise<Buffer | null> {
  const url = absUrl(app.icon);
  if (!url) return null;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "SibStarChannelBot/1.0" },
      redirect: "follow",
    });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.length < 400 ? null : buf;
  } catch {
    return null;
  }
}

/** ساخت کاور 1536×1024 از قالب رسمی + پالت آیکون */
export async function buildCover(app: SibApp): Promise<Buffer> {
  const logo = readFileSync(LOGO_PNG);
  let svg = readFileSync(TEMPLATE_SVG, "utf8");

  const iconRaw = await fetchIconRaw(app);
  const iconBuffer = iconRaw
    ? await sharp(iconRaw).rotate().resize(410, 410, { fit: "cover", position: "centre" }).png().toBuffer()
    : await sharp({
        create: { width: 410, height: 410, channels: 4, background: { r: 20, g: 40, b: 90, alpha: 1 } },
      })
        .png()
        .toBuffer();

  const theme = await themeFromIcon(iconBuffer);

  const appName = (app.nameFa || app.name || "برنامه").trim();
  const appNameEn = (app.name || "").trim();
  const version = String(app.version || "—").replace(/^v/i, "");
  const typeLabel = app.isBanking ? "بانکی" : app.kind === "game" ? "بازی" : "برنامه";
  const appNameSize = Math.max(34, Math.min(58, Math.floor(58 - Math.max(0, appName.length - 13) * 1.7)));
  const isPersianName = /[\u0600-\u06FF]/.test(appName);
  const appNameAnchor = isPersianName ? "start" : "end";
  const appNameDirection = isPersianName ? "rtl" : "ltr";

  const appIconElement = `<image x="166" y="385" width="382" height="382" preserveAspectRatio="xMidYMid slice" clip-path="url(#appIconClip)" href="${dataUri(iconBuffer, "image/png")}" xlink:href="${dataUri(iconBuffer, "image/png")}"/>`;

  const replacements: Record<string, string> = {
    "{{LOGO_DATA_URI}}": dataUri(logo, "image/png"),
    "{{APP_ICON_ELEMENT}}": appIconElement,
    "{{APP_NAME}}": esc(appName),
    "{{APP_NAME_EN}}": esc(appNameEn && appNameEn !== appName ? appNameEn : ""),
    "{{APP_NAME_SIZE}}": String(appNameSize),
    "{{APP_NAME_ANCHOR}}": appNameAnchor,
    "{{APP_NAME_DIRECTION}}": appNameDirection,
    "{{VERSION}}": esc(version),
    "{{TYPE_LABEL}}": esc(typeLabel),
    // adaptive theme from icon
    "{{BG_0}}": theme.bg0,
    "{{BG_1}}": theme.bg1,
    "{{BG_2}}": theme.bg2,
    "{{GLOW_A}}": theme.glowA,
    "{{GLOW_A_MID}}": theme.glowAMid,
    "{{GLOW_A_DEEP}}": theme.glowADeep,
    "{{GLOW_B}}": theme.glowB,
    "{{GLOW_B_MID}}": theme.glowBMid,
    "{{GLOW_B_DEEP}}": theme.glowBDeep,
    "{{GLASS_0}}": theme.glass0,
    "{{GLASS_1}}": theme.glass1,
    "{{GLASS_2}}": theme.glass2,
    "{{RIM_0}}": theme.rim0,
    "{{RIM_1}}": theme.rim1,
    "{{RIM_2}}": theme.rim2,
    "{{RIM_3}}": theme.rim3,
    "{{UPDATE_0}}": theme.update0,
    "{{UPDATE_1}}": theme.update1,
    "{{UPDATE_2}}": theme.update2,
    "{{PILL_0}}": theme.pill0,
    "{{PILL_1}}": theme.pill1,
    "{{ICONBG_0}}": theme.iconBg0,
    "{{ICONBG_1}}": theme.iconBg1,
    "{{ICONBG_2}}": theme.iconBg2,
    "{{RIBBON_0}}": theme.ribbon0,
    "{{RIBBON_1}}": theme.ribbon1,
    "{{RIBBON_2}}": theme.ribbon2,
    "{{RIBBON_3}}": theme.ribbon3,
    "{{ORB_A}}": theme.orbA,
    "{{ORB_B}}": theme.orbB,
    "{{ORB_C}}": theme.orbC,
    "{{ARC_A}}": theme.arcA,
    "{{ARC_B}}": theme.arcB,
    "{{ARC_C}}": theme.arcC,
    "{{RIBBON_STROKE_A}}": theme.ribbonStrokeA,
    "{{RIBBON_STROKE_B}}": theme.ribbonStrokeB,
    "{{DOT_A}}": theme.dotA,
    "{{DOT_B}}": theme.dotB,
    "{{BRAND_LINE}}": theme.brandLine,
    "{{BRAND_SUB}}": theme.brandSub,
    "{{BRAND_MUTED}}": theme.brandMuted,
    "{{BRAND_RULE}}": theme.brandRule,
    "{{STAGE_FILL}}": theme.stageFill,
    "{{STAGE_STROKE}}": theme.stageStroke,
    "{{STAGE_ARC_A}}": theme.stageArcA,
    "{{STAGE_ARC_B}}": theme.stageArcB,
    "{{PEDESTAL_FILL}}": theme.pedestalFill,
    "{{PEDESTAL_STROKE}}": theme.pedestalStroke,
    "{{ICON_WELL}}": theme.iconWell,
    "{{ICON_WELL_STROKE}}": theme.iconWellStroke,
    "{{ICON_RIM}}": theme.iconRim,
    "{{ICON_SHINE}}": theme.iconShine,
    "{{PEDESTAL_GLOW}}": theme.pedestalGlow,
    "{{UPDATE_INNER}}": theme.updateInner,
    "{{UPDATE_INNER_STROKE}}": theme.updateInnerStroke,
    "{{UPDATE_DISC}}": theme.updateDisc,
    "{{UPDATE_DISC_STROKE}}": theme.updateDiscStroke,
    "{{UPDATE_SUB}}": theme.updateSub,
    "{{META_FILL}}": theme.metaFill,
    "{{META_STROKE}}": theme.metaStroke,
    "{{META_INNER_STROKE}}": theme.metaInnerStroke,
    "{{META_SUB}}": theme.metaSub,
    "{{META_RULE}}": theme.metaRule,
    "{{META_LABEL}}": theme.metaLabel,
    "{{CHIP_FILL}}": theme.chipFill,
    "{{CHIP_STROKE}}": theme.chipStroke,
    "{{IOS_FILL}}": theme.iosFill,
    "{{IOS_STROKE}}": theme.iosStroke,
    "{{FOOTER_RULE}}": theme.footerRule,
    "{{FOOTER_TEXT}}": theme.footerText,
  };
  for (const [token, value] of Object.entries(replacements)) {
    svg = svg.replaceAll(token, value);
  }

  return sharp(Buffer.from(svg)).jpeg({ quality: 94, mozjpeg: true }).toBuffer();
}
