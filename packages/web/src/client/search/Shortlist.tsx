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
 * them itself is the silent disagreement that registry exists to prevent.
 * Escape is STOPPED here, because the row's editor and the palette both listen
 * for it further up and one key must not close two things.
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

import type { SearchHit } from "@olai/surface"
import { createMemo, createSignal, Index, Show } from "solid-js"

import { listKey } from "../keys.ts"
import { Refused } from "../Refused.tsx"
import type { TestId } from "../testids.ts"
import { TARGET } from "../touch.ts"
import { createCursor } from "./cursor.ts"
import { createNodeSearch } from "./nodes.ts"
import { nodePlace } from "./place.ts"
import { nodeProps } from "./props.ts"
import { Result, type RowTestids } from "./Result.tsx"

/**
 * What one door calls the parts of its shortlist.
 *
 * One value rather than four props, which is `./Result.tsx`'s `RowTestids`
 * reasoning one level up: they are one surface's identity, named once at the
 * call site off `../testids.ts`, rather than four arguments a caller can pass
 * in the wrong order — and a door that passed the box's name and forgot the
 * failure line's would draw a sentence no test could reach.
 */
export interface ShortlistTestids {
  readonly box: TestId
  readonly row: RowTestids
  /** A refused SEARCH, in the server's words. */
  readonly failed: TestId
}

export function Shortlist(props: {
  /** What the box is FOR, as one sentence — its placeholder and its
   *  `aria-label`, which are the same words for the same reason a label and a
   *  hint would not be: there is nothing above the box to read. */
  readonly label: string
  readonly testids: ShortlistTestids
  /** Take this hit. The door knows what a take MEANS — a reference written, a
   *  row carried — and this knows only which row was chosen. */
  readonly onTake: (hit: SearchHit) => void
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
    readonly why: (hit: SearchHit) => string | null
    readonly testid: TestId
  }
  /** Escape. The door decides what shutting means. */
  readonly onDismiss: () => void
}) {
  const [query, setQuery] = createSignal("")
  const found = createNodeSearch(() => query())
  const cursor = createCursor(() => found.hits().length)

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
  const verdicts = createMemo<ReadonlyArray<string | null>>(() => {
    const judge = props.refusing
    return found.hits().map((hit) => (judge === undefined ? null : judge.why(hit)))
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
  const take = (index: number): boolean => {
    const hit = found.hits()[index]
    if (hit === undefined) return false
    cursor.to(index)
    if (verdicts()[index] !== null) return true
    props.onTake(hit)
    return true
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
            case "dismiss":
              event.preventDefault()
              event.stopPropagation()
              props.onDismiss()
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
              if (take(cursor.at())) event.preventDefault()
              return
            case null:
              return
          }
        }}
      />

      {/* The search's own refusal, in its own words — never dropped, and never
          the same slot as a hit's: one is the server saying it could not
          answer, the other is an answer. */}
      <Show when={found.failure()}>
        {(failure) => (
          <p
            class="m-0 mt-1 font-mono text-xs text-alarm"
            data-testid={props.testids.failed}
            role="alert"
          >
            {failure()}
          </p>
        )}
      </Show>

      <ul class="m-0 max-h-56 list-none overflow-x-hidden overflow-y-auto p-0">
        {/* `<Index>` rather than `<For>`: the rows are positional, there are at
            most eight, and every keystroke mints fresh hits. */}
        <Index each={found.hits()}>
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
                label={hit().title}
                place={nodePlace(hit())}
                props={nodeProps(hit())}
                active={index === cursor.at()}
                testids={props.testids.row}
                id={hit().id}
                onHover={() => cursor.to(index)}
                onSelect={() => void take(index)}
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
