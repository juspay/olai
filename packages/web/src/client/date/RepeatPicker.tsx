/**
 * The repeat picker: how often a dated node comes back, chosen on the row it
 * is about.
 *
 * `@olai/format`'s grammar is small and CLOSED — `every day`, `every week on
 * <weekday>`, `every month`, `every year` — so the control is a `<select>` of
 * exactly those ten strings plus "Does not repeat", drawn straight off
 * `REPEAT_RULES` — so the options a person sees and the strings the validator
 * takes are one list, where hand-written labels would compile, draw, and be
 * refused on send. A text box would be the wrong control twice over: it invites
 * the cron dialect the grammar exists to refuse, and it makes a person type a
 * sentence a list can hand them.
 *
 * ## Beside the date picker, and now literally
 *
 * The panel a row opens is {@link ../edit/RowPanel.tsx} — in place under the
 * line, Escape and Cancel as the ways out, one press at a time, a dead button
 * where the gesture would write nothing, the ops layer quoted verbatim when a
 * write does not happen. This file is the CONTROL and the two rules about it;
 * everything else it has in common with {@link ./DatePicker.tsx} is common
 * because it is the same shell rather than because two files agree.
 *
 * The two remain two panels, and that is not an accident of the shell: they are
 * two writes at the gate, so a picker that sent both would be the web doing in
 * one gesture what MCP needs two calls for, which is the deviation HACKING.md
 * forbids. One affordance in a person's hands, two ops underneath.
 */

import { REPEAT_RULES } from "@olai/format"
import { createSignal, For } from "solid-js"

import type { Press } from "../edit/panel.ts"
import { RowPanel } from "../edit/RowPanel.tsx"
import type { Said } from "../edit/undoing.ts"
import { TESTID } from "../testids.ts"
import { TARGET } from "../touch.ts"
import { noticeOf, pressOf, startsAt } from "./repeat.ts"

/** This panel's identity, off the one table that declares it. */
const IDS = {
  panel: TESTID.repeatPicker,
  set: TESTID.repeatPickerSet,
  cancel: TESTID.repeatPickerCancel,
  said: TESTID.repeatPickerSaid,
  notice: TESTID.repeatPickerNotice,
} as const

export function RepeatPicker(props: {
  /** The rule the node stores, or nothing — what the list starts on, and what
   *  decides whether pressing the button would ask for anything. */
  readonly repeat: string | undefined
  /** Send it. The host is what knows the write gate and the undo stack
   *  ({@link ../writes.ts}); this is what knows the rule. */
  readonly onPick: (rule: string) => Promise<Said | undefined>
  readonly onClose: () => void
}) {
  /** The rule in the box: seeded from the record ONCE, and the person's from
   *  then on — the date picker's own trade, for its own reason. */
  const [rule, setRule] = createSignal(startsAt(props.repeat))
  const press = (): Press => pressOf(props.repeat, rule())

  return (
    <RowPanel
      ids={IDS}
      press={press}
      send={() => props.onPick(rule())}
      onClose={props.onClose}
      // A stored rule the list cannot show, said out loud with what choosing
      // would do to it — see `./repeat.ts`.
      notice={noticeOf(props.repeat)}
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
          <For each={REPEAT_RULES}>{(one) => <option value={one}>{one}</option>}</For>
        </select>
      </label>
    </RowPanel>
  )
}
