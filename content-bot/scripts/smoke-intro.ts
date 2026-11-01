import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { Bot, InputFile } from "grammy";
import { introCaption } from "../src/captions.js";
import { findBestIntroPhoto, researchApp } from "../src/introMedia.js";
import { fetchCatalog, appPageUrl } from "../src/sibstar.js";
import { config } from "../src/config.js";

async function main() {
  const q = (process.argv[2] || "sleep").toLowerCase();
  const apps = await fetchCatalog();
  const app =
    apps.find((a) => `${a.name} ${a.nameFa} ${a.slug}`.toLowerCase().includes(q)) ||
    apps.find((a) => a.icon) ||
    apps[0];
  if (!app) throw new Error("no app");

  console.log("researching + finding photo for", app.name || app.nameFa, app.slug);
  const [research, photo] = await Promise.all([researchApp(app), findBestIntroPhoto(app)]);
  const caption = await introCaption(app, appPageUrl(app.slug), true, research);

  mkdirSync("/opt/cursor/artifacts", { recursive: true });
  mkdirSync("/workspace/content-bot/tmp", { recursive: true });
  writeFileSync("/opt/cursor/artifacts/intro-google-photo.jpg", photo);
  writeFileSync("/workspace/content-bot/tmp/intro-google-photo.jpg", photo);

  console.log("---RESEARCH---", research.slice(0, 2));
  console.log("---CAPTION---\n" + caption + "\n---");
  console.log("photo bytes", photo.length);

  const bot = new Bot(config.token);
  const msg = await bot.api.sendPhoto(config.channelId, new InputFile(photo, "intro.jpg"), {
    caption,
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
  });
  console.log("posted message", msg.message_id);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
