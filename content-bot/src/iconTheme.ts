/**
 * استخراج پالت از آیکون اپ و ساخت تم سینمایی برای پس‌زمینهٔ قالب.
 */
import sharp from "sharp";

export type Rgb = { r: number; g: number; b: number };

export type IconTheme = {
  bg0: string;
  bg1: string;
  bg2: string;
  glowA: string;
  glowAMid: string;
  glowADeep: string;
  glowB: string;
  glowBMid: string;
  glowBDeep: string;
  glass0: string;
  glass1: string;
  glass2: string;
  rim0: string;
  rim1: string;
  rim2: string;
  rim3: string;
  update0: string;
  update1: string;
  update2: string;
  pill0: string;
  pill1: string;
  iconBg0: string;
  iconBg1: string;
  iconBg2: string;
  ribbon0: string;
  ribbon1: string;
  ribbon2: string;
  ribbon3: string;
  orbA: string;
  orbB: string;
  orbC: string;
  arcA: string;
  arcB: string;
  arcC: string;
  ribbonStrokeA: string;
  ribbonStrokeB: string;
  dotA: string;
  dotB: string;
  brandLine: string;
  brandSub: string;
  brandMuted: string;
  brandRule: string;
  stageFill: string;
  stageStroke: string;
  stageArcA: string;
  stageArcB: string;
  pedestalFill: string;
  pedestalStroke: string;
  iconWell: string;
  iconWellStroke: string;
  iconRim: string;
  iconShine: string;
  pedestalGlow: string;
  updateInner: string;
  updateInnerStroke: string;
  updateDisc: string;
  updateDiscStroke: string;
  updateSub: string;
  metaFill: string;
  metaStroke: string;
  metaInnerStroke: string;
  metaSub: string;
  metaRule: string;
  metaLabel: string;
  chipFill: string;
  chipStroke: string;
  iosFill: string;
  iosStroke: string;
  footerRule: string;
  footerText: string;
};

function clamp(n: number, a = 0, b = 255) {
  return Math.max(a, Math.min(b, Math.round(n)));
}

function hex({ r, g, b }: Rgb): string {
  return `#${[r, g, b].map((x) => clamp(x).toString(16).padStart(2, "0")).join("")}`;
}

function rgbToHsl({ r, g, b }: Rgb): { h: number; s: number; l: number } {
  const R = r / 255;
  const G = g / 255;
  const B = b / 255;
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === R) h = ((G - B) / d + (G < B ? 6 : 0)) / 6;
  else if (max === G) h = ((B - R) / d + 2) / 6;
  else h = ((R - G) / d + 4) / 6;
  return { h, s, l };
}

function hue2rgb(p: number, q: number, t: number) {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}

function hslToRgb(h: number, s: number, l: number): Rgb {
  if (s === 0) {
    const v = clamp(l * 255);
    return { r: v, g: v, b: v };
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return {
    r: clamp(hue2rgb(p, q, h + 1 / 3) * 255),
    g: clamp(hue2rgb(p, q, h) * 255),
    b: clamp(hue2rgb(p, q, h - 1 / 3) * 255),
  };
}

function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  };
}

function withL(c: Rgb, l: number, sMul = 1): Rgb {
  const hsl = rgbToHsl(c);
  return hslToRgb(hsl.h, Math.min(1, hsl.s * sMul), Math.max(0, Math.min(1, l)));
}

