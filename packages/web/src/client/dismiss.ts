/**
 * The two gestures that shut a panel: a pointer down outside it, and Escape.
 *
 * Every dismissable surface in this client had its own copy of them — the two
 * header popovers through `./popover.ts`, a row's expanded note through
 * `./note/expand.ts`, the chat's session picker (`chat/Sessions.tsx`), and the
 * `•••` menu, which had a fourth. They agreed about almost everything and
 * drifted where they did not: one grew Escape, one never had it, one got its
 * click-away wrong in a way nothing could see, and one answered neither gesture
 * at all. That is the argument for one spelling of it.
 *
 * WHICH panel a gesture is for, when more than one is up, is `./topmost.ts` —
 * one stack, and only the last thing opened answers. Everything below is on it,
 * because {@link dismissOn} puts it there; the `•••` menu joins that same stack
 * from the other side (`menu/Dropdown.tsx`), since its gestures are already the
 * library's and only the ORDER was missing.
 *
 * ## Which is Kobalte's, not ours
 *
 * The `•••` menu is a `@kobalte/core` `DropdownMenu` (`menu/Dropdown.tsx`), and
 * this is the same library's dismissal reached one layer down, so the panels
 * that are NOT primitives yet shut by the same code the one that is shuts by.
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
 * two gestures already composed AND the stack `./topmost.ts` had to rebuild: it
 * is a COMPONENT that has to wrap the panel element, and no caller has one to
 * give it. `./popover.ts` is a factory that hands out refs precisely so the two
 * panels it serves stay ordinary markup, and `./note/expand.ts` runs on every
 * visible ROW — a layer that registers on mount, with no way to sit out while
 * the note is shut, would put one on the stack per row of the outline. An
 * accessor plus `isDisabled` is the shape these callers need, and it is the
 * shape the stack takes for the same reason: a layer is a panel that is OPEN,
 * never a component that exists.
 *
 * What this does NOT own is what "shut" MEANS — where the focus goes, whether
 * the trigger toggles instead, whether anything is remembered. That is the
 * caller's, because it differs at every site.
 */

import { createEscapeKeyDown, createInteractOutside } from "@kobalte/core"
import type { Accessor } from "solid-js"

import { topmostWhileOpen } from "./topmost.ts"

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
