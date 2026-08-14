/**
 * Who may open a row's `•••` menu — which is a question the ROW answers now,
 * because there are two doors and only one of them is inside the menu.
 *
 * The `•••` is the pointer's door and it lives in the panel's own component
 * (`./NodeMenu.tsx`). A phone has no `•••` — a 390px screen has no room for a
 * second always-on cell before the title (`../touch.ts`) — so its door is a
 * LONG PRESS on the row line (`../longPress.ts`), which is markup the menu
 * does not own. Something both of them can hold has to exist somewhere, and
 * this is the smallest thing that will do: two booleans and the one verb that
 * writes them.
 *
 * The two booleans are not one, and the difference is the lazy mount that
 * `NodeMenu`'s `Dots` exists for:
 *
 *   - **`armed`** is "has this row ever been asked for its menu" and never
 *     goes back. Until it is true, Kobalte is not mounted on this row at all
 *     — measured at 140 `IntersectionObserver`s and 33 MB of heap on this
 *     app's own roadmap when every row paid.
 *   - **`open`** is whether the panel is up right now, and it moves both ways
 *     — the primitive's own trigger and its dismissals write it through
 *     {@link MenuDoor.setOpen}.
 *
 * That is also why the menu is CONTROLLED rather than mounted `defaultOpen`:
 * an armed row asked a second time (a second long press) has a primitive
 * already sitting there with nothing to remount, and only an open state it
 * does not own can be told to come back.
 */

import { type Accessor, createSignal } from "solid-js"

export interface MenuDoor {
  /** Has this row ever been asked for its menu? Nothing of the primitive is
   *  mounted until it has. */
  readonly armed: Accessor<boolean>
  /** Is the panel up? */
  readonly open: Accessor<boolean>
  /** Ask for it: the `•••`, or a long press on the row. Arms the row on the
   *  way through, so the first ask is also the first mount. */
  readonly show: () => void
  /** What the primitive says about its own open state — its trigger toggling,
   *  Escape, a pointer outside, an entry chosen. */
  readonly setOpen: (open: boolean) => void
}

export const createMenuDoor = (): MenuDoor => {
  const [armed, setArmed] = createSignal(false)
  const [open, setOpen] = createSignal(false)

  return {
    armed,
    open,
    show: () => {
      setArmed(true)
      setOpen(true)
    },
    setOpen: (next) => setOpen(next),
  }
}
