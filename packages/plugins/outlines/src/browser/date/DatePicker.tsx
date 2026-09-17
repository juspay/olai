/**
 * The date picker: a day, and optionally a time of day, chosen on a row that
 * already exists.
 *
 * MCP could set or clear a node's `date` and a person could only clear one
 * (#124's `•••` verb) — a standing consistency deviation rather than a missing
 * feature (`editor-op-parity`). This is the affordance that closes
 * it, and what it sends is the intent every other write on this face sends:
 * one `date` edit at the same gate `outlines_date` goes through
 * ({@link ../../../../surface/src/edit.ts}), judged by the same planner,
 * refused in the same words. Nothing is echoed — the badge changes when the
 * file says it changed.
 *
 * The format's `date` has two widths, a day and an instant (docs/format.md),
 * and the picker offered only the first: a node an agent had scheduled for ten
 * in the morning could be moved by a person only by throwing the time away.
 * So there are two boxes, and the second is optional — empty is a bare day.
 *
 * ## `<input type="date">` and `type="time"`, and why the platform's own controls
 *
 * Because they CANNOT MINT AN INSTANT. Their values are a `YYYY-MM-DD` string,
 * an `HH:MM` string or the empty string, which is exactly the vocabulary the
 * format stores: a date is text, verbatim, and a date-only value round-tripped
 * through a `Date` comes back a datetime (docs/format.md). So the day a person
 * picks is the ten characters the record will hold and the time is the face it
 * will say, with nothing parsing or formatting either on the way — and the
 * calendar, the locale and the keyboard entry are the browser's, on every
 * platform olai is read on, rather than widgets this app would own and have to
 * make work with a screen reader.
 *
 * The pure half of it — what the boxes start with, the value they come to, what
 * the button says, and the edit it sends — is {@link ./pick.ts}, so those rules
 * are answerable without a browser.
 *
 * ## What this file is, and what it is not
 *
 * TWO CONTROLS and the rules about them, inside the shell every panel
 * a row opens shares ({@link ../edit/RowPanel.tsx}): drawn in place under the
 * line rather than floating, Escape and Cancel as the ways out, one press at a
 * time, a dead button where the gesture would write nothing, and the ops
 * layer's own words kept on screen when a write does not happen. Each of those
 * used to be written out here; the reasons for all of them are that file's now,
 * and what is left in this one is the boxes.
 *
 * The one thing worth keeping HERE about the ways out: a click OUTSIDE is
 * deliberately not one. The browser's own calendar popup is chrome outside the
 * document on every engine, so a dismissal listening for a pointer elsewhere
 * would be a picker that shuts the moment somebody reaches for a date in it —
 * which is a fact about THIS control rather than about panels.
 */
import { TESTID } from "olai-plugin-outlines/testids"
import type { Press } from "../edit/panel.ts"
import type { Submission } from "../edit/submission.ts"
import { RowPanel } from "../edit/RowPanel.tsx"
import type { Said } from "@olai/web/client/saying.ts"

import { TARGET } from "@olai/ui-primitives/touch.ts"
import { PANEL_OUT } from "@olai/web/client/pill.ts"
import { createSignal, Show } from "solid-js"
import { browserInstantAt, type Chosen, noticeOf, pressOf, valueOf } from "./pick.ts"

/** The one button that empties the time box — named once, because the sentence
 *  for a half-typed box tells a person to press it. */
const NO_TIME = "No time"

/** What the panel says about a box the browser holds half-typed. Here, beside
 *  the element it is about and the button it names, rather than with the write
 *  rules in `./pick.ts`: it is a fact about the platform's control, and no value
 *  is involved. */
const UNFINISHED = {
  day: "The day is not finished. Finish it, or empty it.",
  time: `The time is not finished. Finish it, or press ${NO_TIME}.`,
} as const

/** This panel's identity, off the one table that declares it. */
const IDS = {
  panel: TESTID.datePicker,
  set: TESTID.datePickerSet,
  cancel: TESTID.datePickerCancel,
  said: TESTID.datePickerSaid,
  notice: TESTID.datePickerNotice,
} as const

