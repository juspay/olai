/**
 * WHAT COVERS WHAT: the client's stacking order, as one table.
 *
 * Every `z-index` this app draws is a claim about something ELSE — the header
 * is above the drawer, the drawer is above the page, the palette is above all
 * of it — and until this file existed those claims were spelled as bare
 * numbers at twenty-odd call sites, each of which could only be read by going
 * and looking at the other nineteen. The numbers were not wrong; they were
 * unreadable, and a `z-50` in one file meant "over the whole app" while a
 * `z-50` in another meant "over the four things in this panel". That is the
 * bug this module is for. It changes no pixel: the utilities below are the
 * ones already in force, given the names they were already being used as.
 *
 * ## Two bands, and which one you are in is the first question
 *
 * A `z-index` compares with nothing outside its own STACKING CONTEXT, and this
 * app makes those on purpose — the header, the chat dock, a modal's backdrop
 * are each a positioned box with a layer of its own, and everything inside one
 * is sealed in it. So there are two different questions with the same syntax:
 *
 *   - {@link LAYER} — **the page's stack.** These compare with each other
 *     across the whole viewport, they are the app's chrome, and the order
 *     below IS the design. Anything `fixed`, `sticky`, or hanging off a row
 *     over the page takes one of these and nothing else.
 *   - {@link WITHIN} — **inside one box.** A resize handle over its own panel,
 *     a card over its own backdrop, a small list opening inside a column.
 *     These say "above my siblings" and answer no question about the page at
 *     all.
 *
 * The bands are kept far apart on purpose — single digits inside a box, tens
 * across the page — so the number itself says which question is being asked.
 * The chat header's session dropdown is why: it drew at `z-50`, the same
 * utility the command palette covers the entire app with, and it means
 * something else entirely (it is sealed inside the chat panel, which rides at
 * 30). Nothing was broken and nothing could be read.
 *
 * ## The THREE things above this table, and why they are not in it
 *
 * A modal `<dialog>` — one opened with `showModal()` rather than with `show()`
 * or the `open` attribute — is in the browser's TOP LAYER: above every
 * stacking context on the page at once, whatever number is on it, with the
 * rest of the document inert and the keyboard held inside it. A `z-index`
 * cannot make that claim at all, which is the reason three surfaces here are
 * modal dialogs rather than `fixed` boxes at {@link LAYER.over}: a panel that
 * portals to `document.body` LATER at the same number paints straight over
 * whatever was already there, and "nothing underneath can be touched" is
 * exactly the promise that may not have a hole in it.
 *
 * The three, in the order they may stand on each other:
 *
 *   - the ⌘K palette (`plugins/navigation/.../palette/Palette.tsx`),
 *   - the keyboard-shortcuts sheet it opens (`.../palette/Shortcuts.tsx`),
 *   - the offline freeze (`connection/Offline.tsx`), which is the FLOOR.
 *
 * **The freeze is the floor**, and that is the one rule about the top layer
 * this module owns rather than describes. Dialogs stack in the order they were
 * opened, so a palette asked to open while the app is frozen would take the
 * layer ABOVE the freeze — the page behind it would still be inert, but the
 * freeze would be a dimmed card under a working door, which is the half-alive
 * page `connection/Offline.tsx` exists to refuse. So every other modal enters
 * through {@link enterTopLayer}, and the freeze claims the floor with
 * {@link holdTopLayerFloor} for as long as it is mounted; anything entering
 * over it is immediately stood back under it.
 *
 * `claims.test.ts` sweeps both halves — who calls `showModal` (this file and
 * the freeze, which is its own floor) and who enters the layer (the two
 * modals) — so a fourth surface reaching for it has to argue with that list
 * first.
 *
 * ## The order, and what each step is holding
 *
 * Three claims are held about the table, in the two places each belongs.
 * `layer.test.ts` holds the two that are about the table itself: the page band
 * climbs in the order it is written, and the two bands do not overlap. The
 * third is about every OTHER file — NO client file outside this one spells a
 * `z-*` utility — which makes it a sweep rather than a test, so it lives with
 * the rest of them in `claims.test.ts`. That one is what keeps this from
 * becoming a nineteenth place to look.
 */

import { onCleanup } from "solid-js"

/**
 * THE PAGE'S STACK, bottom to top. The order of these fields is the order of
 * the layers, and the test beside this file holds them to it.
 */
