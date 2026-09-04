/**
 * A BOX AND THE NODES IT FINDS — the whole of "search the set, walk the
 * answers, take one", as one thing.
 *
 * Two panels in this client are exactly this with different words around it:
 * the edge panel, which takes a node to point at (`../edges/EdgePanel.tsx`),
 * and the move-to picker, which takes a node to sit under (`../move/
 * MovePicker.tsx`). Both hang under a row, both search the whole set, both walk
 * the rows with the same cursor, and both send one write per take. Before this
 * file they were that TWICE — the same input with the same focus-on-attach
 * ritual, the same four-key switch, the same failure line, the same
 * `<Index>`-over-`Result` list at the same height, and the same `data-asked`
 * convention — differing only in a testid and in what a take sends. That is the
 * confession `../edit/RowPanel.tsx` was extracted on, one panel-kind over: a
 * rule held by two copies and a comment holds in one of them the day it
 * changes.
 *
 * ## What it owns, and why each piece is in here rather than at the door
 *
 * The QUERY, the search and the cursor: a door that held any of them would be
 * a door that could disagree about the debounce, the minimum, or what the
 * bottom of a list does. `data-asked` rides this component's own root for the
 * same reason it exists at all — it is a fact about the SEARCH ("which query
 * do these rows answer"), not about the panel around it, and a scenario waits
 * for it inside whichever panel it is drawn in.
 *
 * The KEYS are `../keys.ts`'s list layer, never a private match: these are the
 * same four keys a row editor and the palette claim, and a component matching
 * them itself is the silent disagreement that registry exists to prevent. THREE
 * of the four are answered here; ESCAPE is deliberately not, because it is a
 * fact about the PANEL rather than about the list — a reader who has tabbed to
 * the way out is still in the panel, and a key answered on the box did nothing
 * there (review of #245). It bubbles, and each door stops it on its own
 * wrapper, which is what `../edit/RowPanel.tsx` has always done.
 *
 * ## What it does NOT own
 *
 * Everything the door is ABOUT: the heading, whatever the node already says
 * (the edge panel's chips), the way out for a pointer, and the sentence a
 * WRITE leaves behind — which outlives the panel and is therefore the host's
 * (`../edges/editing.tsx`, `../move/moving.tsx`).
 *
 * The other two doors onto the same reading are deliberately not consumers.
 * The ⌘K palette and the header's box draw more than node hits (shell
 * commands, the grammar's own refusals, an ask to the agent) and place
 * themselves (a portal, an anchor re-measured while the page scrolls); the
 * `((` widget has no box at all — the row's own editor is the input
 * (`../complete/Completions.tsx`). Bending any of them onto this would make it
 * a bundle of everything a list can be, which is the shape `RowPanel.tsx`
 * refused in the other direction.
 */

import type { NodeHit } from "@olai/surface"
import { type Accessor, createMemo, createSignal, Index, onMount, Show } from "solid-js"

import { SaidLine } from "../SaidLine.tsx"
import { listKey } from "../keys.ts"
import { Refused } from "../Refused.tsx"
import type { AnyTestId } from "../testids.ts"
import { TARGET } from "../touch.ts"
import { createCursor } from "./cursor.ts"
import { createSearch } from "./nodes.ts"
import { Result, type RowTestids } from "./Result.tsx"
import { type HitRow, hitRow } from "./row.ts"

/**
 * What one door calls the parts of its shortlist.
 *
 * One value rather than three props, which is `./Result.tsx`'s `RowTestids`
 * reasoning one level up: they are one surface's identity, named once at the
 * call site off `../testids.ts`, rather than three arguments a caller can pass
 * in the wrong order — and a door that passed the box's name and forgot the
 * failure line's would draw a sentence no test could reach.
 *
 * The ids are {@link AnyTestId} rather than this app's own `TestId`, and that
 * is the widget being SHARED taken seriously: the *assign to node…* list is
 * `olai-plugin-chat`'s door, dressed in that plugin's names, and a field typed
 * `TestId` would have said only core may dress this box. Still a closed union
 * either way, so a typo at a call site is a type error rather than a selector
 * that matches nothing.
 */
export interface ShortlistTestids {
  readonly box: AnyTestId
  readonly row: RowTestids
  /** A refused SEARCH, in the server's words. */
  readonly failed: AnyTestId
}

