/**
 * The doors to a row's `•••` menu: how it is opened, and whether it is open.
 *
 * The `•••` is the pointer's door and it is drawn beside the panel
 * (`./Dots.tsx`, and `./Dropdown.tsx`'s trigger once a row is armed). A phone
 * has no `•••` at all — a 390px screen has no room for a
 * second always-on cell before the title (`../touch.ts`) — so its door is a
 * LONG PRESS on the row line (`../longPress.ts`), which is markup the menu
 * does not own. Something both of them can hold has to exist somewhere, and
 * this is it: one state, the verb that opens it, the handlers the second door
 * is made of, and the element both of those are about.
 *
 * **Everything the row has to wire, from one call**, rather than a state here
 * and a `longPressOn(door.show)` and a ref the caller is trusted to point at
 * the same element: a row that wired one and forgot another would be a row a
 * phone cannot reach, or a panel hanging off nothing — and both look exactly
 * like a row that works. What "how this menu is reached" MEANS is this
 * module's question, and the answer is several things, so it hands back
 * several things. The gesture itself stays general — `../longPress.ts` knows
 * nothing about menus — and this is where it is spent.
 *
 * The shape is the one this client already uses for "who opens this surface"
 * (`../palette/open.ts`, `../chat/open.ts`): the state lives outside the
 * component that draws the surface, because more than one thing opens it. It
 * is a factory rather than a module signal for the one reason those are not —
 * there is one of these per ROW, and a module-scoped signal would be one menu
 * for the whole outline.
 *
 * A row's menu is in one of THREE states, and they are three rather than two
 * because of the lazy mount `./Dots.tsx` exists for:
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

import { HANDLE } from "../drag/dragging.ts"
import { type LongPress, longPressOn } from "../longPress.ts"

/** All of what a row's menu is. */
type Door = "unasked" | "shut" | "open"

export interface MenuDoor {
  /** The phone's door, as the two handlers that make it. Put them on the row's
   *  own line, which is what a finger is held on — everywhere but the handle,
   *  and that exception is answered in here rather than by the row. */
  readonly hold: LongPress
  /** Wire as `ref` on that same line. It is the same element twice for a
   *  reason: what a finger is held ON is what the panel then hangs OFF, since
   *  below `md` there is no `•••` in the gutter to hang it off — so the door
   *  hands out both rather than leaving a row to keep two things pointing at
   *  one element by hand. */
  readonly line: (el: HTMLElement) => void
  /** ...and what that caught, for the panel's placement. */
  readonly at: () => HTMLElement | undefined
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

/**
 * ...EXCEPT ON THE ROW'S HANDLE, and this is the door's answer rather than the
 * row's.
 *
 * A phone picks a row up by HOLDING its bullet (`../drag/dragging.ts`), which
 * is the same gesture on the same row — and two long presses cannot both own
 * one press. The one that gives way is this door, because the menu has a whole
 * row to be reached from and a handle has only itself. It is answered HERE for
 * the reason everything else about this door is: "how this menu is reached" is
 * this module's question, and a rule spelled at the row is a rule the next row
 * forgets.
 *
 * TOUCH ONLY, which is not belt and braces: below the deadline this watcher
 * still has bookkeeping to do for a mouse or a pen (`../longPress.ts` resets
 * itself on one), and skipping it wholesale would leave that state stale — as
 * well as walking the ancestors of every press on every device to answer a
 * question only a finger can ask.
 */
const onTheHandle = (event: PointerEvent): boolean =>
  event.pointerType === "touch" &&
  event.target instanceof Element &&
  event.target.closest(`[${HANDLE}]`) !== null

/** Call it in the row's own owner: the gesture's timer and its listeners are
 *  disposed with the row that was being pressed. */
export const createMenuDoor = (): MenuDoor => {
  const [door, setDoor] = createSignal<Door>("unasked")
  const show = (): void => {
    setDoor("open")
  }
  const press = longPressOn(show)
  /** Not a signal: it is read when the panel is placed, which is after the row
   *  has been drawn, and nothing re-runs when it arrives. */
  let line: HTMLElement | undefined

  return {
    hold: {
      onPointerDown: (event) => {
        if (onTheHandle(event)) return
        press.onPointerDown(event)
      },
      onContextMenu: press.onContextMenu,
    },
    line: (el) => {
      line = el
    },
    at: () => line,
    show,
    armed: () => door() !== "unasked",
    open: () => door() === "open",
    // Shut, never back to unasked: what is mounted stays mounted, and the row
    // that has been asked once is the row that pays once.
    setOpen: (next) => setDoor(next ? "open" : "shut"),
  }
}
