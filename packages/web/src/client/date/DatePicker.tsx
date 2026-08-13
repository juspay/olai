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
 * ## In place, under the row
 *
 * Not a popover. Everything else a row says about a write is drawn here — the
 * refusal under a title being typed, the note being written, the aside about a
 * mirror — and a panel floating over the tree would be the one editing surface
 * with geometry of its own to keep anchored while the page scrolls. It also
 * means the picker works the same at a badge, from the `•••` menu, and on a
 * phone, where a floating panel would land under the thumb.
 *
 * The ways out are Escape and Cancel, and a write that LANDED. Deliberately
 * NOT a click outside: the browser's own calendar popup is chrome outside the
 * document on every engine, so a dismissal listening for a pointer elsewhere
 * would be a picker that shuts the moment somebody reaches for a date in it.
 *
 * ## What it says when a write does not happen
 *
 * The panel stays open and quotes the ops layer, verbatim, in the same two
 * moods every other surface has ({@link ../edit/undoing.ts}'s `Said`) — a
 * refusal is why nothing happened, and a remark rides a write that did. Either
 * way there is something to read, so the panel keeps standing to be read in,
 * with the day still in the box. A picker that closed on a refusal would be a
 * write that vanished.
 */

import { createSignal, Show } from "solid-js"

import type { Said } from "../edit/undoing.ts"
import { CARD, LIFT, WELL } from "../surface.ts"
import { TESTID } from "../testids.ts"
import { TARGET } from "../touch.ts"
import { noticeOf, type Press, pressOf, startsAt } from "./pick.ts"

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
  /** What the last press had to say, or `null` — the ops layer's own words,
   *  never summarised. */
  const [said, setSaid] = createSignal<Said | null>(null)
  /** One press at a time: the gate is a round trip, and a second Enter while
   *  the first is in flight is two writes for one intention. */
  const [sending, setSending] = createSignal(false)
  /** The button, in the one state it has — what it says and whether it does
   *  anything, derived together ({@link ./pick.ts}) so they cannot disagree. */
  const press = (): Press => pressOf(props.date, day())

  const send = async (): Promise<void> => {
    if (sending() || !press().writes) return
    setSending(true)
    setSaid(null)
    try {
      const answer = await props.onPick(day())
      if (answer !== undefined) {
        setSaid(answer)
        return
      }
      props.onClose()
    } finally {
      setSending(false)
    }
  }

  return (
    <div
      class="my-1"
      data-testid={TESTID.datePicker}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return
        // Stop it here: the row's own editor and the palette both listen for
        // Escape further up, and one key must not also close something else.
        event.preventDefault()
        event.stopPropagation()
        props.onClose()
      }}
    >
      {/* A form, so Enter in the box submits — which is what a person who has
          just typed a date expects, and what the button does with a click. */}
      <form
        class="flex flex-wrap items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          void send()
        }}
      >
        {/* The label WRAPS the box rather than naming it by id: a row owns its
            own picker, so two of them can be open at once and a fixed id would
            be the same id twice in one document. */}
        <label class="flex items-center gap-2 text-xs text-muted">
          Scheduled for
          <input
            type="date"
            class={`${TARGET} md:min-h-0 rounded-lg ${WELL} px-2.5 py-1 text-sm text-ink outline-none focus:inset-ring-2 focus:inset-ring-accent`}
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
        <button
          type="submit"
          class={`${TARGET} md:min-h-0 cursor-pointer rounded-full ${CARD} ${LIFT} px-3 py-1 text-sm text-ink disabled:cursor-default disabled:text-muted`}
          data-testid={TESTID.datePickerSet}
          disabled={sending() || !press().writes}
        >
          {press().label}
        </button>
        <button
          type="button"
          class={`${TARGET} md:min-h-0 cursor-pointer rounded border-0 bg-transparent px-2 py-1 text-sm text-muted hover:text-ink`}
          data-testid={TESTID.datePickerCancel}
          onClick={() => props.onClose()}
        >
          Cancel
        </button>
      </form>

      {/* A stored value the box cannot hold, said out loud with what a pick
          would do to it — see `./pick.ts`. */}
      <Show when={noticeOf(props.date)}>
        {(notice) => (
          <p class="mt-1 mb-0 text-xs leading-snug text-muted" data-testid={TESTID.datePickerNotice}>
            {notice()}
          </p>
        )}
      </Show>

      <Show when={said()}>
        {(message) => (
          <p
            class="mt-1 mb-0 text-[0.8125rem] leading-snug"
            classList={{
              "text-alarm": message().tone === "alarm",
              "text-muted": message().tone === "aside",
            }}
            data-testid={TESTID.datePickerSaid}
            // WHICH mood, as a fact in the markup rather than as a colour —
            // the same contract the `•••` menu's line and the row editor's
            // keep.
            data-tone={message().tone}
            // Announced, never focus-stealing — the caret is in the box, and
            // the reader's place is not ours to take. A refusal interrupts what
            // a screen reader is saying and a remark does not, which is the
            // pair the `•••` menu's line already keeps.
            role={message().tone === "alarm" ? "alert" : "status"}
            aria-live={message().tone === "alarm" ? "assertive" : "polite"}
          >
            {message().text}
          </p>
        )}
      </Show>
    </div>
  )
}
