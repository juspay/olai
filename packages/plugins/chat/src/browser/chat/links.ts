/**
 * LINKS OUT OF A LOGIN'S OWN OUTPUT, found by shape and nothing else.
 *
 * A `claude auth login` prints the URL a person has to open, and until this
 * existed the row drew it as text: selectable, copyable, and not clickable —
 * which is the one thing the person reading it wants to do. The output is not
 * markdown and never will be (it is a CLI's stdout, `\r`-progress bars and
 * all), so the rule has to be a rule about the TEXT.
 *
 * WHAT COUNTS: an `http://` or `https://` run of non-space characters. That is
 * deliberately narrower than a URL can be — a scheme-relative `//host` or a
 * `mailto:` would both be guesses about prose — and deliberately wider than a
 * well-formed URL needs: a link ending in `)` or `,` is trimmed of the
 * punctuation a sentence puts after it, because a CLI printing "visit
 * https://example.com/device." means the link and not the full stop.
 *
 * Pure and exported for its own test, like every other rule in this directory
 * that a renderer switches on.
 */

/** One piece of output: text to draw, or a link to draw as a link. */
export interface Piece {
  readonly text: string
  /** The href, or `null` for a piece that is just text. */
  readonly href: string | null
}

/** Trailing punctuation a sentence adds that a URL does not end with. */
const TRAILING = /[.,;:!?'"]+$/

/** Everything up to the next whitespace, which is as much as a terminal gives
 *  a URL: these CLIs print one per line, and a URL with a space in it is not a
 *  URL any client could have produced. */
const LINK = /https?:\/\/\S+/g

export const linkify = (text: string): ReadonlyArray<Piece> => {
  const pieces: Array<Piece> = []
  let at = 0
  for (const match of text.matchAll(LINK)) {
    const start = match.index
    const whole = match[0]
    // `)` and `]` are dropped only when they came in PAIRS inside the match —
    // a bracketed URL is common in prose and an unbalanced closer is common
    // after one.
    const trimmed = trim(whole)
    if (start > at) pieces.push({ text: text.slice(at, start), href: null })
    pieces.push({ text: trimmed, href: trimmed })
    // Whatever was trimmed off goes back as text: it is prose, and dropping it
    // would print a sentence with its full stop missing.
    const rest = whole.slice(trimmed.length)
    if (rest !== "") pieces.push({ text: rest, href: null })
    at = start + whole.length
  }
  if (at < text.length) pieces.push({ text: text.slice(at), href: null })
  return pieces
}

/** The match without the punctuation a sentence would put after it, and
 *  without an unbalanced closing bracket. */
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
