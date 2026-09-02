/**
 * The two gestures that shut a panel: a pointer down outside it, and Escape.
 *
 * Every dismissable surface in this client had its own copy of them — the two
 * header popovers through `./popover.ts`, a row's expanded note through
 * `./note/expand.ts`, and the `•••` menu, which had a fourth. They agreed about
 * almost everything and drifted where they did not: one grew Escape, one never
 * had it, and one got its click-away wrong in a way nothing could see. That is
 * the argument for one spelling of it. The fifth caller is the chat's two
 * inline pickers, through one receptacle of their own (`./inlinePicker.ts`) —
 * and the first of them is the odd one in this list: it had no copy, because it
 * answered neither gesture at all.
 *
 * WHICH panel a gesture is for, when more than one is up, is `./topmost.ts` —
 * one stack, and only the last thing opened answers. Every caller here is on it
 * because {@link dismissOn} puts it there, and the panels whose gestures are
 * somebody else's (the `•••` menu's are Kobalte's, the ⌘K palette's are its
 * own, the chat composer's completion takes keys in the capture phase) join that same
 * stack directly. That file lists them, and holds the one rule none of this can
 * enforce: a layer answers a dismissal from the DOCUMENT or later, never from
 * its own box.
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
 * The SolidJS rule is the reason to reach for the library rather than
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
 * What this does NOT own is what "shut" MEANS — whether the trigger toggles
 * instead, whether anything is remembered. That is the caller's, because it
 * differs at every site. WHERE THE CARET GOES it does own, and that is a
 * correction rather than the original boundary: it was left to the caller when
 * there was one caller with a trigger, and the moment there were two the rule
 * ("back to the control that opened it, for the gesture a keyboard can make")
 * was written out twice, word for word. It is mechanical here — a panel with no
 * trigger has nowhere to put it back, so nothing is put back — which is why it
 * costs no flag.
 */

import { createEscapeKeyDown, createInteractOutside } from "@kobalte/core"
import type { Accessor } from "solid-js"

import { topmostWhileOpen } from "./topmost.ts"

export interface Dismissable {
  /** Whether the panel is up. Nothing is listened for while it is not — a shut
   *  panel is not two document listeners for nothing. */
  readonly open: Accessor<boolean>
  /** What counts as INSIDE: a pointer down in here is not a pointer down
   *  outside. The panel, for a panel; the note control, for a note that opens
   *  in place. */
  readonly root: Accessor<HTMLElement | undefined>
  /**
   * The control that opens it, when there is one — which is TWO things, and
   * they are two readings of the same fact.
   *
   * It is not OUTSIDE, which is what a portal makes of every trigger: a
   * portalled panel is not a descendant of its trigger, so a click-away that
   * knows only the panel reads a press of the trigger as a press outside — and
   * since the trigger's own click then reopens what the pointerdown just shut,
   * pressing it a second time does nothing at all.
   *
   * And it is where the CARET goes back to when a KEY shut the panel. Somebody
   * who opened one, tabbed into it and pressed Escape would otherwise land on
   * `<body>`, which is nowhere and the whole page to walk down again. A pointer
   * gets nothing back: it put the caret where it landed and that is where the
   * reader now is, so taking it away would be this panel overruling a press it
   * has nothing to do with.
   *
   * A panel laid out inside its trigger's own root (a row's note) has one root
   * and no control of its own, and leaves this out — which is also what makes
   * the caret rule mechanical rather than a flag: there is nowhere to put it
   * back, so nothing is put back.
   */
  readonly trigger?: Accessor<HTMLElement | undefined>
  /** Shut it. Only that: where the caret goes is above, and everything else a
   *  close MEANS — whether anything is remembered, whether the trigger toggles
   *  instead — is the caller's, because it differs at every site. */
  readonly dismiss: () => void
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
      // the menu above is not also a press that shuts this. The caret stays
      // where the press put it (see `trigger`).
      onPointerDownOutside: () => {
        if (topmost()) on.dismiss()
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
      on.dismiss()
      // AFTER it is gone, and only for the key: until the panel is shut the
      // caret is still on something on its way out.
      on.trigger?.()?.focus()
    },
  })
}
