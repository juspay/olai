/**
 * The two gestures that shut a panel — a pointer down outside it, and Escape —
 * and WHICH panel they shut when more than one is up.
 *
 * Every dismissable surface in this client had its own copy of the gestures —
 * the two header popovers through `./popover.ts`, a row's expanded note through
 * `./note/expand.ts`, and the `•••` menu, which had a fourth. They agreed about
 * almost everything and drifted where they did not: one grew Escape, one never
 * had it, and one got its click-away wrong in a way nothing could see. That is
 * the argument for one spelling of it.
 *
 * ## ONE STACK, and the topmost answers
 *
 * A spelling shared is not a DISCIPLINE shared, and that was the hole #158
 * recorded at its own merge: the `•••` menu shuts inside `@kobalte/core`'s
 * `DismissableLayer`, which keeps a stack of open layers and hands a gesture to
 * the last one opened; the panels here shut through `createInteractOutside` and
 * `createEscapeKeyDown` directly, which know about nothing else on the page. So
 * a menu opened over a popover neither deferred to it nor was deferred to by
 * it, and one Escape shut both — which is not two panels being dismissed, it is
 * a keystroke landing twice.
 *
 * {@link topmostWhileOpen} is the stack that fixes it, and everything
 * dismissable in this client is on it: the two popovers and the note through
 * {@link dismissOn} below, the chat's session picker (`chat/Sessions.tsx`) the
 * same way, and the menu by joining it directly (`menu/Dropdown.tsx`) — because
 * the library's own layer, being the only Kobalte layer on the page, always
 * believes it is on top. **Every open panel takes a ticket, and only the
 * highest ticket answers.** A second Escape then reaches the next one down,
 * which is what a person pressing it twice means.
 *
 * WHY OURS AND NOT KOBALTE'S, since one of the two panels here is already the
 * library's: `layerStack` is not exported from `@kobalte/core` at any subpath —
 * the only public door to it is `DismissableLayer`, a COMPONENT that has to
 * wrap the panel element, and no caller here has one to give it (see below).
 * Reaching the module through `@kobalte/core/src/…` would resolve a SECOND copy
 * beside the bundled one, which is two stacks wearing one name and worse than
 * having none. So the stack is ours and the menu joins it — one place that
 * knows what is open, rather than two that each believe they are alone.
 *
 * ## The gestures, which are the library's
 *
 * The two primitives below are also, since `menu/chunk.ts`, the ONLY
 * `@kobalte/core` left on the first-paint chunk: `DropdownMenu` is fetched when
 * a row is first asked for its menu, and what stays behind is
 * `createEscapeKeyDown`, `createInteractOutside` and the layer stack they share:
 * ~10 kB raw / ~3 kB brotli, measured by stubbing the two out, against the
 * menu's ~80 kB / ~23 kB. These panels are up at first paint, so their
 * dismissal has to be.
 *
 * HACKING.md's SolidJS rule is the reason to reach for the library rather than
 * keep a hand-rolled listener pair that happens to be shared:
 * `createInteractOutside` is `pointerdown` in the CAPTURE phase (so a press
 * that also navigates still shuts this first, and a trigger's own click cannot
 * race a bubble-phase listener), deferred by a tick past the press that opened
 * the panel, and it defers a TOUCH to the `click` that follows — which is the
 * one thing every copy here got wrong by never considering it.
 *
 * **Why the primitives and not `DismissableLayer` itself**, which is the same
 * two gestures already composed: it is a COMPONENT that has to wrap the panel
 * element, and neither caller has one to give it. `./popover.ts` is a factory
 * that hands out refs precisely so the two panels it serves stay ordinary
 * markup, and `./note/expand.ts` runs on every visible ROW — a layer that
 * registers on mount, with no way to sit out while the note is shut, would put
 * one on the stack per row of the outline. An accessor plus `isDisabled` is
 * the shape these two need, and it is the shape the stack below takes for the
 * same reason: a layer is a panel that is OPEN, never a component that exists.
 *
 * What this does NOT own is what "shut" MEANS — where the focus goes, whether
 * the trigger toggles instead, whether anything is remembered. That is the
 * caller's, because it differs at every site.
 *
 * The other stack in this client is `./layer.ts`, and the two are the same
 * order asked about different things: that one is what COVERS what, in pixels,
 * decided by the design; this one is what shuts FIRST, decided by the reader,
 * in the order they opened things.
 */

