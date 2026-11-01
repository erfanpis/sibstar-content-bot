/**
 * پک اختصاصی ربات: https://t.me/addemoji/sibstar_emoji_by_autosibstarbot
 * (کپی بصری همان ایموجی‌های iranNewz / FinanceEmoji که خواسته بودی)
 *
 * محدودیت تلگرام (Bot API 9.4):
 * - ربات فقط اگر مالکش Premium داشته باشد، custom emoji را در خصوصی/گروه نگه می‌دارد.
 * - پست مستقیم کانال از Bot API هنوز custom emoji را حذف می‌کند.
 * برای کانال باید با اکانت کاربر (MTProto / TELEGRAM_USER_SESSION) بفرستیم.
 */

export const PREMIUM_EMOJI = {
  /** دانلود / آپدیت — معادل 5839360423798772952 */
  download: "5997090963145630687",
  /** دریافت / اینباکس — معادل 5443127283898405358 */
  inbox: "5994749123637551529",
} as const;

export const EMOJI_PACK = "sibstar_emoji_by_autosibstarbot";

/** HTML تگ tg-emoji با fallback یونیکد */
export function tgEmoji(id: string, fallback = "📥"): string {
  return `<tg-emoji emoji-id="${id}">${fallback}</tg-emoji>`;
}

export const E = {
  download: () => tgEmoji(PREMIUM_EMOJI.download, "📥"),
  inbox: () => tgEmoji(PREMIUM_EMOJI.inbox, "📥"),
};
