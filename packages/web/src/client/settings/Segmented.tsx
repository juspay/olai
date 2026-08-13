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
 */

import { createSelector, For } from "solid-js"

import { TESTID } from "../testids.ts"
import { TARGET } from "../touch.ts"

export interface Choice<T extends string> {
  readonly value: T
  readonly label: string
}

export function Segmented<T extends string>(props: {
  readonly choices: ReadonlyArray<Choice<T>>
  readonly value: T
  readonly onPick: (value: T) => void
}) {
  // Notifies the two buttons that changed rather than every button in the
  // strip — the same reason the theme chips use one (`../theme/Chips.tsx`).
  const isInForce = createSelector(() => props.value)

  return (
    <div class="inline-flex overflow-hidden rounded-full border border-rule">
      <For each={props.choices}>
        {(choice) => (
          <button
            type="button"
            // A target on a phone (../touch.ts), a pill on a laptop. The
            // segments share a border, so what says which one is in force is
            // the fill rather than a ring — a ring inside a strip lands on top
            // of its neighbour's edge.
            class={`${TARGET} inline-flex items-center px-3 text-xs md:min-h-0 md:py-1 ${
              isInForce(choice.value)
                ? "bg-accent/15 text-ink"
                : "text-muted hover:text-ink"
            }`}
            data-testid={TESTID.prefsChoice}
            data-value={choice.value}
            aria-pressed={isInForce(choice.value) ? "true" : "false"}
            onClick={() => props.onPick(choice.value)}
          >
            {choice.label}
          </button>
        )}
      </For>
    </div>
  )
}
