/**
 * WHERE A CARET ON THE CLAMPED LINE GOES — the note half of the title-row
 * snippet that `@olai/prose`'s `preview.ts` draws.
 *
 * Wherever a `desc` rides a closed row — a tree node, a day entry — it shows
 * as one dim clamped line under the title (Workflowy-style), not open
 * markdown. Full markdown is a document of its own, and drawing every note
 * open is what used to leave only a few nodes on a screen. The LINE itself is
 * `previewLine`, in `prose` beside the test that holds it equal to the parse;
 * what is left here is the gesture, which is this plugin's own.
 *
 * THE TOP of the note, which is what makes ./excerpt.ts a sibling rather than
 * a caller: that one takes the same clamped line from around a QUERY's hit,
 * for a row a filter found behind its ¶, and it keeps the marks the line
 * drops because it is about a POSITION and that one is about an opening.
 */
import { withoutMarks } from "@olai/prose/preview.ts"

/**
 * Where in the NOTE a caret measured against the clamped line goes.
 *
 * The clamp is the note's first non-blank line after `withoutMarks`, and the
 * marks are the only characters the line gives up — every character a finger
 * pointed at names one character of the source, so the map is one walk: skip
 * the source's marks until the pointed character has been matched away, and
 * the position it matched is the caret's.
 *
 * The walk cannot wander: the view is a removed-marks copy of the line, so
 * every character of it DOES match, in order, and a click at the line's end
 * lands at the end of the source of that line, before any marks the line
 * closed with.
 *
 * Pure of the DOM, following `./` the way the part anybody would get wrong —
 * the marks, the leading list marker, a first line that is not the first
 * line — is a unit test.
 */
export const measuredAt = (desc: string, at: number): number => {
  let start = 0
  while (start < desc.length) {
    const end = desc.indexOf("\n", start)
    const raw = end === -1 ? desc.slice(start) : desc.slice(start, end)
    const line = raw.trim()
    if (line === "") {
      if (end === -1) return 0
      start = end + 1
      continue
    }
    const view = withoutMarks(line)
    // The raw's leading space is off the view's left edge: the walk starts
    // where the trimmed line does.
    const base = start + (raw.length - raw.trimStart().length)
    if (view.length === 0) return base
    let s = base
    // Past whatever marks the first letter was wrapped in, to the letter.
    while (s < desc.length && desc[s] !== view[0]) s++
    let i = 0
    // Caret `at` in the view names the source position of the view's `at`th
    // character: the caret around a marked word is answered just past the
    // marks the word closes with, which is where the space was drawn.
    const last = Math.min(at, view.length)
    while (i < last) {
      s++
      i++
      // Look for the NEXT letter only when the view still has one: a click
      // beyond the drawn words answers the end of the line, not the end of
      // the note.
      if (i < view.length) {
        while (s < desc.length && desc[s] !== view[i]) s++
      }
    }
    return Math.min(s, desc.length)
  }
  return 0
}