export function DatePicker(props: {
  /** The date the node stores, or nothing — what the boxes start on, and what
   *  decides whether pressing the button would ask for anything. */
  readonly date: string | undefined
  /** The day and time the boxes hold — the row's draft (`./memory.tsx`). */
  readonly chosen: Chosen
  readonly onChange: (chosen: Chosen) => void
  readonly submission: Submission
  /** Send it. The host is what knows the write gate and the undo stack
   *  ({@link ../writes.ts}); this is what knows the day. Answering with a
   *  {@link Said} keeps the panel open saying it; answering with nothing is the
   *  ordinary success, and the panel goes. What it is handed is the VALUE the
   *  boxes come to ({@link valueOf}) — `""` for no date. */
  readonly onPick: (value: string) => Promise<Said | undefined>
  readonly onClose: () => void
}) {
  /**
   * Which box, if either, the browser holds HALF-TYPED — an hour with no
   * minutes, a month with no year.
   *
   * The platform reports such a box as having no value at all
   * (`validity.badInput`), so the signals above cannot tell it from an empty
   * one, and an empty signal set to empty again is no change to anything. It is
   * read off the element instead, on every event a half-typed segment can
   * arrive by: `input` where the engine sends one, and `keyup` for the arrow
   * and digit keys that fill one segment without changing the value. Local to
   * this panel rather than kept with the draft (`./memory.tsx`), because it is
   * a fact about the element: a remounted box starts empty, not half-typed.
   */
  const [unfinishedDay, setUnfinishedDay] = createSignal(false)
  const [unfinishedTime, setUnfinishedTime] = createSignal(false)
  const incomplete = (): keyof typeof UNFINISHED | null =>
    unfinishedDay() ? "day" : unfinishedTime() ? "time" : null
  let timeBox: HTMLInputElement | undefined
  /** A half-typed box leaves the DRAFT where it was. Its value reads as
   *  nothing, and a draft set to nothing is pushed back into the box by its
   *  `value` binding — which would wipe the segments still on screen, turning
   *  one Backspace on `14:30` into a whole time taken off. The badness is read
   *  first for the same reason: after that write there is nothing left to
   *  read it off. */
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

  /** What pressing would store ({@link valueOf}), or `null` while a box is
   *  half-typed and there is nothing to read. The button, the notice and the
   *  send all read THIS, so none of them can quote a value another would not.
   *
   *  The draft it reads was seeded from the record ONCE, and is the person's
   *  from then on — the row editor's trade: a live frame that rewrote the boxes
   *  under somebody would take a day out of their hands. What the file says
   *  meanwhile is still read here on every frame. */
  const value = (): string | null =>
    incomplete() === null ? valueOf(props.date, props.chosen, browserInstantAt) : null
  /** The button, in the one state it has — what it says and whether it does
   *  anything, derived together ({@link ./pick.ts}) so they cannot disagree. */
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
      // RowPanel sends only when `press` writes, which `null` never does — so
      // the `null` arm is unreachable, and is still not the empty value (a clear).
      send={async () => { const pressing = value(); return pressing === null ? undefined : props.onPick(pressing) }}
      onClose={props.onClose}
      // What the boxes do not say whole — a half-typed box, a time the zone
      // skips, a stored value from another zone — asked of the DRAFT, so it
      // quotes what pressing would write now.
      notice={notice()}
    >
      {/* The label WRAPS the box rather than naming it by id: a row owns its
          own picker, so two of them can be open at once and a fixed id would
          be the same id twice in one document. */}
      <label class="flex max-w-full flex-wrap items-center gap-2 text-xs text-muted">
        Scheduled for
        <input
          type="date"
          class={`${TARGET} min-w-0 max-w-full md:min-h-0 rounded border border-rule bg-paper px-2 py-1 text-sm text-ink`}
          data-testid={TESTID.datePickerDay}
          value={props.chosen.day}
          // The caret goes here as the panel attaches: it was opened to be
          // typed in, and a picker that needed a second click to accept a
          // keyboard would be a control the keyboard cannot reach.
          // `queueMicrotask` for the reason the command palette uses one —
          // the element is not in the document at the instant the signal
          // flips.
          ref={(element) => queueMicrotask(() => element.focus())}
          onInput={(event) => readDay(event.currentTarget)}
          onKeyUp={(event) => readDay(event.currentTarget)}
        />
      </label>
      {/* The time, optional: empty is a bare day. Its own label for the reason
          the day's wraps its box, and a word rather than a second "Scheduled
          for", because it reads on from the day. */}
      <label class="flex max-w-full flex-wrap items-center gap-2 text-xs text-muted">
        at
        <input
          type="time"
          class={`${TARGET} min-w-0 max-w-full md:min-h-0 rounded border border-rule bg-paper px-2 py-1 text-sm text-ink`}
          data-testid={TESTID.datePickerTime}
          value={props.chosen.time}
          ref={(element) => { timeBox = element }}
          onInput={(event) => readTime(event.currentTarget)}
          onKeyUp={(event) => readTime(event.currentTarget)}
        />
      </label>
      {/* A way to empty the time box that every browser draws the same. The
          platform's own time control has none on most engines — its fields are
          emptied one at a time with Backspace — and taking a time off is one
          of the three things this panel is for. It edits the draft only; the
          button, which then says `Clear time`, is still what writes.

          Offered for a HALF-TYPED box too, and it empties the ELEMENT as well
          as the draft: a draft that already says nothing would not be pushed
          back into the box, and the half-typed segments would stay on screen. */}
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
