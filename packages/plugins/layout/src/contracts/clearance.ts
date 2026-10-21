/** What a page keeps clear at its foot: a line of room, the phone's home
 *  indicator, and the thumb bar while the frame draws one
 *  (`--height-bottom-chrome`, published by `../layout/css.ts`). */
export const CLEARANCE = "pb-[calc(1rem+var(--height-bottom-chrome,0px)+env(safe-area-inset-bottom,0px))]"
