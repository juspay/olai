import { TESTID } from "olai-plugin-outlines/testids"
import { REPEAT_RULES } from "@olai/format"
import { For } from "solid-js"

import type { Press } from "../edit/panel.ts"
import type { Submission } from "../edit/submission.ts"
import { RowPanel } from "../edit/RowPanel.tsx"
import type { Said } from "@olai/web/client/saying.ts"

import { TARGET } from "@olai/ui-primitives/touch.ts"
import { noticeOf, pressOf } from "./repeat.ts"

const IDS = {
  panel: TESTID.repeatPicker,
  set: TESTID.repeatPickerSet,
  cancel: TESTID.repeatPickerCancel,
  said: TESTID.repeatPickerSaid,
  notice: TESTID.repeatPickerNotice,
} as const

export function RepeatPicker(props: {
  readonly repeat: string | undefined
  readonly rule: string
  readonly onChange: (value: string) => void
  readonly submission: Submission
  readonly onPick: (rule: string) => Promise<Said | undefined>
  readonly onClose: () => void
}) {
  const rule = () => props.rule
  const press = (): Press => pressOf(props.repeat, rule())

  return (
    <RowPanel
      submission={props.submission}
      ids={IDS}
      press={press}
      send={() => props.onPick(rule())}
      onClose={props.onClose}
      notice={noticeOf(props.repeat)}
    >
      <label class="flex max-w-full flex-wrap items-center gap-2 text-label text-muted">
        Repeats
        <select
          class={`${TARGET} min-w-0 max-w-full md:min-h-0 rounded-control border border-rule bg-paper px-2 py-1 text-body text-ink`}
          data-testid={TESTID.repeatPickerRule}
          value={rule()}
          ref={(element) => queueMicrotask(() => element.focus())}
          onInput={(event) => props.onChange(event.currentTarget.value)}
        >
          <option value="">Does not repeat</option>
          <For each={REPEAT_RULES}>{(one) => <option value={one}>{one}</option>}</For>
        </select>
      </label>
    </RowPanel>
  )
}
