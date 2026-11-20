export interface Piece {
  readonly text: string
  readonly href: string | null
}

const TRAILING = /[.,;:!?'"]+$/

const LINK = /https?:\/\/\S+/g

export const linkify = (text: string): ReadonlyArray<Piece> => {
  const pieces: Array<Piece> = []
  let at = 0
  for (const match of text.matchAll(LINK)) {
    const start = match.index
    const whole = match[0]
    const trimmed = trim(whole)
    if (start > at) pieces.push({ text: text.slice(at, start), href: null })
    pieces.push({ text: trimmed, href: trimmed })
    const rest = whole.slice(trimmed.length)
    if (rest !== "") pieces.push({ text: rest, href: null })
    at = start + whole.length
  }
  if (at < text.length) pieces.push({ text: text.slice(at), href: null })
  return pieces
}

const trim = (url: string): string => {
  let end = url.replace(TRAILING, "").length
  for (const [open, close] of [["(", ")"], ["[", "]"]] as const) {
    while (
      end > 0 && url[end - 1] === close &&
      count(url.slice(0, end), open) < count(url.slice(0, end), close)
    ) {
      end--
    }
  }
  return url.slice(0, end)
}

const count = (text: string, of: string): number => text.split(of).length - 1
