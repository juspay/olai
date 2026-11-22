import type { Card, Grade } from "../types.ts"

const DAY = 24 * 60 * 60 * 1000

/** The day `days` after `from`, both as `YYYY-MM-DD`. */
const after = (from: string, days: number): string =>
  new Date(Date.parse(`${from}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10)

/**
 * When a word is next due, by the SM-2 rule: a word you missed comes back
 * tomorrow, and one you knew comes back after a gap that grows each time.
 */
export const scheduled = (card: Card, grade: Grade, today: string): Card => {
  if (grade === "again") return { ...card, interval: 1, due: after(today, 1) }
  const ease = Math.max(1.3, card.ease + (grade === "easy" ? 0.15 : 0))
  const interval = card.interval <= 1 ? (grade === "easy" ? 4 : 2) : Math.round(card.interval * ease)
  return { ...card, ease, interval, due: after(today, interval) }
}
