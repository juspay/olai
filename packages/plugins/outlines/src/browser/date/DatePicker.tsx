import { useShown } from "olai-plugin-navigation/routing"
import { createEffect } from "solid-js"
import { TESTID } from "olai-plugin-outlines/testids"
import type { Press } from "../edit/panel.ts"
import type { Submission } from "../edit/submission.ts"
import { RowPanel } from "../edit/RowPanel.tsx"
import type { Said } from "@olai/web/client/saying.ts"

import { TARGET } from "@olai/ui-primitives/touch.ts"
import { PANEL_OUT } from "@olai/web/client/pill.ts"
import { Show } from "solid-js"
import { createStore } from "solid-js/store"
import { browserInstantAt, type Chosen, noticeOf, pressOf, valueOf } from "./pick.ts"

const NO_TIME = "No time"

type Box = keyof Chosen

const UNFINISHED: Record<Box, string> = {
  day: "The day is not finished. Finish it, or empty it.",
  time: `The time is not finished. Finish it, or press ${NO_TIME}.`,
}

const IDS = {
  panel: TESTID.datePicker,
  set: TESTID.datePickerSet,
  cancel: TESTID.datePickerCancel,
  said: TESTID.datePickerSaid,
  notice: TESTID.datePickerNotice,
} as const

export function DatePicker(props: {
  readonly date: string | undefined
  readonly chosen: Chosen
  readonly onChange: (chosen: Chosen) => void
  readonly submission: Submission
  readonly onPick: (value: string) => Promise<Said | undefined>
  readonly onClose: () => void
}) {
  // `<input type="date">` and `type="time"` report a half-typed box as having
  // no value at all, so what is typed is read off the element's
  // `validity.badInput` on `input` and on `keyup` — the arrow and digit keys
  // fill a segment without changing the value.
  const [unfinished, setUnfinished] = createStore<Record<Box, boolean>>({ day: false, time: false })
  const incomplete = (): Box | null => unfinished.day ? "day" : unfinished.time ? "time" : null
  let dayBox: HTMLInputElement | undefined
  let lastFocused: HTMLElement | undefined
  const shown = useShown()
  createEffect(() => {
    if (!shown()) return
    queueMicrotask(() => { if (shown()) (lastFocused ?? dayBox)?.focus({ preventScroll: true }) })
  })
  let timeBox: HTMLInputElement | undefined
  const read = (which: Box, element: HTMLInputElement): void => {
    const partial = element.validity.badInput
    setUnfinished(which, partial)
    if (!partial) props.onChange({ ...props.chosen, [which]: element.value })
  }

  const value = (): string | null =>
    incomplete() === null ? valueOf(props.date, props.chosen, browserInstantAt) : null
  const press = (): Press => pressOf(props.date, value())
  const notice = (): string | undefined => {
    const which = incomplete()
    const pressing = value()
    if (which !== null) return UNFINISHED[which]
    return pressing === null ? undefined : noticeOf(props.date, props.chosen, pressing, browserInstantAt)
  }

  return (
    <RowPanel
      submission={props.submission}
      ids={IDS}
      press={press}
      send={async () => { const pressing = value(); return pressing === null ? undefined : props.onPick(pressing) }}
      onClose={props.onClose}
      notice={notice()}
    >
      <label class="flex max-w-full flex-wrap items-center gap-2 text-label text-muted">
        Scheduled for
        <input
          type="date"
          class={`${TARGET} min-w-0 max-w-full md:min-h-0 rounded-control border border-rule bg-paper px-2 py-1 text-body text-ink`}
          data-testid={TESTID.datePickerDay}
          value={props.chosen.day}
          ref={element => { dayBox = element }}
          onFocus={event => { lastFocused = event.currentTarget }}
          onInput={(event) => read("day", event.currentTarget)}
          onKeyUp={(event) => read("day", event.currentTarget)}
        />
      </label>
      <label class="flex max-w-full flex-wrap items-center gap-2 text-label text-muted">
        at
        <input
          type="time"
          class={`${TARGET} min-w-0 max-w-full md:min-h-0 rounded-control border border-rule bg-paper px-2 py-1 text-body text-ink`}
          data-testid={TESTID.datePickerTime}
          value={props.chosen.time}
          ref={(element) => { timeBox = element }}
          onFocus={event => { lastFocused = event.currentTarget }}
          onInput={(event) => read("time", event.currentTarget)}
          onKeyUp={(event) => read("time", event.currentTarget)}
        />
      </label>
      <Show when={props.chosen.time !== "" || unfinished.time}>
        <button
          type="button"
          class={PANEL_OUT}
          data-testid={TESTID.datePickerNoTime}
          onClick={() => {
            if (timeBox !== undefined) timeBox.value = ""
            props.onChange({ ...props.chosen, time: "" })
            setUnfinished("time", false)
          }}
        >
          {NO_TIME}
        </button>
      </Show>
    </RowPanel>
  )
}
