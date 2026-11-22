// The shapes both halves of the reader agree on.

/** One sentence of the book and its translation. */
export interface Pair {
  readonly french: string
  readonly english: string
}

/** How hard a word was to recall, as the review's three buttons say it. */
export type Grade = "again" | "good" | "easy"

/** A word being learnt, and when it is next due. */
export interface Card {
  readonly word: string
  readonly due: string
  readonly interval: number
  readonly ease: number
}
