import { Bot, InlineKeyboard, InputFile, Keyboard } from "grammy";
import { bankUpdateCaption, introCaption, updateReleaseCaption } from "./captions.js";
import { config } from "./config.js";
import { buildCover } from "./cover.js";
import { findBestIntroPhoto, researchApp } from "./introMedia.js";
import { fingerprint, fetchCatalog, appPageUrl, type SibApp } from "./sibstar.js";
import { loadState, saveState } from "./state.js";
import { shamsiDayTitle, shamsiKey } from "./shamsi.js";
import { appsUpdatedToday, buildUpdatesCard, updatesCaption } from "./updatesCard.js";
import { publishViaUser, userPosterConfigured } from "./userChannel.js";

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

type Pending = {
  caption: string;
  cover: Buffer;
  mode: "intro" | "update" | "bank" | "updates";
  app?: SibApp;
  parseMode?: "HTML";
};

type AwaitKind = "update_q" | "intro_q" | "watch_add" | "watch_del";

const pending = new Map<number, Pending>();
const awaiting = new Map<number, AwaitKind>();
/** انتخاب اپ‌ها برای کلاژ آپدیت امروز */
const todayDraft = new Map<number, { day: string; selected: Set<string>; list: SibApp[] }>();

const BTN = {
  today: "1️⃣ آپدیت‌های امروز",
  update: "2️⃣ آپدیت تکی",
  intro: "3️⃣ معرفی",
  menu: "📋 راهنما",
} as const;

function isAdmin(userId?: number): boolean {
  return !!userId && config.adminIds.includes(userId);
}

function mainKeyboard() {
  return new Keyboard()
    .text(BTN.today)
    .row()
    .text(BTN.update)
    .row()
    .text(BTN.intro)
    .row()
    .text(BTN.menu)
    .resized()
    .persistent();
}

function helpText(): string {
  return [
    "🛠 مدیریت کانال سیب‌استار",
    "",
    "حالت آزمایشی: هیچ پستی خودکار نمی‌ره — فقط بعد از ✅ خودت.",
    "ارسال روی کانال اصلی است؛ برای مخفی‌بودن ربات در ادمین‌ها Anonymous را روشن کن.",
    "",
    "سه بخش جدا:",
    "",
    `${BTN.today}`,
    "→ لیست واقعی آپدیت‌های امروز · تیک بزن · ساخت کلاژ",
    "",
    `${BTN.update}`,
    "→ اسم/لینک بده · پست آپدیت تکی با کاور رسمی",
    "",
    `${BTN.intro}`,
    "→ اسم بفرست یا تصادفی · کپشن داستانی + عکس خوب",
    "",
    "بعد از پیش‌نمایش همان زیر پست ✅ / ❌ بزن.",
  ].join("\n");
}

async function registerAdminCommands(bot: Bot) {
  await bot.api.setMyCommands([
    { command: "start", description: "منوی ۳ بخشی" },
    { command: "today", description: "آپدیت‌های امروز" },
    { command: "update", description: "آپدیت تکی" },
    { command: "intro", description: "معرفی" },
    { command: "status", description: "وضعیت" },
  ]);
}

async function makePending(app: SibApp, mode: "intro" | "update" | "bank"): Promise<Pending> {
  const link = appPageUrl(app.slug);
  if (mode === "intro") {
    const [research, photo] = await Promise.all([researchApp(app), findBestIntroPhoto(app)]);
    const caption = await introCaption(app, link, config.aiCaptions, research);
    return { app, caption, cover: photo, mode, parseMode: "HTML" };
  }
  const caption =
    mode === "bank" || app.isBanking
      ? await bankUpdateCaption(app, link, config.aiCaptions)
      : updateReleaseCaption(app, link);
  const cover = await buildCover(app);
  return { app, caption, cover, mode: app.isBanking && mode === "update" ? "bank" : mode, parseMode: "HTML" };
}

const CAPTION_LIMIT = 1024;

async function preview(
  ctx: { reply: (t: string, extra?: object) => Promise<unknown>; replyWithPhoto: Function; from?: { id: number } },
  p: Pending,
) {
  pending.set(ctx.from!.id, p);
  const kb = new InlineKeyboard().text("✅ ارسال به کانال", "publish").text("❌ لغو", "cancel");
  const extra = p.parseMode
    ? { parse_mode: p.parseMode as "HTML", link_preview_options: { is_disabled: true } }
    : {};
  if (p.caption.length <= CAPTION_LIMIT) {
    await ctx.replyWithPhoto(new InputFile(p.cover, "cover.jpg"), {
      caption: p.caption,
      reply_markup: kb,
      ...extra,
    });
  } else {
    await ctx.replyWithPhoto(new InputFile(p.cover, "cover.jpg"), { reply_markup: kb });
    await ctx.reply(p.caption.slice(0, 4000), extra);
  }
}