export function Shortlist(props: {
  /** What the box is FOR, as one sentence — its placeholder and its
   *  `aria-label`, which are the same words for the same reason a label and a
   *  hint would not be: there is nothing above the box to read. */
  readonly label: string
  readonly testids: ShortlistTestids
  /** Take this hit. The door knows what a take MEANS — a reference written, a
   *  row carried — and this knows only which row was chosen. */
  readonly onTake: (hit: NodeHit) => void
  /**
   * WHICH HITS THIS DOOR WILL NOT TAKE, and where it says so — absent for a
   * door that takes any of them (the edge panel: the node itself is in the
   * list, and so is one that would close a loop, because the ops layer refuses
   * those in words a person needs to read).
   *
   * The rule and the line are ONE value because they are one decision: a door
   * that judged its hits and had nowhere to say why would be drawing a dim
   * nobody can read, and a testid for a sentence nothing produces is a slot no
   * test can reach. Present together, absent together, and the type says so.
   *
   * A door that answers it gets three things at once: the row is dimmed where a
   * reader scanning the list can see it, the reason for the row under the
   * cursor is drawn under the list, and a take there sends nothing — the answer
   * is already on screen.
   */
  readonly refusing?: {
    readonly why: (hit: NodeHit) => string | null
    readonly testid: AnyTestId
    /**
     * WHICH HITS are on screen — absent for a door whose verdicts are pure over
     * the hit it is handed.
     *
     * It exists because one of them is not: the move picker's verdict is a
     * reading of the SET (can this row go under that node), which is the
     * server's since `https://github.com/juspay/oss.olai/blob/main/projects/olai/brainstorming/vault-in-browser.md`'s PR 10 — so it
     * has to say which nodes it wants judged before it can answer about any of
     * them (`../move/moving.tsx`). Handed rather than the door reaching in: the
     * list is what knows its hits, and this is the one line between the two.
     *
     * AN ACCESSOR, called ONCE when the list mounts, rather than the hits
     * pushed on every answer. What the door does with them is a DERIVATION —
     * an argument it asks about — and a push made it a report: an effect here,
     * a signal there, and a resource off that, which is three hops for a value
     * that is a function of one and reads to the next person as state that
     * could disagree with the list.
     */
    readonly asked?: (hits: Accessor<ReadonlyArray<NodeHit>>) => void
  }
}) {
  const [query, setQuery] = createSignal("")
  // RECORDS ALONE, asked for on the REQUEST and answered in the type
  // (`./nodes.ts`): every door that draws this list is picking a node to point
  // at, and none of them could take a document.
  const found = createSearch(() => query(), "node")
  const hits = found.hits
  const cursor = createCursor(() => hits().length)

  /**
   * The verdict on every hit, in the order they are drawn — all `null` where
   * the door judges nothing.
   *
   * ONE memo over the list rather than a call per binding: each row asks
   * whether it is refused (the dim, and the take), and the sentence under the
   * list asks the same of the row the cursor is on. Answered per hit, once per
   * answer, they cannot disagree — and walking the list with the arrows
   * re-derives nothing, because the cursor is an index into this.
   */
  /**
   * Every hit as the row it draws as, once per answer — `./row.ts`, which is
   * where a hit becomes a row for all four doors that draw this list.
   *
   * A MEMO rather than a call per binding, for {@link verdicts}' reason one
   * block down: the four lines of a row each want it, and `<Index>` re-runs a
   * binding rather than the row around it.
   */
  const rows = createMemo(() => hits().map(hitRow))

  /** The row at `index`. `<Index>` walks the same list this is built from, so
   *  there is always one; the `!` is that, said. */
  const row = (index: number): HitRow => rows()[index]!

  // WHAT IS BEING JUDGED, handed to the door once — the accessor, not the
  // answer. `onMount` rather than the component body so the hand-off is outside
  // the render pass, and once rather than per answer because what the door
  // needs is the list itself: it derives its question from this, and the
  // verdicts it sends back arrive as `refusing.why`.
  //
  // NOT HANDED BACK when this list goes, which was tried and is worse: the
  // door's question would then CHANGE at the moment the panel closes, which for
  // the move picker is a subscription re-opened to ask about no destinations at
  // all — a round trip spent saying the gesture is over. A door reads this only
  // while it has something to ask about (`../move/moving.tsx` asks nothing with
  // no row standing), so a spent accessor is simply never read.
  onMount(() => {
    props.refusing?.asked?.(hits)
  })

  const verdicts = createMemo<ReadonlyArray<string | null>>(() => {
    const judge = props.refusing
    return hits().map((hit) => (judge === undefined ? null : judge.why(hit)))
  })

  /** Why the hit under the cursor cannot be taken — `null` when it can, and
   *  when there is nothing under the cursor at all. */
  const refusal = (): string | null => verdicts()[cursor.at()] ?? null

  /**
   * TAKE the hit at `index` — the one thing both hands do, and one function
   * because they must do it identically: `Enter` on the row the cursor is on,
   * and a press on any row.
   *
   * A press POINTS FIRST, which is what makes the two the same gesture: the
   * cursor moves to what was pressed, so the sentence under the list is about
   * the row the hand just chose rather than about wherever the arrows had got
   * to.
   *
   * It answers whether the gesture was CLAIMED rather than whether anything was
   * taken — a refused hit has already put its reason on screen, so `Enter`
   * there is answered and must not fall through to whatever is under the panel.
   * Nothing to take at all is not claimed: swallowing `Enter` over an empty
   * list would be a key that does nothing.
   */
  const take = (index: number): void => {
    const hit = hits()[index]
    if (hit === undefined) return
    cursor.to(index)
    if (verdicts()[index] !== null) return
    props.onTake(hit)
  }

  return (
    <div
      // WHICH QUERY the rows below answer (`./nodes.ts`) — absent while they
      // answer one the reader has moved on from, which is what lets a scenario
      // wait for the rows of the search it just typed rather than for any rows
      // at all. On the search's own box rather than on the panel around it,
      // because that is what it is a fact about.
      data-asked={found.answering() ?? undefined}
    >
      <input
        type="text"
        class={`${TARGET} md:min-h-0 w-full rounded border border-rule bg-paper px-2 py-1 text-sm text-ink outline-none focus:border-accent`}
        data-testid={props.testids.box}
        aria-label={props.label}
        placeholder={props.label}
        spellcheck={false}
        value={query()}
        // The caret goes here as the panel attaches — it was opened to be typed
        // in. `queueMicrotask` for the reason every other panel in this client
        // uses one: the element is not in the document when the ref runs.
        ref={(box) => queueMicrotask(() => box.focus())}
        onInput={(event) => {
          setQuery(event.currentTarget.value)
          // A keystroke is a NEW question, so the answer to the last one is not
          // where anybody's eye is (`./cursor.ts`).
          cursor.top()
        }}
        onKeyDown={(event) => {
          switch (listKey(event)) {
            // ESCAPE IS THE PANEL'S, and this arm exists to say so: it is
            // deliberately not answered here, so the key bubbles to whatever
            // drew this list (`../edges/EdgePanel.tsx`, `../move/
            // MovePicker.tsx`, which stop it there the way `../edit/
            // RowPanel.tsx` does). It used to be answered on this box, and a
            // reader who had tabbed to the way-out button then pressed a key
            // that did nothing — the panel is what a dismissal is about, and
            // the box is only where the caret usually is (review of #245).
            case "dismiss":
              return
            case "next":
              event.preventDefault()
              cursor.step(1)
              return
            case "prev":
              event.preventDefault()
              cursor.step(-1)
              return
            case "take":
              // CLAIMED WHENEVER THERE IS A LIST, and spent only sometimes —
              // two facts, and this is the one that is about the KEY rather
              // than about the row. A list is on screen under the reader's
              // hands and an `Enter` falling past it would do something else
              // entirely; an empty list has nothing to claim, because a key
              // that does nothing over nothing is a key that is missing.
              if (hits().length > 0) event.preventDefault()
              // ...and what it SPENDS goes through the answer the rows came
              // from (`../settled.ts`'s `Taking`): they hold still through the
              // settle and the round trip after it, which is the only honest
              // thing to DRAW and the wrong thing to write from. This asks the
              // search rather than the row, because these rows ARE the wire's
              // `NodeHit`s and have nothing to carry it on — every door with a
              // row type of its own carries it there instead (`spend`).
              //
              // NOT inside {@link take}, and that is the whole of where it
              // belongs: a PRESS is a hand on the row it can SEE, and taking
              // that row is exactly what the hand asked for however far the
              // box has moved on. `Enter` is the one that means "the row under
              // the cursor" — and the cursor's row is about to change
              // underneath it.
              found.taking(() => take(cursor.at()))
              return
            case null:
              return
          }
        }}
      />

      {/* The search's own refusal, in its own words — never dropped, and never
          the same slot as a hit's: one is the server saying it could not
          answer, the other is an answer. A LINE under the box rather than a
          band across a panel, which is the filter bar's shape and not the two
          popovers'; the mood is `../SaidLine.tsx`'s either way. */}
      <Show when={found.failure()}>
        {(failure) => (
          <SaidLine
            said={{ tone: "alarm", text: failure() }}
            class="m-0 mt-1 font-mono text-xs"
            testid={props.testids.failed}
          />
        )}
      </Show>

      <ul class="m-0 max-h-56 list-none overflow-x-hidden overflow-y-auto p-0">
        {/* `<Index>` rather than `<For>`: the rows are positional, there are at
            most eight, and every keystroke mints fresh hits. */}
        <Index each={hits()}>
          {(hit, index) => (
            // The verdict is a fact about the ROW rather than a tone: a hit
            // that cannot be taken is dimmed so a reader scanning the list can
            // see it without walking onto it, and the sentence below says why
            // the one under the cursor cannot.
            <li
              data-refused={verdicts()[index] === null ? undefined : "true"}
              classList={{ "opacity-60": verdicts()[index] !== null }}
            >
              <Result
                label={row(index).label}
                of={row(index).of}
                place={row(index).place}
                props={row(index).props}
                active={index === cursor.at()}
                testids={props.testids.row}
                id={row(index).id}
                onHover={() => cursor.to(index)}
                onSelect={() => take(index)}
              />
            </li>
          )}
        </Index>
      </ul>

      {/* `../Refused.tsx`, which is the component that exists so a refusal is
          not a `<p>` copied per surface. The `<Show>` is around the BOX rather
          than left to that component's own: a bare wrapper with nothing in it
          is still a margin, and these panels are short enough for one to read
          as a gap somebody forgot to fill. */}
      <Show when={props.refusing}>
        {(judging) => (
          <Show when={refusal()}>
            {(why) => (
              <div class="mt-1">
                <Refused said={why()} testid={judging().testid} />
              </div>
            )}
          </Show>
        )}
      </Show>
    </div>
  )
}
