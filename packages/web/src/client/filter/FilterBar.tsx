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

import { SaidLine } from "../edit/SaidLine.tsx"
import { listKey } from "../keys.ts"
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
          value={props.narrowing.text()}
          onInput={(event) => props.onType(event.currentTarget.value)}
          // WHICH key empties it is the registry's (`../keys.ts`'s list layer,
          // the same one the header box asks); what `dismiss` MEANS here is
          // this bar's — the box empties and the page gets the caret back.
          // The other three answers belong to a shortlist, and this bar has
          // none, so they are left to the input.
          onKeyDown={(event) => {
            if (listKey(event) !== "dismiss") return
            event.preventDefault()
            props.onType("")
            event.currentTarget.blur()
          }}
        />
        <Show when={props.narrowing.active()}>
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

      <Show when={props.narrowing.active()}>
        <p
          class="m-0 mt-1 font-mono text-xs text-muted"
          data-testid={TESTID.filterCount}
          // A READOUT rather than something said about a write, which is why
          // it is not a `SaidLine` (`../edit/SaidLine.tsx` owns the two MOODS a
          // write has, and a count has neither). Announced politely for the
          // reason a remark is: it changes under a reader who is typing, and
          // interrupting them with each keystroke is worse than the number is
          // worth.
          aria-live="polite"
        >
          {props.narrowing.shown() === 0
            ? "no matches"
            : `${props.narrowing.shown()} of ${props.narrowing.total()}`}
          <Show when={props.narrowing.hiddenAsDone() > 0}>
            {` — ${props.narrowing.hiddenAsDone()} more ${
              props.narrowing.hiddenAsDone() === 1 ? "match is" : "matches are"
            } hidden as done (Prefs)`}
          </Show>
        </p>
      </Show>

      {/* The refusal IS a said-thing, and the one mood `SaidLine` calls a
          refusal: why nothing happened, toned alarm and announced assertively,
          because a reader who does not notice it believes the directory is
          empty. The mood — the colour, the `data-tone` a scenario reads, the
          `role`/`aria-live` pair — is that component's, once, for every
          surface in this client that has to say one. Only the LAYOUT is
          here. */}
      <For each={[...props.narrowing.refusals()]}>
        {(refusal) => (
          <SaidLine
            said={{ tone: "alarm", text: `${refusal.token} — ${refusal.reason}` }}
            class="m-0 mt-1 font-mono text-xs"
            testid={TESTID.filterRefusal}
          />
        )}
      </For>
    </div>
  )
}
