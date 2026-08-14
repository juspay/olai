/**
 * The box that narrows the page, and what it has to say about the result.
 *
 * IT IS NOT THE HEADER'S SEARCH BOX, and the difference is the question each
 * one answers: the header takes you TO a node anywhere in the directory, this
 * one narrows what is already in front of you. One box answering both would
 * have to guess which was meant by every keystroke. What they DO share is the
 * grammar — the header box and the ⌘K palette are callers of the same
 * `Query.search`, which is gated by the same `parseFilter` this page is
 * narrowed by — so the operators work in all three and mean one thing.
 *
 * Everything it draws is a fact somebody could otherwise only guess at:
 *
 *   - the COUNT, "3 of 41", so a query that narrowed to nothing is
 *     distinguishable from one that narrowed to everything;
 *   - what the done-preference is HOLDING BACK, because `is:done` under a
 *     reader who hides finished work draws nothing and the reason must not be
 *     a mystery (`./narrowing.ts` argues the order);
 *   - a REFUSAL, in the grammar's own words, for a known operator with an
 *     unknown value. Never silently downgraded to a substring search:
 *     HACKING.md's rule is that an error reaches somebody.
 *
 * The value lives in the ADDRESS (`../routes.ts`), not here — so a narrowed
 * page is a link, and Back leaves the filter rather than un-typing it.
 */

import { For, Show } from "solid-js"

import { TESTID } from "../testids.ts"
import { TARGET_BOX } from "../touch.ts"
import type { Narrowing } from "./narrowing.ts"

/** What the box says when it is empty — the whole grammar in one line, because
 *  an operator language nobody is told about is a feature nobody uses. */
const PLACEHOLDER = "filter — words, #tag, is:done, has:desc, date:2026-08, -not"

export function FilterBar(props: {
  readonly narrowing: Narrowing
  readonly onType: (text: string) => void
}) {
  const narrowing = () => props.narrowing
  return (
    <div class="mb-3" data-testid={TESTID.filterBar}>
      <div class="flex max-w-md items-center gap-1">
        {/* `text`, not `search`: a `type="search"` input draws the browser's
            own clear cross, and this bar already has one of its own — two
            crosses side by side, one of which no scenario can press
            portably. The header's box keeps `search` precisely because it has
            no cross of its own to collide with. */}
        <input
          type="text"
          class="min-w-0 flex-1 rounded border border-rule/70 bg-panel px-2 py-1 font-mono text-xs text-ink outline-none placeholder:text-muted focus:border-rule"
          data-testid={TESTID.filterInput}
          placeholder={PLACEHOLDER}
          aria-label="filter this page"
          value={narrowing().text()}
          onInput={(event) => props.onType(event.currentTarget.value)}
          // Escape empties it and gives the page back — the same answer the
          // header box gives to the same key, which is the point of both being
          // a box you type a query into.
          onKeyDown={(event) => {
            if (event.key !== "Escape") return
            event.preventDefault()
            props.onType("")
            event.currentTarget.blur()
          }}
        />
        <Show when={narrowing().active()}>
          <button
            type="button"
            class={`${TARGET_BOX} inline-flex items-center justify-center rounded text-muted hover:text-ink`}
            data-testid={TESTID.filterClear}
            aria-label="clear the filter"
            onClick={() => props.onType("")}
          >
            <span aria-hidden="true" class="text-base leading-none">×</span>
          </button>
        </Show>
      </div>

      <Show when={narrowing().active()}>
        <p
          class="m-0 mt-1 font-mono text-xs text-muted"
          data-testid={TESTID.filterCount}
          // A count that changes under a reader is worth announcing once it
          // settles, not on every keystroke.
          aria-live="polite"
        >
          {narrowing().shown() === 0
            ? "no matches"
            : `${narrowing().shown()} of ${narrowing().total()}`}
          <Show when={narrowing().hiddenAsDone() > 0}>
            {` — ${narrowing().hiddenAsDone()} more ${
              narrowing().hiddenAsDone() === 1 ? "match is" : "matches are"
            } hidden as done (Prefs)`}
          </Show>
        </p>
      </Show>

      <Show when={narrowing().query().refusals.length > 0}>
        <ul
          class="m-0 mt-1 list-none p-0"
          data-testid={TESTID.filterRefusals}
          role="alert"
        >
          <For each={[...narrowing().query().refusals]}>
            {(refusal) => (
              <li
                class="font-mono text-xs text-alarm"
                data-testid={TESTID.filterRefusal}
              >
                {refusal.token} — {refusal.reason}
              </li>
            )}
          </For>
        </ul>
      </Show>
    </div>
  )
}
