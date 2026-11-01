/**
 * یک‌بار اجرا کن تا TELEGRAM_USER_SESSION بسازی:
 *   TELEGRAM_API_ID=… TELEGRAM_API_HASH=… npm run auth:user
 *
 * اکانت باید Premium باشد و در کانال ادمین با حق ارسال پست.
 */
import "dotenv/config";
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";

const apiId = Number(process.env.TELEGRAM_API_ID || "");
const apiHash = (process.env.TELEGRAM_API_HASH || "").trim();
if (!apiId || !apiHash) {
  console.error("TELEGRAM_API_ID و TELEGRAM_API_HASH را از my.telegram.org بگذار.");
  process.exit(1);
}

const rl = readline.createInterface({ input, output });
const client = new TelegramClient(new StringSession(""), apiId, apiHash, {
  connectionRetries: 5,
  deviceModel: "SibStar Auth",
  appVersion: "1.0",
});

await client.start({
  phoneNumber: async () => rl.question("شماره با کد کشور (+98…): "),
  phoneCode: async () => rl.question("کد تلگرام: "),
  password: async () => rl.question("رمز دو مرحله‌ای (اگر داری): "),
  onError: (e) => console.error(e),
});

const session = client.session.save() as unknown as string;
const me = await client.getMe();
console.log("\n✅ لاگین شد:", "username" in me && me.username ? `@${me.username}` : me.id);
console.log((me as { premium?: boolean }).premium ? "Premium: بله" : "Premium: خیر — برای ایموجی پرموم لازم است");
console.log("\nاین خط را در .env بگذار:\n");
console.log(`TELEGRAM_API_ID=${apiId}`);
console.log(`TELEGRAM_API_HASH=${apiHash}`);
console.log(`TELEGRAM_USER_SESSION=${session}`);
await client.disconnect();
rl.close();
