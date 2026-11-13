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
import { TESTID } from "@olai/ui-primitives/testids.ts"
import { For } from "solid-js"


import { TARGET } from "@olai/ui-primitives/touch.ts"

export interface Choice<T extends string> {
  readonly value: T
  readonly label: string
}

/**
 * ONE SEGMENT'S PAINT, exported because there are two strips in this tree and
 * only one of them can be this component: hledger's depth control gives each
 * button a `data-depth` that `Segmented` has no way to emit, so it draws the
 * same strip by hand. It used to do that by copying this class string, which
 * meant the forced-colours answer below would have had to be written twice and
 * would have rotted in one of the two places.
 *
 * `olai-segment` is what `../all.css` keys the forced-colours rule on: in
 * force is `bg-accent/10` and idle is nothing, so under Windows High Contrast
 * both flatten to `Canvas` and the strip forgets which one it is on.
 *
 * `[--olai-ring-offset:-2px]` puts the app's focus ring INSIDE the segment.
 * The strip wears `overflow-hidden` to round its ends, so a ring at the
 * sheet's default `+2px` would be clipped away on three sides and sit on the
 * neighbour's edge on the fourth. This replaced a `focus-visible:ring-inset`
 * that was never the whole story: the ring it was insetting was a
 * `box-shadow`, which forced colours removes, and the `outline-none` beside it
 * never stood the real ring down (`@olai/appearance/chrome.css` is unlayered).
 */
export const SEGMENT =
  `${TARGET} olai-segment inline-flex items-center px-3 text-label [--olai-ring-offset:-2px] md:min-h-0 md:py-1`

/** The segment that is in force: the FILL is the pick, because these share
 *  their borders and a ring on one would sit on the next one's edge. */
export const SEGMENT_IN_FORCE = "bg-accent/10 text-ink"

/** The strip itself — a shared border, and the ends rounded off it. */
export const SEGMENT_STRIP = "inline-flex overflow-hidden rounded-full border border-rule"

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
    <div class={`${SEGMENT_STRIP} ${frozen() ? "opacity-60" : ""}`}>
      <For each={props.choices}>
        {(choice) => (
          <button
            type="button"
            // A target on a phone (../touch.ts), a pill on a laptop. The FILL
            // is the pick and the ring is the caret: a segment shares its
            // border with its neighbour, so a ring drawn around the pressed
            // one would sit on top of the edge beside it. Both of those facts
            // live in `SEGMENT` above now, with the forced-colours answer that
            // the fill alone cannot survive.
            class={`${SEGMENT} ${
              isInForce(choice.value)
                ? SEGMENT_IN_FORCE
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