function dist(a: Rgb, b: Rgb) {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

type Bucket = { color: Rgb; weight: number; sat: number };

/** کوانتایز + وزن‌دهی: رنگ‌های اشباع‌شده و میانی اولویت دارند */
export async function extractIconPalette(icon: Buffer, k = 5): Promise<Rgb[]> {
  const { data, info } = await sharp(icon)
    .rotate()
    .resize(56, 56, { fit: "cover" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const map = new Map<string, Bucket>();
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3]!;
    if (a < 40) continue;
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    // کوانتایز ۸ بیتی → ۵ بیتی برای خوشه‌بندی پایدار
    const qr = r >> 3;
    const qg = g >> 3;
    const qb = b >> 3;
    const key = `${qr},${qg},${qb}`;
    const rgb = { r, g, b };
    const { s, l } = rgbToHsl(rgb);
    // سفید/سیاه خالص وزن کمتر — مگر غالب باشند
    const extreme = l < 0.06 || l > 0.92;
    const w = (extreme ? 0.25 : 1) * (0.35 + s) * (a / 255);
    const prev = map.get(key);
    if (prev) {
      prev.weight += w;
      prev.color = mix(prev.color, rgb, w / (prev.weight + w));
      prev.sat = Math.max(prev.sat, s);
    } else map.set(key, { color: rgb, weight: w, sat: s });
  }

  const sorted = [...map.values()].sort((a, b) => b.weight * (0.5 + b.sat) - a.weight * (0.5 + a.sat));
  const picks: Rgb[] = [];
  for (const item of sorted) {
    if (picks.some((p) => dist(p, item.color) < 42)) continue;
    picks.push({
      r: clamp(item.color.r),
      g: clamp(item.color.g),
      b: clamp(item.color.b),
    });
    if (picks.length >= k) break;
  }

  if (!picks.length) return [{ r: 22, g: 80, b: 180 }, { r: 90, g: 50, b: 180 }, { r: 180, g: 200, b: 255 }];
  while (picks.length < 3) picks.push(mix(picks[0]!, { r: 255, g: 255, b: 255 }, 0.25));
  return picks;
}

function hueDist(a: number, b: number) {
  const d = Math.abs(a - b);
  return Math.min(d, 1 - d);
}

export function themeFromPalette(palette: Rgb[]): IconTheme {
  // غالب: بیشترین وزنِ اشباع؛ ثانویه: دورترین هیو با وزن قابل‌قبول (برای آیکون‌های دو رنگ)
  const scored = [...palette].map((c) => {
    const hsl = rgbToHsl(c);
    return { c, hsl, score: hsl.s * (0.55 + (1 - Math.abs(hsl.l - 0.45))) };
  });
  scored.sort((a, b) => b.score - a.score);
  const dominant = scored[0]!.c;
  const dH = scored[0]!.hsl.h;
  const secondaryPick =
    scored.find((x) => hueDist(x.hsl.h, dH) > 0.14 && x.hsl.s > 0.12)?.c ||
    scored[1]?.c ||
    mix(dominant, { r: 40, g: 40, b: 60 }, 0.4);
  const secondary = secondaryPick;
  const highlight =
    [...palette].sort((a, b) => rgbToHsl(b).l - rgbToHsl(a).l)[0] || mix(dominant, { r: 255, g: 255, b: 255 }, 0.45);

  const d = rgbToHsl(dominant);
  const s = rgbToHsl(secondary);
  // پس‌زمینهٔ خیلی تیره از هیو آیکون — نه آبی ثابت
  const bg0 = withL(dominant, 0.07, 1.15);
  const bg1 = withL(mix(dominant, secondary, 0.35), 0.13, 1.1);
  const bg2 = withL(secondary, 0.06, 1.05);

  const glowA = withL(dominant, Math.max(0.42, Math.min(0.58, d.l + 0.08)), 1.25);
  const glowAMid = withL(dominant, 0.32, 1.1);
  const glowADeep = withL(dominant, 0.14, 1.0);
  const glowB = withL(secondary, Math.max(0.4, Math.min(0.56, s.l + 0.05)), 1.2);
  const glowBMid = withL(secondary, 0.3, 1.05);
  const glowBDeep = withL(secondary, 0.12, 1.0);

  const glass0 = withL(highlight, 0.86, 0.55);
  const glass1 = withL(dominant, 0.48, 0.9);
  const glass2 = withL(mix(highlight, secondary, 0.4), 0.82, 0.5);

  const rim0 = withL(highlight, 0.92, 0.4);
  const rim1 = withL(dominant, 0.62, 1.1);
  const rim2 = withL(secondary, 0.55, 1.05);
  const rim3 = withL(mix(highlight, secondary, 0.5), 0.84, 0.55);

  const update0 = withL(dominant, 0.42, 1.2);
  const update1 = withL(dominant, 0.28, 1.05);
  const update2 = withL(secondary, 0.38, 1.15);

  const pill0 = withL(dominant, 0.45, 1.1);
  const pill1 = withL(secondary, 0.4, 1.05);

  const iconBg0 = withL(dominant, 0.55, 1.0);
  const iconBg1 = withL(dominant, 0.32, 1.0);
  const iconBg2 = withL(secondary, 0.5, 0.95);

  const ribbon0 = withL(highlight, 0.7, 0.8);
  const ribbon1 = withL(dominant, 0.58, 1.0);
  const ribbon2 = withL(secondary, 0.5, 1.0);
  const ribbon3 = withL(mix(highlight, secondary, 0.5), 0.75, 0.7);

  const softInk = withL(dominant, 0.12, 0.9);
  const softStroke = withL(mix(highlight, dominant, 0.3), 0.82, 0.45);
  const softBlueish = withL(mix(dominant, highlight, 0.35), 0.78, 0.55);

  return {
    bg0: hex(bg0),
    bg1: hex(bg1),
    bg2: hex(bg2),
    glowA: hex(glowA),
    glowAMid: hex(glowAMid),
    glowADeep: hex(glowADeep),
    glowB: hex(glowB),
    glowBMid: hex(glowBMid),
    glowBDeep: hex(glowBDeep),
    glass0: hex(glass0),
    glass1: hex(glass1),
    glass2: hex(glass2),
    rim0: hex(rim0),
    rim1: hex(rim1),
    rim2: hex(rim2),
    rim3: hex(rim3),
    update0: hex(update0),
    update1: hex(update1),
    update2: hex(update2),
    pill0: hex(pill0),
    pill1: hex(pill1),
    iconBg0: hex(iconBg0),
    iconBg1: hex(iconBg1),
    iconBg2: hex(iconBg2),
    ribbon0: hex(ribbon0),
    ribbon1: hex(ribbon1),
    ribbon2: hex(ribbon2),
    ribbon3: hex(ribbon3),
    orbA: hex(glowA),
    orbB: hex(glowB),
    orbC: hex(withL(dominant, 0.45, 0.9)),
    arcA: hex(withL(dominant, 0.72, 0.7)),
    arcB: hex(withL(secondary, 0.7, 0.65)),
    arcC: hex(withL(dominant, 0.65, 0.8)),
    ribbonStrokeA: hex(withL(dominant, 0.7, 0.75)),
    ribbonStrokeB: hex(withL(highlight, 0.75, 0.55)),
    dotA: hex(withL(highlight, 0.88, 0.4)),
    dotB: hex(withL(secondary, 0.8, 0.5)),
    brandLine: hex(softStroke),
    brandSub: hex(softBlueish),
    brandMuted: hex(withL(dominant, 0.72, 0.55)),
    brandRule: hex(withL(dominant, 0.7, 0.5)),
    stageFill: hex(softInk),
    stageStroke: hex(softStroke),
    stageArcA: hex(withL(highlight, 0.9, 0.3)),
    stageArcB: hex(withL(dominant, 0.72, 0.45)),
    pedestalFill: hex(withL(dominant, 0.18, 1.0)),
    pedestalStroke: hex(softStroke),
    iconWell: hex(withL(dominant, 0.12, 0.95)),
    iconWellStroke: hex(softStroke),
    iconRim: hex(withL(highlight, 0.9, 0.35)),
    iconShine: hex(withL(highlight, 0.95, 0.25)),
    pedestalGlow: hex(glowA),
    updateInner: hex(withL(dominant, 0.2, 1.0)),
    updateInnerStroke: hex(softStroke),
    updateDisc: hex(withL(dominant, 0.4, 1.15)),
    updateDiscStroke: hex(softStroke),
    updateSub: hex(softBlueish),
    metaFill: hex(withL(mix(dominant, secondary, 0.3), 0.11, 0.95)),
    metaStroke: hex(softStroke),
    metaInnerStroke: hex(withL(highlight, 0.9, 0.3)),
    metaSub: hex(softBlueish),
    metaRule: hex(softStroke),
    metaLabel: hex(withL(mix(highlight, dominant, 0.2), 0.88, 0.35)),
    chipFill: hex(withL(dominant, 0.28, 0.95)),
    chipStroke: hex(softStroke),
    iosFill: hex(withL(dominant, 0.22, 0.9)),
    iosStroke: hex(softStroke),
    footerRule: hex(withL(dominant, 0.68, 0.45)),
    footerText: hex(softBlueish),
  };
}

export async function themeFromIcon(icon: Buffer): Promise<IconTheme> {
  const palette = await extractIconPalette(icon);
  return themeFromPalette(palette);
}
