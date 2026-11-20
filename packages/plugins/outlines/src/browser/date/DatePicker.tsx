import { useShown } from "olai-plugin-navigation/routing"
import { createEffect } from "solid-js"
import { TESTID } from "olai-plugin-outlines/testids"
import type { Press } from "../edit/panel.ts"
import type { Submission } from "../edit/submission.ts"
import { RowPanel } from "../edit/RowPanel.tsx"
import type { Said } from "@olai/web/client/saying.ts"

import { TARGET } from "@olai/ui-primitives/touch.ts"
import { PANEL_OUT } from "@olai/web/client/pill.ts"
import { createSignal, Show } from "solid-js"
import { browserInstantAt, type Chosen, noticeOf, pressOf, valueOf } from "./pick.ts"

const NO_TIME = "No time"

const UNFINISHED = {
  day: "The day is not finished. Finish it, or empty it.",
  time: `The time is not finished. Finish it, or press ${NO_TIME}.`,
} as const

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
  /**
   * The platform reports a half-typed date/time box as having no value at all
   * (`validity.badInput`), so it is read off the element instead, on every
   * event a half-typed segment can arrive by: `input` where the engine sends
   * one, and `keyup` for the arrow and digit keys that fill one segment
   * without changing the value.
   */
  const [unfinishedDay, setUnfinishedDay] = createSignal(false)
  const [unfinishedTime, setUnfinishedTime] = createSignal(false)
  const incomplete = (): keyof typeof UNFINISHED | null =>
    unfinishedDay() ? "day" : unfinishedTime() ? "time" : null
  let dayBox: HTMLInputElement | undefined
  let lastFocused: HTMLElement | undefined
  const shown = useShown()
  createEffect(() => {
    if (!shown()) return
    queueMicrotask(() => { if (shown()) (lastFocused ?? dayBox)?.focus({ preventScroll: true }) })
  })
  let timeBox: HTMLInputElement | undefined
  const readDay = (element: HTMLInputElement): void => {
    const partial = element.validity.badInput
    setUnfinishedDay(partial)
    if (!partial) props.onChange({ ...props.chosen, day: element.value })
  }
  const readTime = (element: HTMLInputElement): void => {
    const partial = element.validity.badInput
    setUnfinishedTime(partial)
    if (!partial) props.onChange({ ...props.chosen, time: element.value })
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
          onInput={(event) => readDay(event.currentTarget)}
          onKeyUp={(event) => readDay(event.currentTarget)}
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
          onInput={(event) => readTime(event.currentTarget)}
          onKeyUp={(event) => readTime(event.currentTarget)}
        />
      </label>
      {/* The platform's own time control has no clear affordance on most
          engines — its fields are emptied one at a time with Backspace. */}
      <Show when={props.chosen.time !== "" || unfinishedTime()}>
        <button
          type="button"
          class={PANEL_OUT}
          data-testid={TESTID.datePickerNoTime}
          onClick={() => {
            if (timeBox !== undefined) timeBox.value = ""
            props.onChange({ ...props.chosen, time: "" })
            setUnfinishedTime(false)
          }}
        >
          {NO_TIME}
        </button>
      </Show>
    </RowPanel>
  )
}
