/**
 * A choice between two or three named things, drawn as one strip.
 *
 * The ARIA is the theme chips' argument reused, because it is the same control:
 * plain toggle buttons carrying `aria-pressed`, inside the group its {@link
 * ../settings/Row.tsx} names. A `listbox`/`option` would misstate it — there is
 * no arrow-key roving and no `aria-activedescendant` — and would forbid
 * `aria-pressed` on the options, which is the attribute that says which one is
 * in force.
 *
 * `aria-pressed` is spelled out in both directions rather than handed a
 * boolean: the choices that are NOT in force have to announce that, and an
 * attribute a framework drops when it is false announces nothing at all.
 *
 * FROZEN is the second state this control has, and it is a whole strip rather
 * than a whole row: a pinned preference is drawn exactly as it is set, with
 * every choice still on screen, because "you are on Auto-commit" is only half
 * an answer without "and Off is the other thing this could have been". What
 * changes is that nothing here is pressable and the strip says so — dimmed,
 * `aria-disabled` on each segment, and the reason a line below it
 * (`./Row.tsx`). Never HIDDEN: a policy a reader cannot see is one they cannot
 * ask anybody about.
 */

import { For } from "solid-js"

import { TESTID } from "../testids.ts"
import { TARGET } from "../touch.ts"

export interface Choice<T extends string> {
  readonly value: T
  readonly label: string
}

export function Segmented<T extends string>(props: {
  readonly choices: ReadonlyArray<Choice<T>>
  readonly value: T
  /** Absent on a frozen strip: there is nothing to pick. */
  readonly onPick?: (value: T) => void
  /** Read-only: the value is somebody else's to set. Default is a live strip. */
  readonly frozen?: boolean
}) {
  const frozen = (): boolean => props.frozen === true
  // A plain comparison, and deliberately not the `createSelector` the theme
  // chips use: a selector earns its keep by notifying only the entries that
  // changed, and in a strip of two or three EVERY entry changes when the pick
  // does. The theme chips are the case it was written for.
  const isInForce = (value: T): boolean => props.value === value

  return (
    <div
      class={`inline-flex overflow-hidden rounded-full border border-rule ${
        frozen() ? "opacity-60" : ""
      }`}
    >
      <For each={props.choices}>
        {(choice) => (
          <button
            type="button"
            // A target on a phone (../touch.ts), a pill on a laptop. The
            // segments share a border, so what says which one is in force is
            // the fill rather than a ring — a ring inside a strip lands on top
            // of its neighbour's edge.
            // The ring is the caret and the FILL is the pick — a segment shares
            // its border with its neighbour, so a ring on the pressed one would
            // sit on top of the edge beside it. `-inset` rather than an offset
            // for the same reason: the ring has to stay inside the strip.
            class={`${TARGET} inline-flex items-center px-3 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent md:min-h-0 md:py-1 ${
              isInForce(choice.value)
                ? "bg-accent/15 text-ink"
                : `text-muted ${frozen() ? "" : "hover:text-ink"}`
            }`}
            data-testid={TESTID.prefsChoice}
            data-value={choice.value}
            aria-pressed={isInForce(choice.value) ? "true" : "false"}
            // `aria-disabled`, NOT `disabled`, and it is the commit pill's
            // argument (`../commit/Commit.tsx`): a disabled button takes no
            // focus, and the sentence saying WHO set this is exactly what a
            // keyboard reader has come for. Absent rather than `false` on a
            // live strip.
            aria-disabled={frozen() ? true : undefined}
            onClick={() => {
              if (!frozen()) props.onPick?.(choice.value)
            }}
          >
            {choice.label}
          </button>
        )}
      </For>
    </div>
  )
}
