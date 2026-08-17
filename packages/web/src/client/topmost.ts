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
 * ## WHO IS ON IT
 *
 * The header's two popovers, a row's expanded note and the chat's session
 * picker, through `./dismiss.ts` — which takes a ticket for every caller, so a
 * new panel is on the stack by being written the ordinary way. And four others
 * that join here directly, because their gestures are somebody else's:
 *
 *   - the `•••` menu (`menu/Dropdown.tsx`) — Kobalte's `DismissableLayer`,
 *     which has a stack of its own that these panels cannot get onto;
 *   - the ⌘K palette (`palette/Palette.tsx`) — Escape on the window, and a
 *     press on its own full-screen scrim;
 *   - the keyboard-shortcuts dialog (`palette/Shortcuts.tsx`), which the
 *     palette opens — the same two, and it answered neither until review
 *     found it;
 *   - the chat composer's completion (`chat/CompletionMenu.tsx`) — the box
 *     over the message input, drawing the agent's commands under a `/` and the
 *     directory's files under an `@`; a capture-phase listener that takes the
 *     key before anything else on the page can see it.
 *
 * `claims.test.ts` sweeps that list, in both directions.
 *
 * ## WHERE A LAYER MUST LISTEN, which is the one thing this cannot enforce
 *
 * A layer answers a dismissal from the DOCUMENT or later — never from its own
 * element. The reason is exact: handlers run target-first, so a panel that
 * shuts itself at its own box does it before anything listening on the document
 * has been asked, and the panel UNDER it is then the highest ticket by the time
 * it is. One keystroke, two panels, and the stack is what says so at each
 * listener rather than once for the gesture. That is how ⌘K over an open
 * popover shut both even after the palette had joined this stack: its box
 * answered Escape as well as its window listener did, and the box went first.
 * The fix was to delete the earlier answer, and the rule is written beside each
 * of the four joins above.
 *
 * A layer that stops the event at its own element instead (`date/DatePicker.tsx`,
 * `edges/EdgePanel.tsx`) is the other lawful shape and needs no ticket: nothing
 * below is asked at all, because the event never reaches the document. Those
 * are caret-scoped — a bare key where the caret is, `keys.ts`'s own layer — and
 * they are deliberately not on this stack.
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
 * Registered for the lifetime of the OWNER rather than of the open state,
 * because registering on every open would be a stack that reorders itself under
 * the gesture it is being asked about. What that costs, said plainly because
 * `note/expand.ts` calls this once per visible ROW: on a 140-row outline this
 * is 140 memos subscribed to 140 `open()` signals and 140 entries in the `Set`,
 * held until the row goes — a third reactive node beside the two effects
 * `./dismiss.ts` already makes per row, and a scan of 140 numbers on each of
 * the two gestures. Both are dwarfed by anything else a row does; neither is
 * nothing.
 */
const layers = new Set<Accessor<number>>()

/**
 * Whether this panel is the one a dismissal is for: open, and the last one
 * opened that still is.
 *
 * Call it in the owner that holds the panel's state, and ask it from a GESTURE
 * HANDLER. It is reactive, so a `<Show>` or a memo may read it — but such a
 * reader subscribes to every layer's ticket, so anything opening or closing
 * anywhere on the page would invalidate it, and one per row would be that
 * squared. Nothing needs to draw from this; a dismissal asks once and acts.
 */
export const topmostWhileOpen = (open: Accessor<boolean>): Accessor<boolean> => {
  // Taken on the way up and KEPT until it goes down — `held || ++opened`, and
  // the `held` is what makes it exactly one ticket per opening: `open` is an
  // accessor the caller derived, so it may re-fire without the answer changing
  // (`chat/Sessions.tsx`'s does, when the agent's list arrives), and a panel
  // must not climb the stack because something inside it moved.
  const ticket = createMemo<number>((held) => (open() ? held || ++opened : 0), 0)
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
