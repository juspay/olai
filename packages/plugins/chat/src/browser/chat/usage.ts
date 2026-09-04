/**
 * How full the context is, as a line short enough to sit in a header.
 *
 * `22k/1M`. Two numbers and a slash, because the question it answers is "how
 * much room is left" and neither half answers that alone: `22k` is meaningless
 * without the window, and a window that never moved would not need saying —
 * but it does move, since 200k and 1M are both ordinary and a session travels
 * between them whenever the model does.
 *
 * A FRACTION rather than a percentage, and rather than a bar. A percentage is
 * one number and reads the same at 80% of 200k as at 80% of 1M, which are
 * quite different amounts of work left; a bar is a gauge, and this panel is
 * Workflowy-quiet — the header's other facts are words, so this one is a
 * number. The reader does the division, and gets the denominator for free.
 *
 * ROUNDED, hard. Nobody reads a header to learn they are at 22,102 tokens, and
 * a figure that changes in its last three digits several times a turn is a
 * flicker in the corner of the eye rather than information. Thousands to the
 * nearest thousand, millions to one decimal — so the number moves when the
 * answer moves and holds still when it does not.
 */

/** `used/size` for the header, e.g. `22k/1M` — or `null` when there is nothing
 *  to say, which is every session before its first turn reports. */
export const usageOf = (
  usage: { readonly used: number; readonly size: number } | null,
): string | null => (usage === null ? null : `${tokensOf(usage.used)}/${tokensOf(usage.size)}`)

/**
 * A token count, at the precision a header can use.
 *
 * Under a thousand is itself — the opening turns of a conversation, where `0`
 * and `847` are both true and `0k` is neither. Thousands carry `k`, millions
 * carry `M` with one decimal and no trailing `.0`, so a 1M window is `1M` and
 * not `1.0M`. The k→M handover is done on the ROUNDED thousands rather than on
 * the raw number, because 999,600 rounds to 1000k, and `1000k/1M` is a fraction
 * that has to be read twice to see it is nearly full.
 */
const tokensOf = (tokens: number): string => {
  if (tokens < 1_000) return String(tokens)
  const thousands = Math.round(tokens / 1_000)
  if (thousands < 1_000) return `${thousands}k`
  const millions = Math.round(tokens / 100_000) / 10
  return `${millions}M`
}
