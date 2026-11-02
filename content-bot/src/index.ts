import { allAdminIds } from "./admins.js";
import { autoPublishBank, autoPublishDaily, createBot } from "./bot.js";
import { config } from "./config.js";

const bot = createBot();
let stopping = false;

console.log(
  JSON.stringify({
    ok: true,
    channel: config.channelId,
    owners: config.adminIds,
    admins: allAdminIds(),
    runtimeEnv: !!(process.env.SIBSTAR_BOT_RUNTIME || "").trim(),
    stateSync: !!(process.env.STATE_SYNC_TOKEN || "").trim() && !!(process.env.GITHUB_REPOSITORY || "").trim(),
    sibstar: config.sibstarBase,
    covers: "adaptive-icon-theme",
    dailyEveryHours: config.dailyEveryHours,
    bankEveryMinutes: config.bankEveryMinutes,
    autoPost: config.dailyEveryHours > 0 || config.bankEveryMinutes > 0 ? "on" : "off-manual-approve-only",
    githubActions: process.env.GITHUB_ACTIONS === "true",
  }),
);

async function runBot() {
  for (;;) {
    if (stopping) break;
    try {
      await bot.start({
        drop_pending_updates: true,
        onStart: (info) => console.log(`Bot @${info.username} started`),
      });
      console.warn("bot.start ended");
    } catch (e) {
      if (stopping) break;
      console.error("bot crashed, restarting in 3s", e);
    }
    if (stopping) break;
    await new Promise((r) => setTimeout(r, 3000));
  }
  console.log("bot loop stopped cleanly");
  process.exit(0);
}
void runBot();

function hoursSince(iso?: string): number {
  if (!iso) return Infinity;
  return (Date.now() - new Date(iso).getTime()) / 3_600_000;
}

function minutesSince(iso?: string): number {
  if (!iso) return Infinity;
  return (Date.now() - new Date(iso).getTime()) / 60_000;
}

setInterval(async () => {
  if (stopping) return;
  try {
    const { loadState } = await import("./state.js");
    const st = loadState();
    if (config.dailyEveryHours > 0 && hoursSince(st.lastDailyAt) >= config.dailyEveryHours) {
      const r = await autoPublishDaily(bot);
      console.log("auto daily", r);
    }
    if (config.bankEveryMinutes > 0 && minutesSince(st.lastBankCheckAt) >= config.bankEveryMinutes) {
      const r = await autoPublishBank(bot);
      console.log("auto bank", r);
    }
  } catch (e) {
    console.error("scheduler", e);
  }
}, 5 * 60_000);

function requestStop(signal: string) {
  if (stopping) return;
  stopping = true;
  console.log(`received ${signal}; stopping bot for clean handoff…`);
  void bot.stop().catch(() => undefined);
}

process.once("SIGINT", () => requestStop("SIGINT"));
process.once("SIGTERM", () => requestStop("SIGTERM"));
