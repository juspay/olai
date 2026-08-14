/**
 * Who may open a row's `•••` menu — which is a question the ROW answers now,
 * because there are two doors and only one of them is inside the menu.
 *
 * The `•••` is the pointer's door and it lives in the panel's own component
 * (`./NodeMenu.tsx`). A phone has no `•••` — a 390px screen has no room for a
 * second always-on cell before the title (`../touch.ts`) — so its door is a
 * LONG PRESS on the row line (`../longPress.ts`), which is markup the menu
 * does not own. Something both of them can hold has to exist somewhere, and
 * this is the smallest thing that will do: one state, and the verb that opens
 * it.
 *
 * A row's menu is in one of THREE states, and they are three rather than two
 * because of the lazy mount `NodeMenu`'s `Dots` exists for:
 *
 *   - **unasked** — nobody has reached for this row's menu, so Kobalte is not
 *     mounted on the row at all. Measured at 140 `IntersectionObserver`s and
 *     33 MB of heap on this app's own roadmap when every row paid.
 *   - **shut** — mounted, not up. Nothing goes back from here to unasked.
 *   - **open** — the panel is on screen.
 *
 * ONE signal over the three rather than an `armed` boolean beside an `open`
 * one: that pair can be written as "open, and never asked for", which is not
 * a thing a row can be, and every site that moved either would have to
 * remember the other. Here `armed` and `open` are two READINGS of the one
 * state and cannot disagree.
 *
 * It is also why the menu is CONTROLLED rather than mounted `defaultOpen`: an
 * armed row asked a second time (a second long press) has a primitive already
 * sitting there with nothing to remount, and only an open state it does not
 * own can be told to come back.
 */

import { type Accessor, createSignal } from "solid-js"

/** All of what a row's menu is. */
type Door = "unasked" | "shut" | "open"

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
  const [door, setDoor] = createSignal<Door>("unasked")

  return {
    armed: () => door() !== "unasked",
    open: () => door() === "open",
    show: () => setDoor("open"),
    // Shut, never back to unasked: what is mounted stays mounted, and the row
    // that has been asked once is the row that pays once.
    setOpen: (next) => setDoor(next ? "open" : "shut"),
  }
}
