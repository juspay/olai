/**
 * The voices a page heading and the wordmark share.
 *
 * One pair of classes, so Agenda, a zoomed node, a day, the Trash and the
 * wordmark cannot drift into four different ideas of "this is the name".
 * Serif and italic because the default typeface keeps jobs distinct
 * (`@olai/fonts`: Literata on the page, Quattro on the chrome) — a heading
 * that stayed sans-bold would be chrome shouting over the outline.
 */

/** A page's own name: Agenda, a date, a zoomed title. Display size: a
 *  heading is the first thing on the sheet, not a label over a list. */
export const PAGE_TITLE =
  "m-0 font-serif text-4xl font-medium italic tracking-tight md:text-5xl"

/** The word in the bar. Colour is the header's (`text-paper` on ink);
 *  this is only the face. */
export const WORDMARK =
  "m-0 flex items-center gap-2 font-serif text-[1.125rem] font-medium italic leading-none tracking-tight md:gap-2.5 md:text-[1.375rem]"
