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

import { For } from "solid-js"

import { WELL } from "../surface.ts"
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
  // A plain comparison, and deliberately not the `createSelector` the theme
  // chips use: a selector earns its keep by notifying only the entries that
  // changed, and in a strip of two or three EVERY entry changes when the pick
  // does. Fifteen chips are the case it was written for.
  const isInForce = (value: T): boolean => props.value === value

  return (
    <div class={`inline-flex overflow-hidden rounded-full ${WELL}`}>
      <For each={props.choices}>
        {(choice) => (
          <button
            type="button"
            // A target on a phone (../touch.ts), a pill on a laptop. The strip
            // is a WELL and the segments live inside it, so what says which one
            // is in force is the FILL — the depth grammar's own picked surface
            // (`../surface.ts`), the same tint a chosen option in the chat wears.
            // The ring is the caret and nothing else, and it is `-inset` because
            // a ring that reached outside would land on the strip's own edge.
            class={`${TARGET} inline-flex items-center px-3 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent md:min-h-0 md:py-1 ${
              isInForce(choice.value) ? "bg-picked text-ink" : "text-muted hover:text-ink"
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
