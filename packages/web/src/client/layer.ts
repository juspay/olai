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
 *   - the offline freeze (`connection/Offline.tsx`), which arrives last
 *     whenever it arrives at all.
 *
 * **NOTHING ENTERS OVER THE FREEZE**, and it is worth saying why rather than
 * arranging it. Dialogs stack in the order they were opened, so a palette
 * asked to open while the app is frozen would take the layer ABOVE the freeze
 * — a working door on a page whose whole news is that there is nowhere to
 * send anything. It cannot be asked for: every entry here is either a GESTURE
 * (the freeze swallows chords at the window's capture phase for as long as it
 * is up, and the page under it is inert) or the arrival of a MESSAGE (which
 * means the wire is alive, the one thing a freeze says it is not). A
 * mechanism that re-raised the freeze over whatever had just entered was
 * written and then deleted: three stagings — another tab changing the plugin
 * roster, the settings file taking the overlay host away and giving it back,
 * and the server restarting under an open palette — never once entered this
 * layer with the freeze standing. A surface that can open from a TIMER rather
 * than from a gesture or a message is the one that would change that, and it
 * owes this paragraph an answer.
 *
 * `claims.test.ts` sweeps both halves — who calls `showModal` and who enters
 * through {@link enterTopLayer} — so a fourth surface reaching for the layer
 * has to argue with that list first. It owes one more answer while it is
 * here: a `<Tip>` drawn inside it would portal to `document.body` and be
 * painted UNDER it (`./Tip.tsx` says what to add), because nothing in this
 * list raises one today.
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
 * ENTER THE TOP LAYER. The `open` guard is the platform's rule rather than
 * tidiness: `showModal()` on a dialog that is already open throws, and these
 * are called from effects that re-run for reasons of their own.
 *
 * One line, and it is a DOOR rather than a convenience: the sweep in
 * `./claims.test.ts` is written over this name, so the surfaces that take the
 * whole app are a list somebody has to join on purpose.
 */
export const enterTopLayer = (dialog: HTMLDialogElement): void => {
  if (!dialog.open) dialog.showModal()
}
