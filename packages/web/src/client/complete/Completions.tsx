/**
 * The shortlist under a caret — one box for all three widgets.
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
 * chosen by the arrows and Enter (`./completing.ts`), and a pointer press is
 * defaulted-away by the row itself so a click cannot blur the line being typed.
 */

import { For, Show } from "solid-js"

import { Result } from "../search/Result.tsx"
import { TESTID } from "../testids.ts"
import type { Completion } from "./completing.ts"

export function Completions(props: { readonly completion: Completion }) {
  const showing = () =>
    props.completion.kind() !== null &&
    (props.completion.choices().length > 0 || props.completion.failure() !== null)

  return (
    <Show when={showing()}>
      <div
        class="absolute top-full left-0 z-30 mt-1 w-[min(24rem,80vw)] overflow-hidden rounded-md border border-rule/70 bg-panel shadow-lg"
        data-testid={TESTID.completions}
        // WHICH widget this is, as a fact in the markup rather than as a guess
        // from what is in it — the same contract every other panel in this
        // client keeps about its own mood.
        data-kind={props.completion.kind() ?? undefined}
        role="listbox"
        aria-label="completions"
      >
        {/* The search's own refusal, in its own words and in its own slot —
            never dropped, and never overwriting a list somebody is reading. */}
        <Show when={props.completion.failure()}>
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
        <ul
          class="m-0 max-h-64 list-none overflow-x-hidden overflow-y-auto p-1"
        >
          <For each={[...props.completion.choices()]}>
            {(choice, index) => (
              <li>
                <Result
                  label={choice.label}
                  hint={choice.hint}
                  place={choice.place}
                  active={index() === props.completion.active()}
                  testid={TESTID.completionItem}
                  placeTestid={TESTID.completionItemPlace}
                  id={choice.id}
                  onHover={() => props.completion.hover(index())}
                  onSelect={() => choice.choose()}
                />
              </li>
            )}
          </For>
        </ul>
      </div>
    </Show>
  )
}
