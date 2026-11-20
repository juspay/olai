export interface FilterForm {
  readonly form: string
  readonly hint: string
  readonly select: readonly [number, number]
}

const form = (text: string, hint: string, example?: string): FilterForm => {
  const at = example === undefined ? -1 : text.lastIndexOf(example)
  return { form: text, hint, select: at < 0 ? [text.length, text.length] : [at, at + example!.length] }
}

export const FILTER_FORMS: ReadonlyArray<FilterForm> = [
  form("words", "Every word", "words"),
  form("\"a phrase\"", "Exact phrase", "a phrase"),
  form("a OR b", "Either", "a OR b"),
  form("#tag", "Tagged", "tag"),
  form("is:done", "Finished"),
  form("has:desc", "Has a note"),
  form("date:last-week", "Dated", "last-week"),
  form("changed:today", "Edited", "today"),
  form("-not", "Leave out", "not"),
]
