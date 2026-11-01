/** Read published SibStar catalog (public API). */

export type SibApp = {
  id: string;
  slug: string;
  name: string;
  nameFa: string;
  categories: string[];
  category: string;
  primaryCategorySlug: string;
  description: string;
  version: string;
  lastUpdated: string;
  whatsNew: string;
  icon: string;
  screenshots: string[];
  status: string;
  kind: "game" | "app";
  isBanking: boolean;
};

export type CatMeta = {
  slug: string;
  label: string;
  parentLabel: string;
};

const DEFAULT_BASE = "https://beta.sibstars.ir";

function base(): string {
  return (process.env.SIBSTAR_BASE_URL || DEFAULT_BASE).replace(/\/$/, "");
}

export function absUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  if (!path.startsWith("/")) return `${base()}/${path}`;
  return `${base()}${path}`;
}

export function appPageUrl(slug: string): string {
  return `${base()}/app/${encodeURIComponent(slug)}`;
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${base()}${path}`, {
    headers: { Accept: "application/json", "User-Agent": "SibStarChannelBot/1.0" },
  });
  if (!res.ok) throw new Error(`SibStar ${path} → ${res.status}`);
  return (await res.json()) as T;
}

export async function fetchCategories(): Promise<CatMeta[]> {
  const data = await getJson<{ categories: CatMeta[] }>("/api/categories");
  return (data.categories || []).map((c) => ({
    slug: c.slug,
    label: c.label,
    parentLabel: c.parentLabel || "",
  }));
}

function classifyMaps(cats: CatMeta[]) {
  const gameSlugs = new Set<string>();
  const appSlugs = new Set<string>();
  const bankSlugs = new Set<string>();
  for (const c of cats) {
    const parent = c.parentLabel || "";
    if (parent.includes("بازی")) gameSlugs.add(c.slug);
    if (parent.includes("برنامه")) appSlugs.add(c.slug);
    if ((c.label || "").includes("بانک") || c.slug === "finance") bankSlugs.add(c.slug);
  }
  // known game fallbacks if parentLabel missing
  for (const s of ["action", "online", "racing", "sport", "adventure", "puzzle", "survive", "arcade", "defense", "record", "emulate", "irani"]) {
    gameSlugs.add(s);
  }
  bankSlugs.add("finance");
  bankSlugs.add("financialaffairs");
  return { gameSlugs, appSlugs, bankSlugs };
}

export async function fetchCatalog(): Promise<SibApp[]> {
  const [cats, appsData] = await Promise.all([
    fetchCategories(),
    getJson<{ apps: Record<string, unknown>[] }>("/api/apps"),
  ]);
  const { gameSlugs, bankSlugs } = classifyMaps(cats);
  const out: SibApp[] = [];
  for (const raw of appsData.apps || []) {
    if (String(raw.status || "") !== "published") continue;
    const slug = String(raw.slug || "");
    if (!slug) continue;
    const primary = String(raw.primaryCategorySlug || "");
    const categories = Array.isArray(raw.categories) ? raw.categories.map(String) : [];
    const isGame = gameSlugs.has(primary) || categories.some((c) =>
      ["اکشن", "آنلاین", "رانندگی", "ماجراجویی", "زامبی", "آرکید", "استراتژیک", "ورزشی", "فکری", "سرگرمی"].some((g) => c.includes(g)),
    );
    const isBanking =
      bankSlugs.has(primary) ||
      categories.some((c) => c.includes("بانک")) ||
      String(raw.category || "").includes("بانک");
    out.push({
      id: String(raw.id || ""),
      slug,
      name: String(raw.name || ""),
      nameFa: String(raw.nameFa || raw.name || slug),
      categories,
      category: String(raw.category || ""),
      primaryCategorySlug: primary,
      description: String(raw.description || ""),
      version: String(raw.version || ""),
      lastUpdated: String(raw.lastUpdated || ""),
      whatsNew: String(raw.whatsNew || ""),
      icon: String(raw.icon || ""),
      screenshots: Array.isArray(raw.screenshots) ? raw.screenshots.map(String) : [],
      status: String(raw.status || ""),
      kind: isGame ? "game" : "app",
      isBanking,
    });
  }
  return out;
}

export function fingerprint(app: SibApp): string {
  return `${app.version}|${app.lastUpdated}|${(app.whatsNew || "").slice(0, 80)}`;
}

export function pickIconUrl(app: SibApp): string | null {
  return absUrl(app.icon);
}