import { createEscapeKeyDown, createInteractOutside } from "@kobalte/core"
import { type Accessor, createMemo, onCleanup } from "solid-js"

/** Which gesture asked. Callers that put the caret back only for the one a
 *  keyboard can make (`./popover.ts`) need to tell them apart. */
export type Dismissal = "pointer" | "escape"

/**
 * Tickets, handed out in the order panels OPEN. Monotonic and never reused, so
 * "which of these two opened later" is a comparison rather than a search.
 *
 * Module state because the stack is the PAGE's: "what is on top" is one fact
 * about one screen, and a stack per component tree would be several answers to
 * it. `0` is the ticket a shut panel holds, which is why counting starts at 1.
 */
let opened = 0

/**
 * What every dismissable is holding right now — its ticket while it is up, `0`
 * while it is not. Registered for the lifetime of the OWNER rather than of the
 * open state, because a `Set` entry costs nothing while a note is shut and
 * re-registering on every open would be a stack that reorders itself.
 */
const layers = new Set<Accessor<number>>()

/**
 * Whether this panel is the one a dismissal is for: open, and the last one
 * opened that still is.
 *
 * Call it in the owner that holds the panel's state. The answer is reactive —
 * it reads every layer's ticket — so it may be asked from a gesture handler,
 * from a memo, or from a `<Show>`.
 *
 * WHY A TICKET RATHER THAN AN ARRAY the open ones are pushed onto: a push has
 * to happen at the instant `open()` flips, and the only place to do that from
 * an accessor is an effect, which runs a beat LATE — long enough for a
 * capture-phase `pointerdown` that shut the panel above to be still propagating
 * while this one reads a stack that has not noticed. A memo is a pure
 * computation: it settles inside the same signal write, before the handler that
 * made it returns. So the stack is derived where an array would be maintained.
 *
 * It is also why nothing here has to think about listener ORDER. Every layer
 * asks this question for itself, at its own turn, and exactly one can answer
 * yes — so it does not matter which document listener runs first.
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

export interface Dismissable {
  /** Whether the panel is up. Nothing is listened for while it is not — a shut
   *  panel is not two document listeners for nothing. */
  readonly open: Accessor<boolean>
  /** What counts as INSIDE: a pointer down in here is not a pointer down
   *  outside. The panel, for a panel; the note control, for a note that opens
   *  in place. */
  readonly root: Accessor<HTMLElement | undefined>
  /**
   * The control that opens it, when it is OUTSIDE that root — which is what a
   * portal makes of every trigger.
   *
   * Two roots, and it is the bug worth naming: a portalled panel is not a
   * descendant of its trigger, so a click-away that knows only the panel reads
   * a press of the trigger as a press outside — and since the trigger's own
   * click then reopens what the pointerdown just shut, pressing it a second
   * time does nothing at all. A panel laid out inside its trigger's own root
   * (a row's note) has one root and leaves this out.
   */
  readonly trigger?: Accessor<HTMLElement | undefined>
  /** Shut it. */
  readonly dismiss: (how: Dismissal) => void
}

/**
 * Wire the two gestures for as long as `open()` says the panel is up, and put
 * the panel on the stack while it is.
 *
 * Call it in the owner that holds the panel's state — it is a Solid primitive,
 * so the listeners are disposed with that owner as well as with the panel.
 */
export const dismissOn = (on: Dismissable): void => {
  const shut = () => !on.open()
  const topmost = topmostWhileOpen(on.open)

  createInteractOutside(
    {
      isDisabled: shut,
      // The trigger counts as inside, and only ever the trigger: the root is
      // the ref below, and Kobalte checks that one itself.
      shouldExcludeElement: (element) =>
        on.trigger?.()?.contains(element) === true,
      // Outside THIS panel, and outside everything over it: a press that shut
      // the menu above is not also a press that shuts this.
      onPointerDownOutside: () => {
        if (topmost()) on.dismiss("pointer")
      },
    },
    on.root,
  )

  createEscapeKeyDown({
    isDisabled: shut,
    onEscapeKeyDown: (event) => {
      if (!topmost()) return
      // The key is SPENT on the panel that shut. Nothing in this client reads
      // `defaultPrevented` off a keystroke, so this is about the browser's own
      // default rather than about the rest of the app: the editors and the
      // palette match on `event.key` and go on seeing it.
      event.preventDefault()
      on.dismiss("escape")
    },
  })
}
