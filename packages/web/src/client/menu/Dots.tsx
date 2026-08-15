/**
 * The `•••` itself: the class both spellings of it wear, and the BUTTON it is
 * before this row has ever been asked for its menu.
 *
 * Its own file because it exists for a reason that has nothing to do with what
 * a menu is — {@link Dots} is a cost decision, and the adoption of Kobalte is
 * what made it one. THE OUTLINE IS HUNDREDS OF ROWS, and a `DropdownMenu` is
 * not free while it is shut: the root builds its disclosure state, its list
 * state and its popper, and the content's body runs eagerly (only its DOM
 * waits on the open state), which between them is an `IntersectionObserver`, a
 * deferred autofocus timer, four locale subscriptions and a few dozen signals
 * PER ROW. Measured on this app's own roadmap (140 rows): 140
 * IntersectionObservers and 33 MB of heap where the hand-rolled panel had none
 * and 19 MB.
 *
 * So a row mounts the primitive the first time somebody reaches for it, and
 * the press that armed it is the press that opens it (`./door.ts` does both in
 * one verb). The row stays armed afterwards — the second press is Kobalte's
 * own trigger, doing its own toggle. Only rows a person has actually touched
 * ever pay, which on any real page is a handful. A phone's long press arms a
 * row the same way, through the same door, and is the reason that door is a
 * value rather than a signal inside the menu.
 *
 * {@link DOTS} is here rather than beside the trigger because the two stand in
 * for each other: a class on one and not the other would be a flicker at the
 * press.
 */

import { MENU_CELL, MENU_REVEAL } from "../touch.ts"
import { TESTID } from "../testids.ts"

/**
 * The one spelling both the dead button and Kobalte's trigger are drawn from.
 *
 * `MENU_CELL` is the box, and it is `display: none` below md: a 390px screen
 * has no room for a second always-on cell before the title (`../touch.ts`), so
 * the `•••` is not drawn there — not focusable, not announced, not a gutter
 * cell. What a phone opens the menu with instead is a long press on the row
 * (`./door.ts`); the trigger stays in the MARKUP because it is what holds the
 * primitive's state, and the panel hangs off the row's own line while it has
 * no box (`./Dropdown.tsx`'s `getAnchorRect`).
 */
export const DOTS =
  `${MENU_CELL} ${MENU_REVEAL} cursor-pointer border-0 bg-transparent p-0 ` +
  "text-[0.65rem] leading-none tracking-[0.05em] text-muted hover:text-ink"

/**
 * The `•••` before anybody has pressed it: the same three dots, drawn by a
 * `<button>` that costs nothing.
 *
 * The KEYS matter as much as the pointer here: this button is what a Tab lands
 * on, so the keys that open a menu have to arm it too, or a keyboard would
 * press an inert button. Enter, Space and the two arrows Kobalte's own trigger
 * opens on, and the caret lands in the panel from there (`./Dropdown.tsx`'s
 * content ref).
 */
export function Dots(props: { readonly onArm: () => void }) {
  const arm = (event: Event): void => {
    // The same reason Kobalte's trigger stops these: opening a row's menu is
    // not also a press on the row it belongs to.
    event.stopPropagation()
    props.onArm()
  }

  return (
    <button
      type="button"
      class={DOTS}
      data-testid={TESTID.nodeMenu}
      aria-haspopup="true"
      aria-expanded={false}
      aria-label="node menu"
      title="node menu"
      onPointerDown={arm}
      onKeyDown={(event) => {
        if (!["Enter", " ", "ArrowDown", "ArrowUp"].includes(event.key)) return
        // Prevented HERE, unlike the press above: Space would scroll the page
        // out from under the menu it just opened, and Enter on a button
        // synthesises a click that would arrive at whatever took this one's
        // place.
        event.preventDefault()
        arm(event)
      }}
      onClick={(event) => event.stopPropagation()}
    >
      •••
    </button>
  )
}
