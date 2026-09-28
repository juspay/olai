/**
 * THE FORMS THE FILTER TAKES, as the hint under an empty box offers them.
 *
 * This was the box's placeholder — the whole grammar in one line — and a
 * placeholder that is a syntax manual is a box that shouts. The box says
 * `Filter` now, and the manual is here, shown under it while it is focused and
 * empty (`./FilterBar.tsx`), where choosing a form puts it in the box.
 *
 * Each form carries the part a person is expected to REPLACE, selected when it
 * goes in, so typing straight away writes over the example rather than after
 * it: `#tag` goes in with `tag` selected, `date:last-week` with `last-week`.
 * An operator whose whole word is the point (`is:done`) goes in with the caret
 * after it.
 */
export interface FilterForm {
  readonly form: string
  /** What it finds, in a few plain words. */
  readonly hint: string
  /** The span of {@link form} selected once it is in the box. */
  readonly select: readonly [number, number]
}

const form = (text: string, hint: string, example?: string): FilterForm => {
  const at = example === undefined ? -1 : text.lastIndexOf(example)
  return { form: text, hint, select: at < 0 ? [text.length, text.length] : [at, at + example!.length] }
}

export const FILTER_FORMS: ReadonlyArray<FilterForm> = [
  form("words", "every word", "words"),
  form("\"a phrase\"", "exactly", "a phrase"),
  form("a OR b", "either", "a OR b"),
  form("#tag", "tagged", "tag"),
  form("is:done", "finished"),
  form("has:desc", "has a note"),
  form("date:last-week", "dated", "last-week"),
  form("changed:today", "edited", "today"),
  form("-not", "without", "not"),
]
