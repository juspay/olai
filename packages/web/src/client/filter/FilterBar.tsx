/**
 * The box that narrows the page, and what it has to say about the result.
 *
 * IT IS NOT THE HEADER'S SEARCH BOX, and the difference is the question each
 * one answers: the header takes you TO a node anywhere in the directory, this
 * one narrows what is already in front of you. One box answering both would
 * have to guess which was meant by every keystroke. What they DO share is the
 * grammar AND, since `search-server-side`, the matcher's own answer: the header
 * box, the ⌘K palette and this bar are all callers of the server's one reading,
 * so the operators work in all three and mean one thing.
 *
 * Everything it draws is a fact somebody could otherwise only guess at:
 *
 *   - the COUNT, "3 of 41", so a query that narrowed to nothing is
 *     distinguishable from one that narrowed to everything — and what the
 *     done-preference is HOLDING BACK, because `is:done` under a reader who
 *     hides finished work draws nothing and the reason must not be a mystery
 *     (`./narrowing.ts` argues the order, `./count.ts` the wording, and the
 *     three numbers are counted inside one set so the sentence adds up);
 *   - WHETHER THE ROWS ANSWER WHAT IS TYPED, which is the round trip's own
 *     line: a filter settles and then flies, so for a beat the page is one
 *     query behind, and the count of the query before is a number about a
 *     question nobody asked. The rows hold still and this line says so
 *     (`./count.ts`'s `ANSWERING`) — unless the last call FAILED, in which
 *     case it says nothing at all, because no answer is coming and the failure
 *     line below is the news (`./count.ts`'s `countSaid` holds all three);
 *   - a REFUSAL, in the grammar's own words, for a known operator with an
 *     unknown value. Never silently downgraded to a substring search:
 *     HACKING.md's rule is that an error reaches somebody. It is drawn from
 *     the browser's own parse, so it arrives with the keystroke rather than
 *     with an answer;
 *   - a FAILED CALL, which is a different piece of news in a different slot:
 *     the grammar refusing a word is an answer, the server not answering is
 *     not, and a reader shown one in the other's sentence has been told
 *     something untrue;
 *   - WHY THE BOX IS INERT, when the connection cannot carry a question. In
 *     the connection pill's own words (`../connection/reaching.ts`), because
 *     two sentences about one wire are two chances to disagree about it.
 *
 * The value lives in the ADDRESS (`../routes.ts`), not here — so a narrowed
 * page is a link, and Back leaves the filter rather than un-typing it.
 */

import { For, Show } from "solid-js"

import type { Asked } from "./asking.ts"
import { SaidLine } from "../edit/SaidLine.tsx"
import { listKey } from "../keys.ts"
import { TESTID } from "../testids.ts"
import { TARGET_BOX } from "../touch.ts"
import { countSaid } from "./count.ts"
import type { Narrowing } from "./narrowing.ts"

/** What the box says when it is empty — the whole grammar in one line, because
 *  an operator language nobody is told about is a feature nobody uses. The two
 *  compositions go early rather than last: a box this narrow clips its end, and
 *  what survives a clip is the front (`../search/place.ts` makes the same
 *  argument about a row). */
const PLACEHOLDER =
  `filter — words, "a phrase", a OR b, #tag, is:done, has:desc, date:last-week, changed:today, -not`

export function FilterBar(props: {
  /** What the PAGE found — the count, the words, the rows behind it. */
  readonly narrowing: Narrowing
  /** ...and what the WIRE is doing, which is a fact about the connection rather
   *  than a reading of the page: the two are handed over separately because the
   *  reading beside this one derives nothing from either, and a value carried
   *  through a module that does not read it is a field two files have to keep
   *  in step for nothing (`./asking.ts`). */
  readonly asked: Pick<Asked, "failure" | "offline">
  readonly onType: (text: string) => void
}) {
  /** A question cannot be asked, so the box takes none: an input that swallowed
   *  keystrokes into a page that could not narrow would be the door pretending
   *  (`../connection/reaching.ts`). What is already narrowed stays narrowed —
   *  the last thing the server said is still the last thing the server said. */
  const inert = () => props.asked.offline() !== null

  /** What the one line under the box says, or nothing — the three states a
   *  filtered page can be in, decided in `./count.ts` rather than in a binding
   *  here. */
  const said = () =>
    countSaid({
      answering: props.narrowing.answering(),
      failure: props.asked.failure(),
      offline: props.asked.offline(),
      counts: props.narrowing.counts(),
    })

  return (
    <div
      class="mb-6"
      data-testid={TESTID.filterBar}
      // WHICH QUERY THE ROWS BELOW ANSWER, in the markup — the same fact the
      // count line draws in words, published so something outside the browser
      // can wait for it. Absent while they answer a question the reader has
      // moved on from, which is the whole of what a debounce and a round trip
      // added to this box: a scenario that read the rows in the beat between
      // the keystroke and the answer would be reading the page before it.
      //
      // `data-asked`, which is what the shortlist under every other search box
      // in this client already calls the identical fact
      // (`../search/Shortlist.tsx`, off the same `answering`). One convention,
      // two publishers; a second spelling would be a second thing to learn
      // about one question.
      data-asked={props.narrowing.answering() ?? undefined}
    >
      <div class="flex max-w-xl items-center gap-1">
        {/* `text`, not `search`: a `type="search"` input draws the browser's
            own clear cross, and this bar already has one of its own — two
            crosses side by side, one of which no scenario can press
            portably. The header's box keeps `search` precisely because it has
            no cross of its own to collide with. */}
        <input
          type="text"
          class="min-w-0 flex-1 rounded-full border-0 bg-desk/70 px-4 py-2 font-mono text-xs text-ink outline-none placeholder:text-muted ring-1 ring-rule/40 focus:ring-2 focus:ring-accent/40 disabled:opacity-60"
          data-testid={TESTID.filterInput}
          placeholder={PLACEHOLDER}
          aria-label="filter this page"
          disabled={inert()}
          // The pill's sentence, on the control it disables — so a pointer
          // resting on a dead box gets the reason without hunting for the dot
          // in the header.
          title={props.asked.offline() ?? undefined}
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

      {/* The three numbers, the word that says they are not about what is typed
          yet, or NOTHING when the last call failed and the line under this one
          is already the news — one element, and `./count.ts` decides which of
          the three it is, so the decision is somewhere a test can ask about
          it. */}
      <Show when={props.narrowing.active() && said()}>
        {(line) => (
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
            {line()}
          </p>
        )}
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

      {/* THE CALL refusing, which is not the grammar refusing: its own slot, so
          a wire that fell over cannot be read as a query that found nothing.
          Alarmed, because the rows on screen are now older than the box. */}
      <Show when={props.asked.failure()}>
        {(said) => (
          <SaidLine
            said={{ tone: "alarm", text: said() }}
            class="m-0 mt-1 font-mono text-xs"
            testid={TESTID.filterFailure}
          />
        )}
      </Show>

      {/* ...and why nothing can be asked at all, in the pill's own words. An
          ASIDE rather than an alarm: nothing was refused and nothing was lost,
          the wire is simply not there — the connection pill is where that
          news belongs and this is it, repeated on the control it disables. */}
      <Show when={props.asked.offline()}>
        {(said) => (
          <SaidLine
            said={{ tone: "aside", text: said() }}
            class="m-0 mt-1 font-mono text-xs"
            testid={TESTID.filterOffline}
          />
        )}
      </Show>
    </div>
  )
}
