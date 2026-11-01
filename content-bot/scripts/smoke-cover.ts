import "dotenv/config";
import { writeFileSync } from "node:fs";
import { Bot, InputFile } from "grammy";
import { buildCover } from "../src/cover.js";
import { updateReleaseCaption } from "../src/captions.js";
import { fetchCatalog, appPageUrl } from "../src/sibstar.js";
import { config } from "../src/config.js";

async function main() {
  const apps = await fetchCatalog();
  const app = apps.find((a) => a.icon && (a.nameFa || a.name) && a.version) || apps[0];
  if (!app) throw new Error("no app");
  const cover = await buildCover(app);
  writeFileSync("/opt/cursor/artifacts/cover-sample.jpg", cover);
  writeFileSync("/workspace/content-bot/tmp/cover-sample.jpg", cover);
  const caption = updateReleaseCaption(app, appPageUrl(app.slug));
  console.log("---CAPTION---\n" + caption + "\n---");
  const bot = new Bot(config.token);
  await bot.api.sendPhoto(config.channelId, new InputFile(cover, "cover.jpg"));
  await bot.api.sendMessage(config.channelId, caption, {
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
  });
  console.log("posted", app.slug, app.version);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
