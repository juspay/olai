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
 * `chat/Sessions.tsx` is why: it drew its dropdown at `z-50`, the same
 * utility the command palette covers the entire app with, and it means
 * something else entirely (it is sealed inside the chat panel, which rides at
 * 30). Nothing was broken and nothing could be read.
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
   * Hangs off a ROW, in the outline's own flow — the `•••` menu's panel and
   * the line beside it (`menu/`). Above the rows it is drawn over, and under
   * every piece of chrome: a menu opened next to the chat dock or under the
   * header is the one that gives way, because the reader asked for the chrome
   * first and it is still there when the menu goes.
   */
  row: "z-20",
  /**
   * Over the page, under the chrome that covers it: the docked chat column,
   * the scrim that dims the outline under an open drawer, a tip. What these
   * have in common is that they leave the app's frame reachable — the tip is
   * about something on the page, and the scrim's whole job is to be dismissed
   * by pressing it while the header above it still works (#101).
   */
  page: "z-30",
  /**
   * COVERS the page: the mobile directory drawer, the chat sheet, the
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
   * Over the bar as well: the two full-screen modals (the command palette, the
   * restarted card), and the panels that are PORTALLED out of the header —
   * the commit panel, preferences, the search results. Those three are drawn
   * against the viewport rather than inside the 3rem box they belong to, so
   * they need a layer of their own up here; the modals need one because a
   * question about the whole app may not have the app's own chrome on top of
   * it.
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
   *  in there — the chat composer's slash menu, the session list. */
  pop: "z-3",
} as const
