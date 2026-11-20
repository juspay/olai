export interface Byline {
  readonly byline: string
  readonly body: string
}

const OPENING_GAP = /^[ \t\r]*\n/

export const bylineOf = (text: string): Byline => {
  const breaks = text.indexOf("\n")
  const whole: Byline = { byline: "", body: text }
  if (breaks < 0) return whole
  const byline = text.slice(0, breaks).trimEnd()
  const body = text.slice(breaks + 1).replace(OPENING_GAP, "")
  return byline === "" || body.trim() === "" ? whole : { byline, body }
}
