/**
 * WHAT A ROW SAYS ABOUT ITSELF, when the query asked about a property — one
 * line of `key value` pairs, the matched ones first and drawn in the reading
 * ink.
 *
 * ## Why it is a component rather than two copies of a `<For>`
 *
 * Two surfaces answer a `prop:` query with rows: the shortlist every PICKER is
 * built from (`./Result.tsx`) and the everywhere page (`./SearchPage.tsx`). The
 * ORDERING has been one rule since there were two doors (`./props.ts`: matched
 * keys lead, because an ellipsis eats the end) — and the INK was not, which is
 * the half a shared ordering cannot protect: a row that put the answer first
 * and then drew it the same grey as everything else has spent the ordering and
 * kept none of the signal.
 *
 * ## The two signals, and why there are two
 *
 * ORDER first, and it survives everything — including a line ellipsized down to
 * its first pair. Then a LUMINANCE step (`text-ink` against `text-muted`),
 * never a change of weight and never a hue: it reads for somebody who cannot
 * separate two colours, and does not for somebody who cannot separate two
 * greys. Which is exactly why it is the second signal rather than the only one.
 *
 * The pairing itself is the drawer's (`../props/PropsDrawer.tsx`): mono key,
 * reading-face value. A property should look like a property wherever it is
 * drawn. What is NOT borrowed is the drawer's two-column grid — that costs a
 * line per property, and a row showing six of them would be six rows tall.
 */

import { For, Show } from "solid-js"

import type { NodeProp } from "./props.ts"

export function PropsLine(props: {
  /** The pairs, already ordered (`./props.ts`'s `rowProps`). */
  readonly of: ReadonlyArray<NodeProp>
  /** What the drawing surface calls one pair — its own, because a scenario
   *  reads it inside the door it means. Absent for a surface whose rows are
   *  not node hits, on `./Result.tsx`'s `RowTestids` rule: a tag completion
   *  has no properties, so there is nothing to name. */
  readonly testid?: string
  /** Where the line sits, and how it is boxed — the caller's, which is the
   *  same division `../SaidLine.tsx` makes between a sentence and its layout.
   *  A popover's row truncates to one line; a page's may wrap. */
  readonly class: string
}) {
  return (
    <Show when={props.of.length > 0}>
      <span class={props.class}>
        <For each={props.of}>
          {(prop) => (
            <span
              class="min-w-0 truncate"
              data-testid={props.testid}
              data-key={prop.key}
              data-matched={prop.matched ? "true" : undefined}
            >
              <span class={`font-mono ${prop.matched ? "text-ink" : "text-muted"}`}>
                {prop.key}
              </span>{" "}
              <span class="text-muted">{prop.value}</span>
            </span>
          )}
        </For>
      </span>
    </Show>
  )
}
