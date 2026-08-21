/**
 * WHAT A REFUSED QUERY SAYS, and the rows it says it in.
 *
 * Three of them draw the same list — the filter bar over the page
 * (`./filter/FilterBar.tsx`) and the ⌘K palette and the header's box (both over
 * `./search/nodes.ts`) — because a reader who does not notice a refused
 * operator believes the directory is empty. The SENTENCE was spelled at all
 * three, which is the shape this repo already calls a drift waiting to happen.
 * (The MARKUP was three-fold too, for one release: the bar's line went through
 * the component that owns the tone and the two doors hand-rolled a
 * `role="alert"` row each. They draw `./edit/SaidLine.tsx` now — one list, one
 * sentence, one markup — and only WHERE the line sits is still each door's.)
 *
 * STRINGS, and that is the reactivity half rather than a tidy-up. Every parse
 * of the box mints fresh `Refusal` objects — per keystroke for the filter bar
 * (`./filter/narrowing.ts`), per answer for the two search doors — so a list
 * drawn by identity was rebuilt for a query that had not changed its mind, and
 * a rebuilt live region is the same sentence read out loud again.
 *
 * So the list is memoised with an `equals` over the sentences, which is
 * `./served.tsx`'s arrangement over the served paths and `./names.ts`'s over the
 * names: a query that goes on refusing the same token returns an EQUAL list, so
 * the memo's value does not move, nothing downstream re-runs, and nothing is
 * announced twice. The `<Index>` below is then the second half of the same
 * promise rather than the whole of it.
 *
 * `<Index>` rather than `<Key>`, for the reason `./search/Shortlist.tsx`
 * gives about hits: these lines are positional and there are a handful of them
 * — and a token can be refused twice in one query (`is:OPEN is:OPEN`), so the
 * token is not a key.
 *
 * ONE EXPORT, and that is the second half of the same argument. The memo, the
 * `<Index>` and the alarmed row were a hook plus eight hand-written lines at
 * each of the three doors, and the two halves only keep their promise
 * TOGETHER: a memo whose value holds is announced twice anyway by a list drawn
 * with `<Key>`, and a door that remembered the memo could still forget the
 * keying. Handed over as a component, neither is a door's to remember. What a
 * door still says is what only it knows — where the rows sit, and what it
 * calls them.
 *
 * HERE rather than under any of the three, because none of them owns it. The
 * bar's refusals are `./filter/narrowing.ts`'s parse and the two doors' are
 * `./search/nodes.ts`'s answer, so a home under either would be one reader
 * lending its module to the other two; the concept's own generative side is
 * `@olai/format`'s `Refusal`, which is a package away. What is left is the top
 * level, where the client's other rules about how something is SAID already
 * live.
 */

import type { Refusal } from "@olai/format"
import { createMemo, Index } from "solid-js"

import { SaidLine } from "./edit/SaidLine.tsx"
import type { TestId } from "./testids.ts"

/** One refusal, as the sentence a surface draws: the token AS TYPED, and why —
 *  the em-dashed pair every door has always used. */
const said = (refusal: Refusal): string =>
  `${refusal.token} — ${refusal.reason}`

/** The same sentences in the same order — what "the reader has not changed
 *  their mind" means for a list that is re-parsed on every keystroke. */
const sameLines = (
  a: ReadonlyArray<string>,
  b: ReadonlyArray<string>,
): boolean => a.length === b.length && a.every((line, at) => line === b[at])

/**
 * The refusals of one door, DRAWN — the sentences above in the mood they are
 * announced in.
 *
 * The mood is `./edit/SaidLine.tsx`'s, once, for every surface in this client
 * that has to say something: a refusal is why nothing happened, so it is toned
 * alarm and announced assertively, because a reader who does not notice one
 * believes the directory is empty (HACKING.md's error rule).
 *
 * WHAT THE DOOR STILL OWNS is where its rows sit and what it calls them — a
 * line under the filter bar, a ruled band across the palette, the same band
 * narrower over the header's panel, and a `data-testid` that is a contract
 * with a package this one does not import. Those are the one thing the three
 * genuinely differ about, so they are arguments; everything else would be a
 * `where` enum, which is the shape `SaidLine`'s own header refuses.
 */
export function Refusals(props: {
  /** The door's own refusals, as its reading answers with them — the raw
   *  `Refusal`s, not sentences: minting the sentence is half of what holds the
   *  live region still, and a door that spelled it would be back to keeping
   *  that promise itself. */
  readonly of: ReadonlyArray<Refusal>
  /** Where these rows sit, and how they are boxed — the caller's. */
  readonly class: string
  readonly testid: TestId
}) {
  /** The whole list of them, and it HOLDS while the query goes on being
   *  refused the same way — see the header. `props.of` is a getter, so this
   *  tracks the door's own reading through it. */
  const lines = createMemo(() => props.of.map(said), undefined, { equals: sameLines })
  return (
    <Index each={lines()}>
      {(line) => (
        <SaidLine
          said={{ tone: "alarm", text: line() }}
          class={props.class}
          testid={props.testid}
        />
      )}
    </Index>
  )
}
