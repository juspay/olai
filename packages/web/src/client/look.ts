/**
 * The voices a page heading and the wordmark share.
 *
 * One pair of classes, so Agenda, a zoomed node, a day, the Trash and the
 * wordmark cannot drift into four different ideas of "this is the name".
 *
 * A PAGE TITLE IS SANS now, like the rows under it: the default typeface
 * keeps the serif for what a person WROTE as prose (`@olai/fonts`: Literata
 * for a document's body, Inter for the interface), and a page's name is the
 * interface naming the page. The wordmark keeps the serif italic — it is the
 * mark, not a heading, and it is the one place the brand's voice is allowed
 * in the chrome.
 *
 * THE SLANT IS SPLIT OUT, for the reason `layout/entry.ts` splits the ink
 * out of a row: two utilities setting one property are settled by the order
 * Tailwind emitted its rules in and not by the order they were written, so a
 * heading that appended `not-italic` to a class already saying `italic` was
 * a coin toss dressed as an override. Every user of this names a slant, and
 * exactly one of them — a date, which is read and not spoken — names roman.
 */

/** A page's own name: Agenda, a date, a zoomed title. Display size, because a
 *  heading is the first thing on the sheet and not a label over a list — and
 *  the size is the constant's, so a page wanting a smaller one is a page
 *  wanting a different thing, not a page appending `text-xl` and hoping. */
export const PAGE_TITLE =
  "m-0 font-sans text-display font-semibold tracking-tight"

/** The word in the bar. Colour is the header's; this is only the face. */
export const WORDMARK =
  "m-0 flex items-center gap-1.5 font-serif text-[1.0625rem] font-medium italic leading-none tracking-tight text-ink"
