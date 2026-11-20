export interface Counts {
  readonly shown: number
  readonly held: number
  readonly hiddenAsDone: number
}

export const NOTHING_COUNTED: Counts = { shown: 0, held: 0, hiddenAsDone: 0 }

export const ANSWERING = "Filtering…"

export const countLine = ({ shown, held, hiddenAsDone }: Counts): string => {
  const found = shown === 0 ? `No matches of ${held}` : `${shown} of ${held}`
  if (hiddenAsDone === 0) return found
  const more = shown === 0 ? "" : "more "
  const matches = hiddenAsDone === 1 ? "match" : "matches"
  return `${found} — ${hiddenAsDone} ${more}${matches} hidden as done`
}

export const countSaid = (said: {
  readonly answering: string | null
  readonly failure: string | null
  readonly counts: Counts
}): string | null => {
  if (said.answering !== null) return countLine(said.counts)
  return said.failure === null ? ANSWERING : null
}
