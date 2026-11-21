import type { Pair } from "./types.ts"

/** A `reader-pair` value is the French sentence, ` | `, and its English. */
export const splitPair = (value: string): Pair | null => {
  const cut = value.indexOf(" | ")
  if (cut <= 0 || cut + 3 >= value.length) return null
  return { french: value.slice(0, cut).trim(), english: value.slice(cut + 3).trim() }
}
