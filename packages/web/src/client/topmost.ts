/**
 * WHICH PANEL A GESTURE IS FOR: the open ones, in the order they were opened.
 *
 * Two panels can be up at once, and a dismissal has to choose ONE of them.
 * Until this file existed nothing chose. The `•••` menu shuts inside
 * `@kobalte/core`'s `DismissableLayer`, which keeps a stack of open layers and
 * hands a gesture to the last one opened; the panels this client draws itself
 * shut through the same library's primitives reached one level down
 * (`./dismiss.ts`), which know about nothing else on the page. So a menu
 * opened over a popover neither deferred to it nor was deferred to by it, and
 * **an Escape with both up shut both** — which is not two dismissals, it is one
 * keystroke landing twice, and the second panel going with the first is a panel
 * nobody put away.
 *
 * The rule is one sentence: **every open panel takes a ticket, and only the
 * highest ticket answers.** A second Escape then reaches the next one down,
 * which is what a person pressing it twice means by it.
 *
 * ## Why this is ours, when one of the panels is already the library's
 *
 * `layerStack` is not exported from `@kobalte/core` at any subpath. Its only
 * public door is `DismissableLayer`, a COMPONENT that has to wrap the panel
 * element, and no caller here has one to give it (`./dismiss.ts` has that
 * argument in full — a popover hands out refs so its panels stay ordinary
 * markup, and a note runs on every visible ROW). Reaching the module through
 * `@kobalte/core/src/…` would resolve a SECOND copy beside the bundled one,
 * which is two stacks wearing one name and worse than having none. Nothing else
 * in the dependency set ships one either — `@solid-primitives/*` has no layer
 * stack, and this app has no other UI library.
 *
 * So the stack is ours and the menu joins it (`menu/Dropdown.tsx`), which is
 * the whole reason this is a module of its own rather than a few lines inside
 * `./dismiss.ts`: that file is the two GESTURES and what counts as inside them,
 * and the menu needs none of it — its gestures are the library's already. One
 * consumer that wants only this half is what graduated it, which is the same
 * argument `arriving.ts` graduated on one directory along.
 *
 * ## Why a ticket rather than an array the open ones are pushed onto
 *
 * A push has to happen at the instant `open()` flips, and from an accessor the
 * only place to do that is an effect — which runs a beat LATE, long enough for
 * the capture-phase `pointerdown` that just shut the panel above to be still
 * propagating while this one reads a stack that has not noticed. A memo is a
 * pure computation: it settles inside the same signal write, before the handler
 * that made it returns. So the stack is DERIVED where an array would be
 * maintained, and there is no moment when it disagrees with what is on screen.
 *
 * It is also why nothing here has to think about listener ORDER. Every layer
 * asks the question for itself, at its own turn, and exactly one can answer
 * yes — so it does not matter which document listener runs first, which is not
 * a thing this client gets to decide anyway (some of them are Kobalte's).
 *
 * The other stack in this client is `./layer.ts`, and the two are the same
 * order asked about different things: that one is what COVERS what, in pixels,
 * decided by the design and written down as a table; this one is what shuts
 * FIRST, decided by the reader, in the order they opened things.
 */

import { type Accessor, createMemo, onCleanup } from "solid-js"

/**
 * Tickets, handed out in the order panels OPEN. Monotonic and never reused, so
 * "which of these two opened later" is a comparison rather than a search.
 *
 * Module state because the stack is the PAGE's: "what is on top" is one fact
 * about one screen, and a stack per component tree would be several answers to
 * it. Counting starts at 1 so that `0` — what a shut panel holds — is the
 * BOTTOM of the same order rather than a sentinel beside it: a shut panel is
 * below every open one, which is exactly what the comparison below wants it to
 * mean.
 */
let opened = 0

/**
 * What every dismissable is holding right now — its ticket while it is up, `0`
 * while it is not.
 *
 * Registered for the lifetime of the OWNER rather than of the open state, and
 * that is deliberate on a page with 140 rows of outline in it: an entry here is
 * one accessor in a `Set` and it costs nothing while a note is shut, whereas
 * registering on every open would be a stack that reorders itself under the
 * gesture it is being asked about.
 */
const layers = new Set<Accessor<number>>()

/**
 * Whether this panel is the one a dismissal is for: open, and the last one
 * opened that still is.
 *
 * Call it in the owner that holds the panel's state. The answer is reactive —
 * it reads every layer's ticket — so it may be asked from a gesture handler,
 * from a memo, or from a `<Show>`.
 */
export const topmostWhileOpen = (open: Accessor<boolean>): Accessor<boolean> => {
  // Taken on the way up and kept until it goes down: a panel that is already
  // open does not lose its place because something else re-rendered.
  const ticket = createMemo<number>(
    (held) => (open() ? (held === 0 ? ++opened : held) : 0),
    0,
  )
  layers.add(ticket)
  onCleanup(() => {
    layers.delete(ticket)
  })

  return () => {
    const mine = ticket()
    if (mine === 0) return false
    for (const other of layers) if (other() > mine) return false
    return true
  }
}
