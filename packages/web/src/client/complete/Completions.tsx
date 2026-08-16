/**
 * The shortlist under a caret — one box for all three widgets.
 *
 * PRIVATE to this directory: `./completing.tsx` hands its consumer a `Panel`
 * that draws this, so a field with a completion in it wires one thing rather
 * than a hook and a component that have to agree about a shape.
 *
 * It draws {@link ../search/Result.tsx}'s row, which is the row the ⌘K palette
 * and the header's search box already draw, for the reason that file gives:
 * three spellings of a result row are three rows, and the day one of them
 * learns to show a mark or a date is the day they stop being the same product.
 * What this adds is only the BOX — where it sits, and the fact of which widget
 * it belongs to.
 *
 * ## Absolutely positioned, which is not the same as a popover
 *
 * The date picker two directories over argues at length for drawing in place
 * under the row rather than floating (`../date/DatePicker.tsx`), and that
 * argument does not reach this: what it rules out is a panel with geometry of
 * its own to keep anchored while the page scrolls. This box is laid out inside
 * the row's own title cell — `absolute` against it, so it scrolls with the row,
 * needs no measurement, and has no anchoring code at all.
 *
 * What it buys by being out of flow is the one thing an in-flow list could not
 * do: the tree below does not JUMP as candidates appear and disappear on every
 * keystroke. A list that pushed the outline down by four rows while somebody
 * typed `#ho` and pulled it back up on the `m` would be unusable for exactly
 * the gesture it exists to serve.
 *
 * The caret never leaves the input, so nothing here takes focus: the rows are
 * chosen by the arrows and Enter (`./completing.tsx`), and a pointer press is
 * defaulted-away by the row itself so a click cannot blur the line being typed.
 */

import { Index, Show } from "solid-js"

import { LAYER } from "../layer.ts"
import { Result, type RowTestids } from "../search/Result.tsx"

/** What this door calls its rows (`../search/Result.tsx`'s `RowTestids`). */
const COMPLETION_ROW: RowTestids = {
  row: TESTID.completionItem,
  place: TESTID.completionItemPlace,
}
import { TESTID } from "../testids.ts"
import type { Listing } from "./completing.tsx"

export function Completions(props: { readonly listing: Listing }) {
  return (
    // WHETHER there is a box is the listing's own answer, not a second formula
    // here — see `Listing.showing`.
    <Show when={props.listing.showing()}>
      <div
        // `LAYER.row` is the whole stacking claim, and it is the `•••` menu's
        // (`../layer.ts`): this hangs off a ROW, in the outline's own flow, so
        // it covers the rows under it and gives way to every piece of chrome —
        // a list opened under the header or beside the chat dock is the one
        // that goes. A bare number here would be the twentieth call site that
        // could only be read by looking at the other nineteen.
        class={`absolute top-full left-0 ${LAYER.row} mt-1 w-[min(24rem,80vw)] overflow-hidden rounded-md border border-rule/70 bg-panel shadow-lg`}
        data-testid={TESTID.completions}
        // WHICH widget this is, as a fact in the markup rather than as a guess
        // from what is in it — the same contract every other panel in this
        // client keeps about its own mood.
        data-kind={props.listing.kind() ?? undefined}
        role="listbox"
        aria-label="completions"
      >
        {/* The search's own refusal, in its own words and in its own slot —
            never dropped, and never overwriting a list somebody is reading. */}
        <Show when={props.listing.failure()}>
          {(failure) => (
            <p
              class="m-0 border-b border-alarm/40 bg-alarm/5 px-3 py-2 font-mono text-xs text-alarm"
              data-testid={TESTID.completionsError}
              role="alert"
            >
              {failure()}
            </p>
          )}
        </Show>
        {/* `<Index>`, not `<For>`: the rows are POSITIONAL and there are at
            most eight of them, and every keystroke mints a fresh `Choice` per
            row (each carries its own `choose` closure), so a reference-keyed
            diff would match nothing and tear down every row to build it again
            — including while a `((` list is sitting unchanged behind its
            debounce. Index-keying updates the props in place. */}
        <ul class="m-0 max-h-64 list-none overflow-x-hidden overflow-y-auto p-1">
          <Index each={props.listing.choices()}>
            {(choice, index) => (
              <li>
                <Result
                  label={choice().label}
                  hint={choice().hint}
                  place={choice().place}
                  active={index === props.listing.active()}
                  testids={COMPLETION_ROW}
                  id={choice().id}
                  onHover={() => props.listing.hover(index)}
                  onSelect={() => choice().choose()}
                />
              </li>
            )}
          </Index>
        </ul>
      </div>
    </Show>
  )
}