function pickNextIntro(apps: SibApp[]): SibApp | null {
  const st = loadState();
  const used = new Set(st.introducedIds);
  const pool = apps.filter((a) => a.kind === st.nextKind && !used.has(a.id));
  const fallback = apps.filter((a) => a.kind === st.nextKind);
  const list = pool.length ? pool : fallback;
  if (!list.length) return null;
  const withIcon = list.filter((a) => a.icon);
  const src = withIcon.length ? withIcon : list;
  return src[Math.floor(Math.random() * src.length)]!;
}

function parseSlug(input: string): string | null {
  const t = input.trim();
  if (!t) return null;
  const m = t.match(/\/app\/([a-zA-Z0-9._-]+)/i);
  if (m?.[1]) return m[1];
  if (/^[a-zA-Z0-9._-]+$/.test(t)) return t;
  return null;
}

function searchApps(apps: SibApp[], qRaw: string): SibApp[] {
  const q = qRaw.trim().toLowerCase();
  if (!q) return [];
  return apps
    .map((a) => {
      const name = (a.name || "").toLowerCase();
      const fa = (a.nameFa || "").toLowerCase();
      const slug = a.slug.toLowerCase();
      let score = 0;
      if (name === q || fa === q || slug === q) score = 100;
      else if (name.startsWith(q) || fa.startsWith(q) || slug.startsWith(q)) score = 80;
      else if (name.includes(q) || fa.includes(q) || slug.includes(q)) score = 50;
      else if (`${name} ${fa} ${slug}`.includes(q)) score = 30;
      return { app: a, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map((x) => x.app);
}

export async function buildDailyIntro(): Promise<Pending | null> {
  const apps = await fetchCatalog();
  const app = pickNextIntro(apps);
  if (!app) return null;
  return makePending(app, "intro");
}

export async function buildFromSlug(slugOrUrl: string, mode: "update" | "intro" = "update"): Promise<Pending | null> {
  const slug = parseSlug(slugOrUrl);
  if (!slug) return null;
  const apps = await fetchCatalog();
  const app = apps.find((a) => a.slug.toLowerCase() === slug.toLowerCase());
  if (!app) return null;
  return makePending(app, mode);
}

export async function buildUpdatesDigest(selected?: SibApp[]): Promise<Pending> {
  const all = await fetchCatalog();
  const today = appsUpdatedToday(all);
  const picked = (selected && selected.length ? selected : today.slice(0, 8)).filter((a) => a.icon).slice(0, 8);
  if (picked.length < 1) throw new Error("برای امروز آپدیتی با آیکون پیدا نشد");
  if (picked.length < 4 && !selected) {
    // کمتر از ۴ تا ولی واقعی — باز هم بساز
  }
  const cover = await buildUpdatesCard(picked);
  const caption = updatesCaption(picked);
  return { mode: "updates", cover, caption, parseMode: "HTML" };
}

export async function buildBankUpdates(limit = 5): Promise<Pending[]> {
  const apps = await fetchCatalog();
  const banks = apps.filter((a) => a.isBanking);
  const st = loadState();
  const out: Pending[] = [];
  for (const app of banks) {
    const fp = fingerprint(app);
    const prev = st.banking[app.id];
    if (!prev) {
      st.banking[app.id] = fp;
      continue;
    }
    if (prev === fp) continue;
    st.banking[app.id] = fp;
    out.push(await makePending(app, "bank"));
    if (out.length >= limit) break;
  }
  st.lastBankCheckAt = new Date().toISOString();
  saveState(st);
  return out;
}

async function publishPending(
  api: Bot["api"],
  reply: (t: string) => Promise<unknown>,
  p: Pending,
  adminId?: number,
) {
  try {
    let via: "user" | "bot" = "bot";
    if (userPosterConfigured()) {
      const ok = await publishViaUser(p.cover, p.caption);
      if (ok) via = "user";
    }
    if (via === "bot") {
      const html =
        p.parseMode === "HTML"
          ? ({ parse_mode: "HTML" as const, link_preview_options: { is_disabled: true } })
          : {};
      if (p.caption.length <= CAPTION_LIMIT) {
        await api.sendPhoto(config.channelId, new InputFile(p.cover, "cover.jpg"), {
          caption: p.caption,
          ...html,
        });
      } else {
        await api.sendPhoto(config.channelId, new InputFile(p.cover, "cover.jpg"));
        await api.sendMessage(config.channelId, p.caption.slice(0, 4000), html);
      }
    }
    if (p.mode === "intro" && p.app) {
      const st = loadState();
      st.introducedIds = [...st.introducedIds.filter((id) => id !== p.app!.id), p.app.id].slice(-800);
      st.nextKind = st.nextKind === "game" ? "app" : "game";
      st.lastDailyAt = new Date().toISOString();
      saveState(st);
    }
    if (p.mode === "updates") {
      const st = loadState();
      st.lastDailyAt = new Date().toISOString();
      saveState(st);
    }
    if (adminId) {
      pending.delete(adminId);
      todayDraft.delete(adminId);
    }
    await reply("✅ ارسال شد به کانال.");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await reply(`خطا در ارسال:\n${msg.slice(0, 400)}`);
  }
}

function todayPickerKeyboard(draft: { selected: Set<string>; list: SibApp[] }) {
  const kb = new InlineKeyboard();
  const show = draft.list.slice(0, 16);
  for (const a of show) {
    const mark = draft.selected.has(a.slug) ? "✅" : "⬜️";
    const title = `${mark} ${(a.nameFa || a.name).slice(0, 28)}`;
    kb.text(title, `tog:${a.slug}`.slice(0, 64)).row();
  }
  kb.text(`🛠 ساخت پست (${draft.selected.size}/8)`, "today:build").row();
  kb.text("۸تای اول", "today:top8").text("پاک کردن تیک‌ها", "today:clear").row();
  if (draft.list.length > 16) {
    kb.text(`+${draft.list.length - 16} مورد دیگر در لیست متنی`, "today:noop");
  }
  return kb;
}

async function openTodayPicker(
  ctx: { reply: (t: string, extra?: object) => Promise<unknown>; from?: { id: number } },
) {
  const all = await fetchCatalog();
  const list = appsUpdatedToday(all);
  const day = shamsiKey();
  if (!list.length) {
    await ctx.reply(`امروز (${shamsiDayTitle()}) آپدیت جدیدی در کاتالوگ نیست.`, {
      reply_markup: mainKeyboard(),
    });
    return;
  }
  const pre = new Set(list.slice(0, Math.min(8, list.length)).map((a) => a.slug));
  todayDraft.set(ctx.from!.id, { day, selected: pre, list });
  const lines = list.slice(0, 24).map((a, i) => {
    const kind = a.kind === "game" ? "🎮" : "📱";
    const ver = a.version ? ` v${a.version}` : "";
    return `${i + 1}. ${kind} <b>${escHtml(a.nameFa || a.name)}</b>${escHtml(ver)}`;
  });
  await ctx.reply(
    [
      `📣 آپدیت‌های واقعی امروز — <b>${escHtml(shamsiDayTitle())}</b>`,
      `تعداد: <b>${list.length}</b>`,
      "",
      lines.join("\n"),
      list.length > 24 ? `\n… و ${list.length - 24} مورد دیگر` : "",
      "",
      "از دکمه‌ها تیک بزن (حداکثر ۸) بعد «ساخت پست» را بزن.",
    ]
      .filter(Boolean)
      .join("\n"),
    {
      parse_mode: "HTML",
      reply_markup: todayPickerKeyboard(todayDraft.get(ctx.from!.id)!),
    },
  );
}

async function openIntroMenu(ctx: { reply: (t: string, extra?: object) => Promise<unknown>; from?: { id: number } }) {
  awaiting.set(ctx.from!.id, "intro_q");
  const kb = new InlineKeyboard().text("🎲 معرفی تصادفی", "intro:rand");
  await ctx.reply("🔎 اسم برنامه/بازی را بفرست — یا تصادفی را بزن:", {
    reply_markup: kb,
  });
}

async function doModeSearch(
  ctx: {
    reply: (t: string, extra?: object) => Promise<unknown>;
    replyWithPhoto: Function;
    from?: { id: number };
  },
  qRaw: string,
  mode: "update" | "intro",
) {
  const q = qRaw.trim();
  if (!q) {
    awaiting.set(ctx.from!.id, mode === "update" ? "update_q" : "intro_q");
    await ctx.reply(
      mode === "update" ? "اسم یا لینک اپ را برای آپدیت تکی بفرست:" : "اسم برنامه/بازی برای معرفی بفرست:",
      { reply_markup: mainKeyboard() },
    );
    return;
  }

  // لینک مستقیم
  const slug = parseSlug(q);
  if (slug && (/sibstars\.ir\/app\//i.test(q) || /^[a-zA-Z0-9._-]+$/.test(q))) {
    await ctx.reply(mode === "update" ? "⏳ ساخت پست آپدیت…" : "⏳ ساخت معرفی…", {
      reply_markup: mainKeyboard(),
    });
    const p = await buildFromSlug(slug, mode);
    if (!p) {
      await ctx.reply("تو کاتالوگ پیدا نشد.", { reply_markup: mainKeyboard() });
      return;
    }
    await preview(ctx, p);
    return;
  }

  await ctx.reply("🔎 جستجو در کاتالوگ…", { reply_markup: mainKeyboard() });
  const apps = await fetchCatalog();
  const hits = searchApps(apps, q);
  if (!hits.length) {
    await ctx.reply("چیزی پیدا نشد.", { reply_markup: mainKeyboard() });
    return;
  }
  if (hits.length === 1) {
    await ctx.reply(`✅ <b>${escHtml(hits[0]!.nameFa || hits[0]!.name)}</b>\n⏳ در حال ساخت…`, {
      parse_mode: "HTML",
      reply_markup: mainKeyboard(),
    });
    await preview(ctx, await makePending(hits[0]!, mode));
    return;
  }

  const prefix = mode === "update" ? "picku" : "picki";
  const kb = new InlineKeyboard();
  for (const a of hits.slice(0, 8)) {
    kb.text((a.nameFa || a.name).slice(0, 48), `${prefix}:${a.slug}`.slice(0, 64)).row();
  }
  await ctx.reply(
    `نتایج (${hits.length}) — یکی را برای ${mode === "update" ? "آپدیت تکی" : "معرفی"} انتخاب کن:`,
    { reply_markup: kb },
  );
}

export function createBot() {
  const bot = new Bot(config.token);
  void registerAdminCommands(bot).catch((e) => console.error("setMyCommands", e));
  const withMenu = { reply_markup: mainKeyboard() };

  bot.command("start", async (ctx) => {
    if (!isAdmin(ctx.from?.id)) return ctx.reply("خصوصی ادمین سیب‌استار.");
    awaiting.delete(ctx.from!.id);
    await ctx.reply(helpText(), withMenu);
  });
  bot.command("menu", async (ctx) => {
    if (!isAdmin(ctx.from?.id)) return;
    awaiting.delete(ctx.from!.id);
    await ctx.reply(helpText(), withMenu);
  });
  bot.command("help", async (ctx) => {
    if (!isAdmin(ctx.from?.id)) return;
    await ctx.reply(helpText(), withMenu);
  });
  bot.command("today", async (ctx) => {
    if (!isAdmin(ctx.from?.id)) return;
    awaiting.delete(ctx.from!.id);
    await openTodayPicker(ctx);
  });
  bot.command("update", async (ctx) => {
    if (!isAdmin(ctx.from?.id)) return;
    const arg = (ctx.match || "").toString().trim();
    await doModeSearch(ctx, arg, "update");
  });
  bot.command("intro", async (ctx) => {
    if (!isAdmin(ctx.from?.id)) return;
    const arg = (ctx.match || "").toString().trim();
    if (arg) await doModeSearch(ctx, arg, "intro");
    else await openIntroMenu(ctx);
  });
  bot.command("status", async (ctx) => {
    if (!isAdmin(ctx.from?.id)) return;
    const st = loadState();
    const apps = await fetchCatalog();
    const today = appsUpdatedToday(apps);
    await ctx.reply(
      [
        `کاتالوگ: ${apps.length}`,
        `آپدیت امروز (${shamsiDayTitle()}): ${today.length}`,
        `نوبت معرفی: ${st.nextKind === "game" ? "بازی" : "برنامه"}`,
        `آخرین پست: ${st.lastDailyAt || "—"}`,
      ].join("\n"),
      withMenu,
    );
  });
  bot.command("publish", async (ctx) => {
    if (!isAdmin(ctx.from?.id)) return;
    const p = pending.get(ctx.from!.id);
    if (!p) return ctx.reply("پیش‌نمایش نداری.", withMenu);
    await publishPending(ctx.api, (t) => ctx.reply(t, withMenu), p, ctx.from!.id);
  });
  bot.command("cancel", async (ctx) => {
    if (!isAdmin(ctx.from?.id)) return;
    pending.delete(ctx.from!.id);
    awaiting.delete(ctx.from!.id);
    todayDraft.delete(ctx.from!.id);
    await ctx.reply("لغو شد.", withMenu);
  });
  bot.command("id", async (ctx) => {
    if (!ctx.from) return;
    await ctx.reply(
      isAdmin(ctx.from.id)
        ? `آیدی: <code>${ctx.from.id}</code> ✅ ادمین`
        : `آیدی: <code>${ctx.from.id}</code> ❌`,
      { parse_mode: "HTML" },
    );
  });

  bot.callbackQuery("publish", async (ctx) => {
    if (!isAdmin(ctx.from?.id)) return ctx.answerCallbackQuery({ text: "نه", show_alert: true });
    const p = pending.get(ctx.from.id);
    if (!p) return ctx.answerCallbackQuery({ text: "منقضی", show_alert: true });
    await ctx.answerCallbackQuery({ text: "ارسال…" });
    await publishPending(ctx.api, (t) => ctx.reply(t, withMenu), p, ctx.from.id);
  });

  bot.callbackQuery("cancel", async (ctx) => {
    if (!isAdmin(ctx.from?.id)) return;
    pending.delete(ctx.from.id);
    awaiting.delete(ctx.from.id);
    todayDraft.delete(ctx.from.id);
    await ctx.answerCallbackQuery({ text: "لغو" });
    await ctx.reply("لغو شد.", withMenu);
  });

  bot.callbackQuery(/^tog:(.+)$/, async (ctx) => {
    if (!isAdmin(ctx.from?.id)) return;
    const slug = ctx.match![1]!;
    const draft = todayDraft.get(ctx.from.id);
    if (!draft) return ctx.answerCallbackQuery({ text: "منقضی — دوباره آپدیت‌های امروز را بزن", show_alert: true });
    if (draft.selected.has(slug)) draft.selected.delete(slug);
    else {
      if (draft.selected.size >= 8) return ctx.answerCallbackQuery({ text: "حداکثر ۸ تا", show_alert: true });
      draft.selected.add(slug);
    }
    await ctx.answerCallbackQuery({ text: `${draft.selected.size} انتخاب` });
    try {
      await ctx.editMessageReplyMarkup({ reply_markup: todayPickerKeyboard(draft) });
    } catch {
      /* ignore */
    }
  });

  bot.callbackQuery("today:top8", async (ctx) => {
    if (!isAdmin(ctx.from?.id)) return;
    const draft = todayDraft.get(ctx.from.id);
    if (!draft) return ctx.answerCallbackQuery({ text: "منقضی", show_alert: true });
    draft.selected = new Set(draft.list.slice(0, 8).map((a) => a.slug));
    await ctx.answerCallbackQuery({ text: "۸تای اول" });
    try {
      await ctx.editMessageReplyMarkup({ reply_markup: todayPickerKeyboard(draft) });
    } catch {
      /* ignore */
    }
  });

  bot.callbackQuery("today:clear", async (ctx) => {
    if (!isAdmin(ctx.from?.id)) return;
    const draft = todayDraft.get(ctx.from.id);
    if (!draft) return ctx.answerCallbackQuery({ text: "منقضی", show_alert: true });
    draft.selected.clear();
    await ctx.answerCallbackQuery({ text: "پاک شد" });
    try {
      await ctx.editMessageReplyMarkup({ reply_markup: todayPickerKeyboard(draft) });
    } catch {
      /* ignore */
    }
  });

  bot.callbackQuery("today:noop", async (ctx) => {
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery("today:build", async (ctx) => {
    if (!isAdmin(ctx.from?.id)) return;
    const draft = todayDraft.get(ctx.from.id);
    if (!draft) return ctx.answerCallbackQuery({ text: "منقضی", show_alert: true });
    const picked = draft.list.filter((a) => draft.selected.has(a.slug)).slice(0, 8);
    if (picked.length < 1) return ctx.answerCallbackQuery({ text: "حداقل یکی را تیک بزن", show_alert: true });
    await ctx.answerCallbackQuery({ text: "ساخت…" });
    await ctx.reply(`⏳ ساخت کلاژ از ${picked.length} آپدیت امروز…`, withMenu);
    try {
      await preview(ctx, await buildUpdatesDigest(picked));
    } catch (e) {
      await ctx.reply(`خطا: ${e instanceof Error ? e.message : e}`, withMenu);
    }
  });

  bot.callbackQuery("intro:rand", async (ctx) => {
    if (!isAdmin(ctx.from?.id)) return;
    await ctx.answerCallbackQuery({ text: "تصادفی…" });
    await ctx.reply("⏳ ساخت معرفی تصادفی…", withMenu);
    try {
      const p = await buildDailyIntro();
      if (!p) return void (await ctx.reply("آیتمی پیدا نشد.", withMenu));
      await preview(ctx, p);
    } catch (e) {
      await ctx.reply(`خطا: ${e instanceof Error ? e.message : e}`, withMenu);
    }
  });

  bot.callbackQuery(/^(picku|picki):(.+)$/, async (ctx) => {
    if (!isAdmin(ctx.from?.id)) return ctx.answerCallbackQuery({ text: "نه", show_alert: true });
    const kind = ctx.match![1] as "picku" | "picki";
    const slug = (ctx.match![2] || "").trim();
    if (!slug) return ctx.answerCallbackQuery({ text: "نامعتبر", show_alert: true });
    await ctx.answerCallbackQuery({ text: "ساخت…" });
    await ctx.reply(kind === "picku" ? "⏳ ساخت آپدیت تکی…" : "⏳ ساخت معرفی…", withMenu);
    try {
      const p = await buildFromSlug(slug, kind === "picku" ? "update" : "intro");
      if (!p) return void (await ctx.reply("پیدا نشد.", withMenu));
      await preview(ctx, p);
    } catch (e) {
      await ctx.reply(`خطا: ${e instanceof Error ? e.message : e}`, withMenu);
    }
  });

  bot.on("message:text", async (ctx) => {
    if (!isAdmin(ctx.from?.id)) return;
    const text = ctx.message.text.trim();
    if (text.startsWith("/")) return;

    if (text === BTN.menu) {
      awaiting.delete(ctx.from.id);
      await ctx.reply(helpText(), withMenu);
      return;
    }
    if (text === BTN.today) {
      awaiting.delete(ctx.from.id);
      await openTodayPicker(ctx);
      return;
    }
    if (text === BTN.update) {
      awaiting.set(ctx.from.id, "update_q");
      await ctx.reply("اسم یا لینک اپ را برای «آپدیت تکی» بفرست:", withMenu);
      return;
    }
    if (text === BTN.intro) {
      await openIntroMenu(ctx);
      return;
    }
    const wait = awaiting.get(ctx.from.id);
    if (wait === "update_q") {
      awaiting.delete(ctx.from.id);
      await doModeSearch(ctx, text, "update");
      return;
    }
    if (wait === "intro_q") {
      awaiting.delete(ctx.from.id);
      await doModeSearch(ctx, text, "intro");
      return;
    }
    if (wait === "watch_add" || wait === "watch_del") {
      awaiting.delete(ctx.from.id);
      const slug = parseSlug(text);
      if (!slug) return void (await ctx.reply("لینک/اسلاگ نامعتبر.", withMenu));
      const st = loadState();
      const key = slug.toLowerCase();
      if (wait === "watch_add") {
        if (!st.watchlist.map((s) => s.toLowerCase()).includes(key)) st.watchlist.push(slug);
        saveState(st);
        await ctx.reply(`✅ اضافه شد: <code>${escHtml(slug)}</code>`, { parse_mode: "HTML", ...withMenu });
      } else {
        st.watchlist = st.watchlist.filter((s) => s.toLowerCase() !== key);
        saveState(st);
        await ctx.reply(`حذف شد: <code>${escHtml(slug)}</code>`, { parse_mode: "HTML", ...withMenu });
      }
      return;
    }

    // لینک مستقیم = آپدیت تکی
    if (/sibstars\.ir\/app\//i.test(text)) {
      await doModeSearch(ctx, text, "update");
    }
  });

  bot.catch((err) => console.error("bot error", err));
  return bot;
}

export async function autoPublishDaily(bot: Bot) {
  try {
    const p = await buildUpdatesDigest();
    await publishPending(bot.api, async () => undefined, p);
    return { ok: true, mode: "updates" as const };
  } catch {
    const p = await buildDailyIntro();
    if (!p) return { ok: false, reason: "empty" };
    await publishPending(bot.api, async () => undefined, p);
    return { ok: true, mode: "intro" as const, slug: p.app?.slug };
  }
}

export async function autoPublishBank(bot: Bot) {
  const list = await buildBankUpdates(5);
  for (const p of list) await publishPending(bot.api, async () => undefined, p);
  return { ok: true, count: list.length };
}