export const LAYER = {
  /**
   * Over a ROW, under every piece of chrome. Two different things sit here
   * and they are not interchangeable:
   *
   *   - **in the tree**: a sticky section heading (`Tree.tsx`). It covers the
   *     rows scrolling under it, and it is page content — later siblings at
   *     this same layer paint over earlier ones, which is how a heading holds
   *     the seam.
   *   - **out of the tree**: anything that HANGS off a row — the `•••` menu,
   *     the line beside it, the title-cell completions, the drop line, the
   *     sweep band. These must PORTAL to the document. A `z-index` only
   *     compares inside its own
   *     stacking context, and a sticky heading is one: an overlay left in the
   *     row is cut in two the moment the next section arrives
   *     (`menu-under-headers`). The number is the same; the tree position is
   *     the whole of what makes the claim true. The socket is
   *     {@link ./overlay.ts}: one `position: fixed` box at the viewport
   *     origin, because Kobalte's popper is `strategy: "absolute"` and a
   *     body-mounted absolute box is positioned against the document.
   *
   * A menu opened next to the chat dock or under the header is still the one
   * that gives way — the reader asked for the chrome first, and it is still
   * there when the menu goes. Portalling does not promote the overlay; it
   * lets this layer mean what it says.
   */
  row: "z-20",
  /**
   * Over the page, under the strip and covering chrome: a lone node-page
   * header, the scrim under an open drawer, and a tip that hangs
   * off a ROW. What these have in common is that they leave the app's frame
   * reachable — a row's tip is about something on the page, and the scrim's
   * whole job is to be dismissed by pressing it while the header above it
   * still works (#101). A tip about a header pill is not this: it rides
   * {@link LAYER.over} with the panel behind that pill.
   */
  page: "z-30",
  /** The main-column strip: above page headings, below drawers, sheets and
   * the app header. Its opaque ground covers content scrolling beneath it. */
  strip: "z-[35]",
  /**
   * COVERS the page and strip: the mobile directory drawer, the chat sheet, the
   * minimized agent, the line ⌘Z draws over the outline. A reader who opened
   * one of these is looking at it rather than at the page, and it may pass in
   * front of anything at {@link LAYER.page} — the drawer over its own scrim is
   * exactly that pair.
   */
  chrome: "z-40",
  /**
   * The app bar, and the number is deliberately BETWEEN the two around it.
   * This app scrolls the document, so the page runs under a `sticky` header
   * and would paint over it at anything lower than the panels; the modals
   * below cover the whole viewport and must cover this too. `AppHeader.tsx`
   * has the rest of the argument, including why the bar being a stacking
   * context is the reason the panels that hang off it portal out.
   */
  header: "z-[45]",
  /**
   * Over the bar as well: the panels that are PORTALLED out of the header —
   * the commit panel, preferences, the search results — and the tip of a
   * header pill. Those hang against the viewport rather than inside the 3rem
   * box they belong to, so they need a layer of their own up here; sitting at
   * {@link LAYER.page} with the chat dock is how the bar's coral rule cut the
   * first line of a tip and how the dock's own header painted through the
   * rest.
   *
   * The app's two full-screen modals USED TO BE HERE and are not any more:
   * the palette and the shortcuts sheet are modal `<dialog>`s now, so the
   * browser puts them over everything — the header included — and a number
   * here would have been a claim the platform had already made better (see
   * the top-layer section above).
   */
  over: "z-50",
} as const

/**
 * INSIDE ONE BOX, bottom to top — sealed in whatever stacking context the
 * component is drawn in, and saying nothing at all about the page.
 *
 * Single digits, which is the point: a number in this band that leaked into a
 * comparison with {@link LAYER} would be under every one of them, so the
 * mistake shows up as "my handle is behind the panel" in the one component
 * that made it rather than as a layering puzzle across the app.
 */
export const WITHIN = {
  /** Over this box's own content: a resize handle on a panel's edge, the
   *  sidebar's collapse button, a modal's card over the backdrop that is the
   *  modal root's own background. */
  raised: "z-1",
  /** Over ALL of it: an overlay that covers the box end to end, which today is
   *  the chat panel's drop target. */
  cover: "z-2",
  /** A small panel opening inside the box, which has to clear whatever else is
   *  in there — the chat composer's completion, the session list. */
  pop: "z-3",
} as const

/**
 * THE NEWS THAT SOMETHING ENTERED THE TOP LAYER, as a document event.
 *
 * An event rather than a module variable holding the freeze's `lift`, and the
 * reason is ownership rather than taste. A `let` here would be live state in a
 * door — one page-wide slot that outlives every component that writes it, and
 * a remounted frame could leave a dead closure holding the floor with nothing
 * able to tell. A listener has an owner by construction: the freeze registers
 * one inside its own reactive scope and `onCleanup` takes it away with the
 * card, so "a freeze owns the floor" is true for exactly as long as a freeze
 * is mounted and for not one frame longer. Two freezes would be two listeners
 * and both would raise, which is the right answer to a question that cannot
 * arise.
 */
const ENTERED = "olai:top-layer-entered"

/**
 * Put a modal dialog in the top layer, and tell whoever holds its floor.
 *
 * The `open` guard is the platform's rule rather than tidiness: `showModal()`
 * on a dialog that is already open throws, and these are called from effects
 * that re-run for reasons of their own.
 *
 * The news is dispatched AFTER the entry and synchronously, so the floor is
 * re-raised in the same task: nothing is painted in between, and the page is
 * never un-frozen for a frame.
 */
export const enterTopLayer = (dialog: HTMLDialogElement): void => {
  if (!dialog.open) dialog.showModal()
  document.dispatchEvent(new CustomEvent(ENTERED, { detail: dialog }))
}

/**
 * CLAIM THE FLOOR of the top layer for as long as this owner lives: `lift` is
 * called whenever anything ELSE enters it, and must put its own dialog back on
 * top of whatever just arrived.
 *
 * The `detail` check is what keeps the freeze from lifting itself: its own
 * entry is news too, and a card that closed and re-opened on hearing itself
 * would be an endless one.
 */
export const holdTopLayerFloor = (dialog: () => HTMLDialogElement | undefined, lift: () => void): void => {
  const heard = (event: Event) => {
    if ((event as CustomEvent<HTMLDialogElement>).detail === dialog()) return
    lift()
  }
  document.addEventListener(ENTERED, heard)
  onCleanup(() => document.removeEventListener(ENTERED, heard))
}
