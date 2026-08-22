/**
 * THE ONE SEARCH BOX — what narrows the page in front of you, and the door that
 * widens the same query to the whole directory.
 *
 * IT IS THE ONLY BOX NOW. It used to be one of five doors, and the header's own
 * search box sat two inches above it answering a different question at a
 * different scope with a different answer shape — two entry points, two scopes,
 * one grammar, and nothing in the app that would list a tag written in three
 * files. The human's ruling of 2026-08-21 kept this one and deleted that one:
 * this box already owned the address (`?q=`), the honest count, the
 * ancestry-kept rows, the refusal line and the pin, and what it was missing was
 * a way OUT of the page (docs/brainstorming/one-search-box.md).
 *
 * So it says one more thing than it used to, and it is the truth it could not
 * tell before: **how many more the same query matches elsewhere in the
 * directory**, drawn as the door that goes there. `Enter` is that door as a
 * key — the one search box in this app with no list under it, so `Enter` was
 * free and now means *and now everywhere*. The words are never retyped: they
 * are the `?q=` either way (`../routes.ts`'s `everywhereFor`).
 *
 * Everything else it draws is a fact somebody could otherwise only guess at:
 *
 *   - the COUNT, "3 of 41", so a query that narrowed to nothing is
 *     distinguishable from one that narrowed to everything — and what the
 *     done-preference is HOLDING BACK, because `is:done` under a reader who
 *     hides finished work draws nothing and the reason must not be a mystery
 *     (`./narrowing.ts` argues the order, `./count.ts` the wording, and the
 *     three numbers are counted inside one set so the sentence adds up). On the
 *     everywhere page it is a different sentence about a different subject —
 *     `12 matches in 3 files` (`../search/said.ts`) — because there is no page
 *     underneath for a denominator to be about;
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
 *
 * WHAT IT NO LONGER DRAWS is a face for a dead wire. The box used to go inert
 * wearing the connection pill's sentence, because a filter that is a question
 * has nothing to answer a keystroke with while the socket is gone. The app-wide
 * ruling landed instead (§5b): a wire that cannot carry a question freezes the
 * WHOLE app under an overlay (`../connection/Offline.tsx`), so this box is
 * behind it, takes no keystroke, and has no reason left to explain itself.
 *
 * The value lives in the ADDRESS (`../routes.ts`), not here — so a narrowed
 * page is a link, and Back leaves the filter rather than un-typing it.
 */

import { createEffect, on, Show } from "solid-js"

import type { Asked } from "./asking.ts"
import { filterFocusAsked } from "./caret.ts"
import { SaidLine } from "../SaidLine.tsx"
import { listKey } from "../keys.ts"
import { Refusals } from "../refusals.tsx"
import { TESTID } from "../testids.ts"
import { TARGET_BOX } from "../touch.ts"
import { countSaid, type Found, widenSaid } from "./count.ts"
import type { Narrowing } from "./narrowing.ts"

/** What the box says when it is empty — the whole grammar in one line, because
 *  an operator language nobody is told about is a feature nobody uses. The two
 *  compositions go early rather than last: a box this narrow clips its end, and
 *  what survives a clip is the front (`../search/place.ts` makes the same
 *  argument about a row). */
const PLACEHOLDER =
  `filter — words, "a phrase", a OR b, #tag, is:done, has:desc, date:last-week, changed:today, -not`

/** …and what it says on the ONE page whose query is the page: there is nothing
 *  in front of the reader to narrow, so "filter" would be the wrong word for
 *  the same grammar. */
const EVERYWHERE_PLACEHOLDER =
  `search everywhere — words, "a phrase", a OR b, #tag, is:done, date:last-week, -not`

