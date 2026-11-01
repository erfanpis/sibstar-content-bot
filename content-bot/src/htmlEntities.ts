/**
 * تبدیل HTML سادهٔ کپشن (tg-emoji / b / a / code) به متن خام + entityهای تلگرام.
 * آفست‌ها بر حسب UTF-16 code unit (قرارداد تلگرام).
 */

export type TgEntity =
  | { type: "custom_emoji"; offset: number; length: number; custom_emoji_id: string }
  | { type: "bold"; offset: number; length: number }
  | { type: "code"; offset: number; length: number }
  | { type: "blockquote"; offset: number; length: number }
  | { type: "text_link"; offset: number; length: number; url: string };

function utf16Len(s: string): number {
  return Buffer.from(s, "utf16le").length / 2;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&");
}

type Tok =
  | { kind: "text"; value: string }
  | { kind: "open"; name: string; attrs: Record<string, string> }
  | { kind: "close"; name: string };

function tokenize(html: string): Tok[] {
  const out: Tok[] = [];
  const re = /<\/?([a-zA-Z0-9-]+)([^>]*)>|([^<]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    if (m[3] != null) {
      out.push({ kind: "text", value: decodeEntities(m[3]) });
      continue;
    }
    const name = m[1]!.toLowerCase();
    const raw = m[0];
    if (raw.startsWith("</")) {
      out.push({ kind: "close", name });
      continue;
    }
    const attrs: Record<string, string> = {};
    const attrRe = /([a-zA-Z0-9:-]+)\s*=\s*"([^"]*)"/g;
    let a: RegExpExecArray | null;
    while ((a = attrRe.exec(m[2] || ""))) attrs[a[1]!] = a[2]!;
    out.push({ kind: "open", name, attrs });
  }
  return out;
}

export function htmlToTelegram(html: string): { text: string; entities: TgEntity[] } {
  const tokens = tokenize(html);
  let text = "";
  const entities: TgEntity[] = [];
  type Frame = { name: string; start: number; attrs: Record<string, string> };
  const stack: Frame[] = [];

  for (const t of tokens) {
    if (t.kind === "text") {
      text += t.value;
      continue;
    }
    if (t.kind === "open") {
      if (t.name === "br") {
        text += "\n";
        continue;
      }
      stack.push({ name: t.name, start: utf16Len(text), attrs: t.attrs });
      continue;
    }

    let frame: Frame | undefined;
    for (let i = stack.length - 1; i >= 0; i--) {
      if (stack[i]!.name === t.name) {
        frame = stack[i];
        stack.splice(i, 1);
        break;
      }
    }
    if (!frame) continue;
    const length = utf16Len(text) - frame.start;
    if (length <= 0) continue;

    if (frame.name === "tg-emoji" && frame.attrs["emoji-id"]) {
      entities.push({
        type: "custom_emoji",
        offset: frame.start,
        length,
        custom_emoji_id: frame.attrs["emoji-id"]!,
      });
    } else if (frame.name === "b" || frame.name === "strong") {
      entities.push({ type: "bold", offset: frame.start, length });
    } else if (frame.name === "code") {
      entities.push({ type: "code", offset: frame.start, length });
    } else if (frame.name === "blockquote") {
      entities.push({ type: "blockquote", offset: frame.start, length });
    } else if (frame.name === "a" && frame.attrs.href) {
      entities.push({ type: "text_link", offset: frame.start, length, url: frame.attrs.href });
    }
  }

  entities.sort((a, b) => a.offset - b.offset || b.length - a.length);
  return { text, entities };
}
