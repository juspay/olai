/**
 * The repeat picker: how often a dated node comes back, chosen on the row it
 * is about.
 *
 * `@olai/format`'s grammar is small and CLOSED — `every day`, `every week on
 * <weekday>`, `every month`, `every year` — so the control is a `<select>` of
 * exactly those ten strings plus "Does not repeat", read off the format itself
 * ({@link ./repeat.ts}'s `RULES`). A text box would be the wrong control twice
 * over: it invites the cron dialect the grammar exists to refuse, and it makes
 * a person type a sentence a list can hand them.
 *
 * ## Beside the date picker, on purpose
 *
 * Same file, same shape, same panel, same ways out — this is
 * {@link ./DatePicker.tsx} asked about the field one along, and every sentence
 * in that file's header applies here word for word: in place under the row
 * rather than floating, Escape and Cancel and a write that LANDED as the ways
 * out, the ops layer quoted verbatim when a write does not happen, and nothing
 * echoed — the badge changes when the file says it changed.
 *
 * The two are ONE affordance in a person's hands (a date and how it recurs are
 * one thought) and two panels in the code, because they are two writes at the
 * gate: a picker that sent both would be the web doing in one gesture what MCP
 * needs two calls for, which is the deviation HACKING.md forbids.
 */

import { createSignal, For, Show } from "solid-js"

import { SaidLine } from "../edit/SaidLine.tsx"
import type { Said } from "../edit/undoing.ts"
import { TESTID } from "../testids.ts"
import { TARGET } from "../touch.ts"
import { noticeOf, type Press, pressOf, RULES, startsAt } from "./repeat.ts"

export function RepeatPicker(props: {
  /** The rule the node stores, or nothing — what the list starts on, and what
   *  decides whether pressing the button would ask for anything. */
  readonly repeat: string | undefined
  /** Send it. The host is what knows the write gate and the undo stack
   *  ({@link ../writes.ts}); this is what knows the rule. Answering with a
   *  {@link Said} keeps the panel open saying it; answering with nothing is the
   *  ordinary success, and the panel goes. */
  readonly onPick: (rule: string) => Promise<Said | undefined>
  readonly onClose: () => void
}) {
  /** The rule in the box: seeded from the record ONCE, and the person's from
   *  then on — the date picker's own trade, for its own reason. */
  const [rule, setRule] = createSignal(startsAt(props.repeat))
  const [said, setSaid] = createSignal<Said | null>(null)
  /** One press at a time: the gate is a round trip, and a second Enter while
   *  the first is in flight is two writes for one intention. */
  const [sending, setSending] = createSignal(false)
  const press = (): Press => pressOf(props.repeat, rule())

  const send = async (): Promise<void> => {
    if (sending() || !press().writes) return
    setSending(true)
    setSaid(null)
    try {
      const answer = await props.onPick(rule())
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
      data-testid={TESTID.repeatPicker}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return
        // Stopped here, as the date picker stops it: the row's editor and the
        // palette both listen for Escape further up, and one key must not also
        // close something else.
        event.preventDefault()
        event.stopPropagation()
        props.onClose()
      }}
    >
      <form
        class="flex flex-wrap items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          void send()
        }}
      >
        {/* The label WRAPS the control rather than naming it by id: a row owns
            its own picker, so two of them can be open at once and a fixed id
            would be the same id twice in one document. */}
        <label class="flex items-center gap-2 text-xs text-muted">
          Repeats
          <select
            class={`${TARGET} md:min-h-0 rounded border border-rule bg-paper px-2 py-1 text-sm text-ink`}
            data-testid={TESTID.repeatPickerRule}
            value={rule()}
            ref={(element) => queueMicrotask(() => element.focus())}
            onInput={(event) => setRule(event.currentTarget.value)}
          >
            {/* The empty option IS the verb "stop repeating" — one spelling of
                "does not repeat", which is what `repeatPick` sends as `null`. */}
            <option value="">Does not repeat</option>
            <For each={RULES}>{(one) => <option value={one}>{one}</option>}</For>
          </select>
        </label>
        <button
          type="submit"
          class={`${TARGET} md:min-h-0 cursor-pointer rounded border border-rule bg-transparent px-2 py-1 text-sm text-ink hover:bg-rule disabled:cursor-default disabled:text-muted disabled:hover:bg-transparent`}
          data-testid={TESTID.repeatPickerSet}
          disabled={sending() || !press().writes}
        >
          {press().label}
        </button>
        <button
          type="button"
          class={`${TARGET} md:min-h-0 cursor-pointer rounded border-0 bg-transparent px-2 py-1 text-sm text-muted hover:text-ink`}
          data-testid={TESTID.repeatPickerCancel}
          onClick={() => props.onClose()}
        >
          Cancel
        </button>
      </form>

      {/* A stored rule the list cannot show, said out loud with what choosing
          would do to it — see `./repeat.ts`. */}
      <Show when={noticeOf(props.repeat)}>
        {(notice) => (
          <p
            class="mt-1 mb-0 text-xs leading-snug text-muted"
            data-testid={TESTID.repeatPickerNotice}
          >
            {notice()}
          </p>
        )}
      </Show>

      <Show when={said()}>
        {(message) => (
          <SaidLine
            said={message()}
            class="mt-1 mb-0 text-[0.8125rem] leading-snug"
            testid={TESTID.repeatPickerSaid}
          />
        )}
      </Show>
    </div>
  )
}
