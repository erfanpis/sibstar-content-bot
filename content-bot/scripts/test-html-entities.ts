import { htmlToTelegram } from "../src/htmlEntities.js";
import { E } from "../src/premiumEmoji.js";

const html = [
  `${E.download()} <b>آپدیت جدید بازی منتشر شد!</b>`,
  "",
  `📱 برنامه: <a href="https://beta.sibstars.ir/app/x"><b>تست</b></a>`,
  `${E.inbox()} <b>دریافت آخرین نسخه:</b>`,
].join("\n");

const { text, entities } = htmlToTelegram(html);
console.log("TEXT:\n" + text);
console.log("\nENTITIES:");
for (const e of entities) console.log(e);
const customs = entities.filter((e) => e.type === "custom_emoji");
if (customs.length !== 2) {
  console.error("expected 2 custom_emoji, got", customs.length);
  process.exit(1);
}
console.log("\nOK");
