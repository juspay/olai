/**
 * The voices a page heading and the wordmark share.
 *
 * One pair of classes, so Agenda, a zoomed node, a day, the Trash and the
 * wordmark cannot drift into four different ideas of "this is the name".
 * Serif because the default typeface keeps jobs distinct (`@olai/fonts`:
 * Literata on the page, Quattro on the chrome) — a heading that stayed
 * sans-bold would be chrome shouting over the outline.
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
  "m-0 font-serif text-4xl font-medium tracking-tight md:text-5xl"

/** The word in the bar. Colour is the header's (`text-paper` on ink);
 *  this is only the face. */
export const WORDMARK =
  "m-0 flex items-center gap-2 font-serif text-[1.125rem] font-medium italic leading-none tracking-tight md:gap-2.5 md:text-[1.375rem]"
