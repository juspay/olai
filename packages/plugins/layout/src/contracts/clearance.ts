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
