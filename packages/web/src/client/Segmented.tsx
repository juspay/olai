/**
 * A choice between two or three named things, drawn as one strip.
 *
 * The ARIA is the theme chips' argument reused, because it is the same control:
 * plain toggle buttons carrying `aria-pressed`, inside a group whose caller
 * names it. A `listbox`/`option` would misstate it — there is no arrow-key
 * roving and no `aria-activedescendant` — and would forbid `aria-pressed` on
 * the options, which is the attribute that says which one is in force.
 *
 * `aria-pressed` is spelled out in both directions rather than handed a
 * boolean: the choices that are NOT in force have to announce that, and an
 * attribute a framework drops when it is false announces nothing at all.
 *
 * ## It is not the settings panel's any more
 *
 * It lived in `settings/` while every strip in this app was a preference row.
 * The graph's HORIZON is the second one and is not a preference at all — it
 * writes the address — and a second strip beside this one, with its own
 * `aria-pressed` spelled its own way, is the shape `../backlinks/way.ts` and
 * `edges/relation.ts` both exist to have stopped: the control drifts, and
 * nothing fails while it does.
 *
 * So the strip is here, where {@link ../NodeRefs.tsx} and the rest of this
 * app's shared components are, and the TESTID is the caller's for
 * `NodeRefs`' own reason: what a strip is called to the browser tests is a
 * fact about the thing being chosen, not about the drawing of it. The
 * PRESENTATION is not the caller's and never will be — one strip, one look, one
 * ARIA argument.
 */

import { For } from "solid-js"

import { type TestId } from "./testids.ts"
import { TARGET } from "./touch.ts"

export interface Choice<T extends string> {
  readonly value: T
  readonly label: string
}

export function Segmented<T extends string>(props: {
  readonly choices: ReadonlyArray<Choice<T>>
  readonly value: T
  readonly onPick: (value: T) => void
  /** What one segment is called to the browser tests — the caller's, because
   *  which choice this strip is about is exactly what differs between two of
   *  them (`../NodeRefs.tsx`'s own rule). */
  readonly testid: TestId
  /** What the GROUP is, for a reader who cannot see the strip. The settings
   *  rows name their own (`settings/Row.tsx`), so they pass nothing; a strip
   *  standing on its own on a page has to say. */
  readonly label?: string
}) {
  // A plain comparison, and deliberately not the `createSelector` the theme
  // chips use: a selector earns its keep by notifying only the entries that
  // changed, and in a strip of two or three EVERY entry changes when the pick
  // does. Fifteen chips are the case it was written for.
  const isInForce = (value: T): boolean => props.value === value

  return (
    <div
      class="inline-flex overflow-hidden rounded-full border border-rule"
      role={props.label === undefined ? undefined : "group"}
      aria-label={props.label}
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
                : "text-muted hover:text-ink"
            }`}
            data-testid={props.testid}
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
