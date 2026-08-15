/**
 * The `•••` hover menu to the left of a row's collapse triangle — what a row
 * DRAWS, which for almost every row on the page is a button and nothing else.
 *
 * What the entries are is the caller's catalog (`./actions.ts`) over a
 * description this file never reads (`./action.ts`); the primitive that opens,
 * places, dismisses and walks the list is `./Dropdown.tsx`; what the open panel
 * LOOKS like is `./Panel.tsx`; running one and saying what came of it is
 * `./picking.ts` and `./MenuSaid.tsx`; the `•••` before anybody has pressed it
 * is `./Dots.tsx`. This file is the row's own three: the box all of that hangs
 * in, WHICH of the two it is showing, and the line the answers land on.
 *
 * ## A row pays for its menu once it reaches for one — in both currencies
 *
 * `<Show when={armed() && menuReady()}>` is the whole of it, and the two halves
 * are two different costs that happen to fall due at the same instant:
 *
 *   - **`armed()`** (`./door.ts`) is per ROW. A shut `DropdownMenu` is not free
 *     and there is one per outline row: the root builds its disclosure, list and
 *     popper state, and the content's body runs eagerly, which per row is an
 *     `IntersectionObserver`, a deferred autofocus timer, four locale
 *     subscriptions and a few dozen signals. On this app's own roadmap (140
 *     rows) that measured 140 `IntersectionObserver`s and 33 MB of heap against
 *     the hand-rolled panel's none and 19 MB.
 *   - **`menuReady()`** (`./chunk.ts`) is per APP, and it is bytes: the
 *     primitive is 80,516 B raw / 23,438 B brotli, and the lazy mount above did
 *     nothing about it because the entry imported the module whether a row
 *     mounted one or not. Reading it here is what STARTS the fetch, and `&&`
 *     is why that read does not happen until a row is armed.
 *
 * Both are paid on the first ask, and the ask is one gesture: the press that
 * arms the row is the press that opens the menu (`./door.ts` does both in one
 * verb), and a phone's long press is the same verb through the other door.
 *
 * The FALLBACK is the `•••` in both cases, which is what makes the second cost
 * cost nothing to look at: an armed row whose chunk is still in flight goes on
 * drawing the same button in the same cell, and the panel replaces it when it
 * lands. Nothing in the gutter moves, and there is no third thing to draw.
 *
 * ## TWO DOORS, because below 48rem there is no `•••` to press
 *
 * A phone spends no gutter width on the menu (`../touch.ts`), so what opens it
 * there is a LONG PRESS on the row's line (`../longPress.ts`) — markup this
 * component does not own. That is why being open is the ROW's (`./door.ts`)
 * rather than a signal in here, and why the `<div>` below is a zero-width
 * absolute box at the row's left edge until `md`: it cannot simply be `hidden`
 * there, because the panel is inside it and a `display: none` ancestor takes
 * the panel with it. Where the panel is then drawn from is `./Dropdown.tsx`'s
 * `getAnchorRect`. There is no media query in this file at all.
 */

import { Show } from "solid-js"
import { Dynamic } from "solid-js/web"

import type { MenuAction } from "./action.ts"
import { dropdownNow, menuFailure, menuReady } from "./chunk.ts"
import type { MenuDoor } from "./door.ts"
import { Dots } from "./Dots.tsx"
import { MenuSaid } from "./MenuSaid.tsx"
import { createPicking } from "./picking.ts"
import type { Said } from "../edit/undoing.ts"

export function NodeMenu(props: {
  readonly actions: ReadonlyArray<MenuAction>
  /** How this row's menu is reached, and whether it is open — the ROW's,
   *  because below `md` the door is a long press on markup this component does
   *  not own, and the panel then hangs off that same markup (`./door.ts`). */
  readonly door: MenuDoor
}) {
  /** Running a verb, and what it had to say (`./picking.ts`). Created in the
   *  ROW's owner rather than the panel's: the menu is closed by the time most
   *  answers arrive. */
  const picking = createPicking()

  /**
   * What the line beside the `•••` shows — a verb's answer, or the reason the
   * panel is never going to open.
   *
   * The two cannot both be true: a row whose primitive never arrived has run no
   * verb, because there was no panel to run one from. The failure has no
   * countdown, unlike every remark that rides this line, and that is the same
   * decision `../markdown/Markdown.tsx` makes about the same kind of fault — it
   * is not news that happened, it is a state the page is in until it is
   * reloaded, and a sentence that took itself away after six seconds would
   * leave a `•••` that does nothing and says nothing. Only on a row somebody
   * ASKED, so a broken chunk is one sentence where it was reached for rather
   * than one per row on the page.
   */
  const said = (): Said | null => {
    const failed = props.door.armed() ? menuFailure() : undefined
    return failed === undefined
      ? picking.said()
      : { tone: "alarm", text: `${failed.message} — reloading is the way to try again.` }
  }

  return (
    // Positioned root for Kobalte's positioner — in the gutter's flow on a
    // pointer device, where it holds the `•••`, and OUT of it below md, where
    // it holds nothing: a zero-width absolute box at the row's left edge, so
    // the phone's strip is the triangle and the gap arithmetic in `touch.ts`
    // stays what it says it is.
    <div class="absolute inset-y-0 left-0 w-0 shrink-0 md:relative md:w-auto">
      <Show
        when={props.door.armed() && menuReady()}
        fallback={<Dots onArm={props.door.show} />}
      >
        {/* `Dynamic`, because the component itself arrives at runtime
            (`./chunk.ts`): what a static `<Dropdown>` here would cost is the
            static import that puts it back in the first-paint chunk. Typed
            through `dropdownNow`'s return, so the props below are checked
            against the real component. */}
        <Dynamic
          component={dropdownNow()}
          actions={props.actions}
          door={props.door}
          onPick={picking.pick}
        />
      </Show>
      <MenuSaid said={said()} />
    </div>
  )
}