export function FilterBar(props: {
  /** What the PAGE found — the count, the words, the rows behind it. */
  readonly narrowing: Narrowing
  /** ...and the one thing the CALL has to say, which is a fact about the wire
   *  rather than a reading of the page: the two are handed over separately
   *  because the reading beside this one derives nothing from either, and a
   *  value carried through a module that does not read it is a field two files
   *  have to keep in step for nothing (`./asking.ts`). */
  readonly asked: Pick<Asked, "failure">
  /** WHICH SCOPE the reader is standing in, and the numbers that go with it —
   *  a narrowed page, or the everywhere page counting itself
   *  (`./count.ts`'s `Found`). */
  readonly found: Found
  readonly onType: (text: string) => void
  /**
   * WIDEN THIS QUERY — absent on the page that IS everywhere, which is what
   * takes both the line and the key away there rather than a condition written
   * twice inside this component.
   */
  readonly onWiden?: () => void
  /** Whether this pane is the FOCUSED one — which is the whole of how a
   *  broadcast ask for the caret picks a box in a split workspace
   *  (`./caret.ts`). */
  readonly focused: boolean
}) {
  let box: HTMLInputElement | undefined

  /** What the one line under the box says, or nothing — the three states a
   *  filtered page can be in, decided in `./count.ts` rather than in a binding
   *  here. */
  const said = () =>
    countSaid({
      answering: props.narrowing.answering(),
      failure: props.asked.failure(),
      found: props.found,
    })

  /** …and the second half of that line, which is a DOOR rather than a number:
   *  how many more the directory holds, and the way to them. Absent on the
   *  everywhere page, absent while the count is unknown, absent when there is
   *  nothing more (`./count.ts`'s `widenSaid`). */
  const widen = () =>
    props.onWiden === undefined || props.narrowing.answering() === null
      ? null
      : widenSaid(props.found.kind === "page" ? props.found.elsewhere : null)

  // THE CARET, ASKED FOR FROM OUTSIDE — the phone's magnifier and the ⌘K
  // handoff row (`./caret.ts`). `defer`, because the ask is an event and a bar
  // that grabbed the caret the moment it mounted would steal it from whatever
  // the reader was doing on every navigation. The text is SELECTED, because
  // somebody who asked to search a page holding an old query means to replace
  // it and not to append to it.
  createEffect(on(filterFocusAsked, () => {
    if (!props.focused) return
    box?.focus()
    box?.select()
  }, { defer: true }))

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
            portably. */}
        <input
          ref={box}
          type="text"
          class="min-w-0 flex-1 rounded-full border-0 bg-desk/70 px-4 py-2 font-mono text-xs text-ink outline-none placeholder:text-muted ring-1 ring-rule/40 focus:ring-2 focus:ring-accent/40"
          data-testid={TESTID.filterInput}
          placeholder={props.onWiden === undefined ? EVERYWHERE_PLACEHOLDER : PLACEHOLDER}
          aria-label={props.onWiden === undefined
            ? "search the directory"
            : "filter this page"}
          value={props.narrowing.text()}
          onInput={(event) => props.onType(event.currentTarget.value)}
          // WHICH key does what is the registry's (`../keys.ts`'s list layer,
          // the same one every other box in this client asks); what each answer
          // MEANS is this bar's.
          //
          // `dismiss` empties the box and gives the page the caret back.
          //
          // `take` WIDENS, and this is the one box in the app where that key
          // was going spare: every other door onto this grammar has a list
          // under it, so `Enter` there means "the row under the cursor". Here
          // there is no list — the rows ARE the page — so the key means the
          // gesture the line under the box draws: the same query, everywhere.
          // Claimed only where there is somewhere wider to go, so on `/search`
          // it falls through and does what Enter in a text input does.
          //
          // The other two answers belong to a shortlist, and this bar has none.
          onKeyDown={(event) => {
            const action = listKey(event)
            if (action === "dismiss") {
              event.preventDefault()
              props.onType("")
              event.currentTarget.blur()
              return
            }
            if (action !== "take") return
            const widening = props.onWiden
            if (widening === undefined || !props.narrowing.active()) return
            event.preventDefault()
            widening()
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
          it. The DOOR sits beside it rather than inside it: they are two
          different kinds of thing (a readout, and a way somewhere), and a
          reader pressing the number would be pressing a fact. */}
      <Show when={props.narrowing.active() && said()}>
        {(line) => (
          <p
            class="m-0 mt-1 flex flex-wrap items-baseline gap-x-1 font-mono text-xs text-muted"
            // A READOUT rather than something said about a write, which is why
            // it is not a `SaidLine` (`../SaidLine.tsx` owns the two MOODS a
            // write has, and a count has neither). Announced politely for the
            // reason a remark is: it changes under a reader who is typing, and
            // interrupting them with each keystroke is worse than the number is
            // worth.
            aria-live="polite"
          >
            <span data-testid={TESTID.filterCount}>{line()}</span>
            <Show when={widen()}>
              {(door) => (
                <button
                  type="button"
                  class="cursor-pointer border-0 bg-transparent p-0 font-mono text-xs text-accent underline decoration-dotted underline-offset-2 hover:text-ink"
                  data-testid={TESTID.filterWiden}
                  onClick={() => props.onWiden?.()}
                >
                  {door()}
                </button>
              )}
            </Show>
          </p>
        )}
      </Show>

      {/* The refusals, drawn — the sentence, the keying that keeps a screen
          reader from hearing it twice, and the alarmed row are all
          `../refusals.tsx`'s, once, for every door onto this grammar. What is
          left here is where the lines sit and what this bar calls them. */}
      <Refusals
        of={props.narrowing.refusals()}
        class="m-0 mt-1 font-mono text-xs"
        testid={TESTID.filterRefusal}
      />

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
    </div>
  )
}
