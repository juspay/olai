/**
 * A row's two DATE panels — the date picker and the repeat picker — as one
 * thing a row holds: the openers its pill and its `•••` call, and ONE
 * component that draws whichever of them is open.
 *
 * `../edges/editing.tsx`'s shape, for its reason: two rows host these now — a
 * tree row (`../Tree.tsx`) and a dated row on a day page or the agenda
 * (`../DatedRow.tsx`) — and without this they would be two copies of "open on
 * the stored value, draw under the line, write through the gate", free to
 * drift about which of those three they did. What each host still owns is
 * WHERE the panels sit, which is the one thing the two rows differ about: past
 * a tree row's hover strip, or past a dated row's bullet.
 *
 * ABOUT THE NODE THE ROW SHOWS, never the record standing there: a placement
 * carries no date and no rule of its own, so a pick at a mirror lands on its
 * target exactly as a mark does. `undefined` on a frame that draws no node (a
 * placement whose chain died), which draws no panel.
 *
 * The drafts are the {@link RowForm} handed in, so whoever owns the row's forms
 * owns their lifetime: a tree's pane keeps them across a rebuild
 * (`./memory.tsx`), and a dated row keeps them for as long as it is drawn.
 */
import type { RegularNode } from "@olai/format"
import { type Accessor, type JSX, Show } from "solid-js"

import { useUndo } from "../edit/undoing.ts"
import { applying } from "../writes.ts"
import { DatePicker } from "./DatePicker.tsx"
import type { RowForm } from "./memory.tsx"
import { datePick, startsAt as dateStartsAt } from "./pick.ts"
import { repeatPick, startsAt as repeatStartsAt } from "./repeat.ts"
import { RepeatPicker } from "./RepeatPicker.tsx"

export interface DatePicking {
  /** Open the date picker on the day the node already has — the pill, and the
   *  `•••` menu's `Set date…` / `Change date…`. */
  readonly openDate: () => void
  /** Open the repeat picker on the rule the node already has — its pill, and
   *  the `•••` menu's `Set repeat…` / `Change repeat…`. */
  readonly openRepeat: () => void
  /** Whichever of the two is open, each in a box of the host's `class`. */
  readonly Panels: (props: { readonly class: string }) => JSX.Element
}

/** Call it in the row's own owner: the undo stack is read there. */
export const createDatePicking = (
  node: Accessor<RegularNode | undefined>,
  forms: RowForm,
): DatePicking => {
  // ⌘Z is one stack for the page, whichever hand wrote: a pick files what would
  // take it back exactly as a keystroke does (`../writes.ts`).
  const undo = useUndo()
  return {
    // Blocks, not expression bodies: a Solid setter answers with the new value,
    // and an opener handed to the `•••` must answer with nothing
    // (`../menu/actions.test.ts`).
    openDate: () => {
      forms.setDate(dateStartsAt(node()?.date))
    },
    openRepeat: () => {
      forms.setRule(repeatStartsAt(node()?.repeat))
    },
    Panels: (props) => (
      <>
        <Show when={forms.date() !== null ? node() : undefined}>
          {(at) => (
            <div class={props.class}>
              <DatePicker
                submission={forms.dateSubmission}
                date={at().date}
                chosen={forms.date() ?? { day: "", time: "" }}
                onChange={forms.setDate}
                onPick={(value) => applying(datePick(at().id, value), undo.record)}
                onClose={() => forms.setDate(null)}
              />
            </div>
          )}
        </Show>
        <Show when={forms.rule() !== null ? node() : undefined}>
          {(at) => (
            <div class={props.class}>
              <RepeatPicker
                submission={forms.repeatSubmission}
                repeat={at().repeat}
                rule={forms.rule() ?? ""}
                onChange={forms.setRule}
                onPick={(rule) => applying(repeatPick(at().id, rule), undo.record)}
                onClose={() => forms.setRule(null)}
              />
            </div>
          )}
        </Show>
      </>
    ),
  }
}
