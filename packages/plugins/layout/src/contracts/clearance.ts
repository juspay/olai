/** What a page keeps clear at its foot: a line of room, the phone's home
 *  indicator, and the thumb bar while the frame draws one
 *  (`--height-bottom-chrome`, published by `../layout/css.ts`).
 *
 *  THE LINE OF ROOM IS A VARIABLE because a short screen cannot spare one:
 *  `--room-foot` is that line, and `../all.css` gives it back under 540
 *  pixels of height, where a page with something PINNED at its foot — a chat
 *  page's composer — is spending it out of the only band a person reads. The
 *  other two terms are not negotiable at any height: they are the hardware's
 *  and the frame's own bars, and a page under either of them is a page with
 *  its last line covered. */
export const CLEARANCE = "pb-[calc(var(--room-foot,1rem)+var(--height-bottom-chrome,0px)+env(safe-area-inset-bottom,0px))]"

/** The top of {@link PAGE_INSET} alone, for a page that draws its own centred
 *  column — a plugin's own page: the column keeps its width and its sides, and
 *  its first line starts at the same height as every other page's. One page
 *  wears it today; it stays a constant here rather than a copy in that page
 *  because it IS the inset's top, and the inset is spelled once (below).
 *
 *  NOT the conversation page: its head is pinned and was shortened on
 *  purpose, so it keeps its own top. */
export const PAGE_INSET_TOP = "pt-4 md:pt-8"

/** Where a page's first line starts: ONE INSET FOR EVERY PAGE, so the first
 *  line of an outline, a day, the Agenda, the Trash and a document stand on
 *  the same left edge and the same top. `1rem` all round on a phone; from
 *  `md`, `2.5rem` at the sides and `2rem` on top. The foot is the page's own
 *  ({@link CLEARANCE} and whatever the page adds at `md`). */
export const PAGE_INSET = `px-4 md:px-10 ${PAGE_INSET_TOP}`
