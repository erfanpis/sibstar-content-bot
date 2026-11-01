import { Api, TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import bigInt from "big-integer";
import { config } from "./config.js";
import { htmlToTelegram } from "./htmlEntities.js";

let clientPromise: Promise<TelegramClient | null> | null = null;

export function userPosterConfigured(): boolean {
  return !!(config.tgApiId && config.tgApiHash && config.tgUserSession);
}

async function getClient(): Promise<TelegramClient | null> {
  if (!userPosterConfigured()) return null;
  if (!clientPromise) {
    clientPromise = (async () => {
      const session = new StringSession(config.tgUserSession);
      const client = new TelegramClient(session, config.tgApiId, config.tgApiHash, {
        connectionRetries: 5,
        deviceModel: "SibStar Content Bot",
        appVersion: "1.0",
      });
      await client.connect();
      if (!(await client.isUserAuthorized())) {
        console.warn("[userChannel] session not authorized — Bot API fallback");
        await client.disconnect();
        return null;
      }
      const me = await client.getMe();
      const uname = "username" in me && me.username ? `@${me.username}` : String(me.id);
      const premium = Boolean((me as { premium?: boolean }).premium);
      console.log(`[userChannel] logged in as ${uname}${premium ? " (Premium)" : " (no Premium — emoji may strip)"}`);
      return client;
    })().catch((e) => {
      console.error("[userChannel] connect failed", e);
      clientPromise = null;
      return null;
    });
  }
  return clientPromise;
}

function toApiEntities(entities: ReturnType<typeof htmlToTelegram>["entities"]) {
  return entities.map((e) => {
    if (e.type === "custom_emoji") {
      return new Api.MessageEntityCustomEmoji({
        offset: e.offset,
        length: e.length,
        documentId: bigInt(e.custom_emoji_id),
      });
    }
    if (e.type === "bold") return new Api.MessageEntityBold({ offset: e.offset, length: e.length });
    if (e.type === "code") return new Api.MessageEntityCode({ offset: e.offset, length: e.length });
    if (e.type === "blockquote") return new Api.MessageEntityBlockquote({ offset: e.offset, length: e.length });
    return new Api.MessageEntityTextUrl({ offset: e.offset, length: e.length, url: e.url });
  });
}

/** عکس + کپشن زیر همان مدیا (سقف کپشن تلگرام ۱۰۲۴) */
export async function publishViaUser(cover: Buffer, captionHtml: string): Promise<boolean> {
  const client = await getClient();
  if (!client) return false;

  const { text, entities } = htmlToTelegram(captionHtml);
  const peer = config.channelId;

  if (text.length <= 1024) {
    await client.sendFile(peer, {
      file: cover,
      caption: text,
      formattingEntities: toApiEntities(entities),
      forceDocument: false,
    });
  } else {
    await client.sendFile(peer, { file: cover, forceDocument: false });
    await client.sendMessage(peer, {
      message: text.slice(0, 4096),
      formattingEntities: toApiEntities(entities),
      linkPreview: false,
    });
  }

  return true;
}

export async function disconnectUserClient(): Promise<void> {
  if (!clientPromise) return;
  const c = await clientPromise;
  if (c) await c.disconnect().catch(() => undefined);
  clientPromise = null;
}
