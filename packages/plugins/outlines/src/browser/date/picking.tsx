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
  readonly openDate: () => void
  readonly openRepeat: () => void
  readonly Panels: (props: { readonly class: string }) => JSX.Element
}

export const createDatePicking = (
  node: Accessor<RegularNode | undefined>,
  forms: RowForm,
): DatePicking => {
  const undo = useUndo()
  return {
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
