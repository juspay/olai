/**
 * The two gestures that shut a panel: a pointer down outside it, and Escape.
 *
 * Every dismissable surface in this client had its own copy of them — the two
 * header popovers through `./popover.ts`, a row's expanded note through
 * `./note/expand.ts`, and the `•••` menu, which had a fourth. They agreed
 * about almost everything and drifted where they did not: one grew Escape, one
 * never had it, and one got its click-away wrong in a way nothing could see.
 * That is the argument for one spelling of it.
 *
 * ## Which is Kobalte's, not ours
 *
 * The `•••` menu is a `@kobalte/core` `DropdownMenu` now (`menu/NodeMenu.tsx`),
 * and this is the same library's dismissal reached one layer down, so the
 * panels that are NOT primitives yet shut by the same code the one that is
 * shuts by. Not the same INSTANCE of it, which is the honest version of that
 * sentence: the menu shuts through Kobalte's own `DismissableLayer`, these two
 * through `createInteractOutside` here, and the two are unaware of each other
 * (the layer STACK is what this misses — a panel here neither defers to nor is
 * deferred to by a menu over it, so an Escape with both up shuts both. Two
 * chrome popovers and a row menu barely coexist, which is why that is a
 * recorded cost rather than a bug).
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
 * the shape these two need.
 *
 * What this does NOT own is what "shut" MEANS — where the focus goes, whether
 * the trigger toggles instead, whether anything is remembered. That is the
 * caller's, because it differs at every site.
 */

import { createEscapeKeyDown, createInteractOutside } from "@kobalte/core"
import type { Accessor } from "solid-js"

/** Which gesture asked. Callers that put the caret back only for the one a
 *  keyboard can make (`./popover.ts`) need to tell them apart. */
export type Dismissal = "pointer" | "escape"

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
 * Wire the two gestures for as long as `open()` says the panel is up.
 *
 * Call it in the owner that holds the panel's state — it is a Solid primitive,
 * so the listeners are disposed with that owner as well as with the panel.
 */
export const dismissOn = (on: Dismissable): void => {
  const shut = () => !on.open()

  createInteractOutside(
    {
      isDisabled: shut,
      // The trigger counts as inside, and only ever the trigger: the root is
      // the ref below, and Kobalte checks that one itself.
      shouldExcludeElement: (element) =>
        on.trigger?.()?.contains(element) === true,
      onPointerDownOutside: () => on.dismiss("pointer"),
    },
    on.root,
  )

  createEscapeKeyDown({
    isDisabled: shut,
    onEscapeKeyDown: (event) => {
      // The key is SPENT on the panel that shut. Nothing in this client reads
      // `defaultPrevented` off a keystroke, so this is about the browser's own
      // default rather than about the rest of the app: the editors and the
      // palette match on `event.key` and go on seeing it.
      event.preventDefault()
      on.dismiss("escape")
    },
  })
}
