/**
 * The date picker: a day, chosen on a row that already exists.
 *
 * MCP could set or clear a node's `date` and a person could only clear one
 * (#124's `•••` verb) — a standing consistency deviation rather than a missing
 * feature (HACKING.md, `editor-op-parity`). This is the affordance that closes
 * it, and what it sends is the intent every other write on this face sends:
 * one `date` edit at the same gate `set_date` goes through
 * ({@link ../../../../surface/src/edit.ts}), judged by the same planner,
 * refused in the same words. Nothing is echoed — the badge changes when the
 * file says it changed.
 *
 * ## `<input type="date">`, and why the platform's own control is the right one
 *
 * Because it CANNOT MINT AN INSTANT. Its value is a `YYYY-MM-DD` string or the
 * empty string, which is exactly the vocabulary the format stores: a date is
 * text, verbatim, and a date-only value round-tripped through a `Date` comes
 * back a datetime (docs/format.md). So the day a person picks is the ten
 * characters the record will hold, with nothing parsing or formatting it on
 * the way — and the calendar, the locale and the keyboard entry are the
 * browser's, on every platform olai is read on, rather than a widget this app
 * would own and have to make work with a screen reader.
 *
 * The pure half of it — what the box starts with, what the button says, and
 * the edit it sends — is {@link ./pick.ts}, so those rules are answerable
 * without a browser.
 *
 * ## What this file is, and what it is not
 *
 * A CONTROL and the two rules about that control, inside the shell every panel
 * a row opens shares ({@link ../edit/RowPanel.tsx}): drawn in place under the
 * line rather than floating, Escape and Cancel as the ways out, one press at a
 * time, a dead button where the gesture would write nothing, and the ops
 * layer's own words kept on screen when a write does not happen. Each of those
 * used to be written out here; the reasons for all of them are that file's now,
 * and what is left in this one is the box.
 *
 * The one thing worth keeping HERE about the ways out: a click OUTSIDE is
 * deliberately not one. The browser's own calendar popup is chrome outside the
 * document on every engine, so a dismissal listening for a pointer elsewhere
 * would be a picker that shuts the moment somebody reaches for a date in it —
 * which is a fact about THIS control rather than about panels.
 */

import { createSignal } from "solid-js"

import type { Press } from "../edit/panel.ts"
import { RowPanel } from "../edit/RowPanel.tsx"
import type { Said } from "../edit/undoing.ts"
import { TESTID } from "../testids.ts"
import { TARGET } from "../touch.ts"
import { noticeOf, pressOf, startsAt } from "./pick.ts"

/** This panel's identity, off the one table that declares it. */
const IDS = {
  panel: TESTID.datePicker,
  set: TESTID.datePickerSet,
  cancel: TESTID.datePickerCancel,
  said: TESTID.datePickerSaid,
  notice: TESTID.datePickerNotice,
} as const

export function DatePicker(props: {
  /** The date the node stores, or nothing — what the box starts on, and what
   *  decides whether pressing the button would ask for anything. */
  readonly date: string | undefined
  /** Send it. The host is what knows the write gate and the undo stack
   *  ({@link ../writes.ts}); this is what knows the day. Answering with a
   *  {@link Said} keeps the panel open saying it; answering with nothing is the
   *  ordinary success, and the panel goes. */
  readonly onPick: (day: string) => Promise<Said | undefined>
  readonly onClose: () => void
}) {
  /** The day in the box: seeded from the record ONCE, and the person's from
   *  then on. That is the same trade the row editor's draft takes — what is
   *  typed is not a claim about the file, and a live frame that rewrote the box
   *  under somebody would be a page taking a day out of their hands. What the
   *  file says meanwhile is still read, on every frame, by the two questions
   *  that are about the RECORD rather than about the box: whether pressing
   *  would write anything, and what the button is called. */
  const [day, setDay] = createSignal(startsAt(props.date))
  /** The button, in the one state it has — what it says and whether it does
   *  anything, derived together ({@link ./pick.ts}) so they cannot disagree. */
  const press = (): Press => pressOf(props.date, day())

  return (
    <RowPanel
      ids={IDS}
      press={press}
      send={() => props.onPick(day())}
      onClose={props.onClose}
      // A stored value the box cannot hold, said out loud with what a pick
      // would do to it — see `./pick.ts`.
      notice={noticeOf(props.date)}
    >
      {/* The label WRAPS the box rather than naming it by id: a row owns its
          own picker, so two of them can be open at once and a fixed id would
          be the same id twice in one document. */}
      <label class="flex items-center gap-2 text-xs text-muted">
        Scheduled for
        <input
          type="date"
          class={`${TARGET} md:min-h-0 rounded border border-rule bg-paper px-2 py-1 text-sm text-ink`}
          data-testid={TESTID.datePickerDay}
          value={day()}
          // The caret goes here as the panel attaches: it was opened to be
          // typed in, and a picker that needed a second click to accept a
          // keyboard would be a control the keyboard cannot reach.
          // `queueMicrotask` for the reason the command palette uses one —
          // the element is not in the document at the instant the signal
          // flips.
          ref={(element) => queueMicrotask(() => element.focus())}
          onInput={(event) => setDay(event.currentTarget.value)}
        />
      </label>
    </RowPanel>
  )
}
