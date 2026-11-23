/**
 * WHICH WAY A LIST HUNG FROM A CHAT PAGE'S STATUS BAR OPENS, and how tall it
 * may be — the model list (`./Model.tsx`) and the strips' panel
 * (`./Strips.tsx`), both hung from the bar's box.
 *
 * The bar is pinned to the bottom of the page, so up is usually the room. But
 * a conversation shorter than the screen leaves the bar where its last line
 * ends, near the top, and a list opened upward there runs under the app's
 * pinned chrome where nothing in it can be pressed. So the side with more
 * room wins, and the model list, which can be long, is cut to that room.
 *
 * THE TOP OF THE ROOM is the chrome the root reserves for jumps (its
 * `scroll-padding-top`, which is `--height-chrome` resolved to pixels,
 * `olai-plugin-layout`'s `all.css`) and the page's own pinned name line under
 * it, which is one line of the title size.
 */

/** The chat page's pinned name line, at its title size and padding. */
const NAME_LINE = 48
/** Clear of the bar, and of the edge it opens toward. */
const GAP = 8

export interface Hang {
  readonly up: boolean
  /** The most the list may take, in pixels. */
  readonly room: number
}

export const hangFrom = (bar: Element): Hang => {
  const box = bar.getBoundingClientRect()
  const chrome = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0
  const above = box.top - chrome - NAME_LINE - GAP
  const below = window.innerHeight - box.bottom - GAP
  return above >= below ? { up: true, room: above } : { up: false, room: below }
}
