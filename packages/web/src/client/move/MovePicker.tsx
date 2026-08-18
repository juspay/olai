/**
 * The move-to picker: search every outline for a new parent, and put this row
 * under the one you choose — with everything hanging off it.
 *
 * Workflowy's `Ctrl+Shift+M` read through this app's own doctrine. What that
 * gesture IS — a keyboard door onto "this branch belongs somewhere else", asked
 * of a set too big to scroll — is exactly what arrived; what it is DRAWN as is
 * the shape this client already has for a write that needs a value chosen. A
 * dialog floating over the tree would be the one editing surface with geometry
 * of its own to keep anchored while the page scrolls, and the one that lands
 * under a thumb on a phone (`../date/DatePicker.tsx` made that argument,
 * `../edges/EdgePanel.tsx` repeated it, and this is a third surface of the same
 * kind rather than a first surface of a new one). So it hangs UNDER the row it
 * was opened on, where everything else a row says about a write is drawn.
 *
 * ## The search is the SERVER's, like every other one in this client
 *
 * `../search/nodes.ts` — the same procedure, debounce and minimum the ⌘K
 * palette, the header box, the `((` widget and the edge panel call, drawing the
 * same row (`../search/Result.tsx`) walked with the same cursor. What this door
 * finds and what an agent's `search_nodes` finds cannot drift, which is the
 * whole reason a browser with the entire corpus in memory asks a server what it
 * already holds.
 *
 * The query is the full grammar, so `is:todo`, `#home` and `file:garden.olai`
 * all narrow the destinations — and `is:archived` reaches into the Trash, where
 * every hit is refused by name rather than quietly missing. Archived nodes are
 * out of the default answer already (the matcher's own rule), so that refusal
 * is for the reader who asked for them on purpose.
 *
 * ## Nothing is hidden, and the ones that cannot take the row say why
 *
 * The panel searches the WHOLE SET, so most of what it can find is somewhere
 * this row cannot go. Every hit is drawn anyway — the edge panel's rule, for
 * the edge panel's reason: a browser that dropped rows would be teaching a rule
 * this app does not have, and a reader hunting for a title they can see is a
 * reader debugging a search. What is drawn instead is the REASON, under the
 * list, about the row the cursor is on — the aim rather than the write, which
 * is the shape a drop over the wrong pane already has (`../drag/Refusal.tsx`,
 * #238). `Enter` there sends nothing: the answer is already on screen.
 *
 * Which destinations those are, and in what words, is `./destination.ts` —
 * pure, and unit-tested, because a sentence a reader depends on is not a thing
 * to check by hand.
 *
 * ## One press, and the refusals that are still the ops layer's
 *
 * What lands is one `under` edit at the same gate every other write goes
 * through, resolving to the `move_node` an agent sends. A destination this
 * panel says nothing about can still be refused there — an id that has moved
 * since the search answered, a file that stopped parsing — and that sentence
 * lands verbatim under the row (`./moving.tsx` owns the line, because it
 * outlives the panel a landed write closes).
 */

import { createMemo, createSignal, Index, Show } from "solid-js"

import type { Edit } from "@olai/surface"

import { useDerived } from "../derived.tsx"
import { listKey } from "../keys.ts"
import { Refused } from "../Refused.tsx"
import { createCursor } from "../search/cursor.ts"
import { createNodeSearch } from "../search/nodes.ts"
import { nodePlace } from "../search/place.ts"
import { nodeProps } from "../search/props.ts"
import { Result, type RowTestids } from "../search/Result.tsx"
import { TESTID } from "../testids.ts"
import { TARGET } from "../touch.ts"
import { type Moved, whyNot } from "./destination.ts"

/** What this door calls its rows (`../search/Result.tsx`'s `RowTestids`). */
const MOVE_ROW: RowTestids = {
  row: TESTID.moveHit,
  place: TESTID.moveHitPlace,
  prop: TESTID.moveHitProp,
}

export function MovePicker(props: {
  /** The row being moved, as the set says it NOW — re-read per frame by the
   *  host, so a panel standing open while another writer moves the row is
   *  judging against where it has actually got to. */
  readonly moved: Moved
  /** What the row SAYS — the title of the node it shows, for the one line this
   *  panel writes about what is being moved. Beside {@link Moved} rather than
   *  inside it, which is `../search/place.ts`'s rule: a value takes the fields
   *  it READS, and every field of that one is a field the verdict judges. */
  readonly title: string
  /** Send it. The host knows the write gate, the undo stack and where the
   *  answer is drawn (`./moving.tsx`); this knows which destination. */
  readonly onWrite: (edit: Edit) => void
  readonly onClose: () => void
}) {
  const derived = useDerived()
  const [query, setQuery] = createSignal("")
  const found = createNodeSearch(() => query())
  const cursor = createCursor(() => found.hits().length)

  /**
   * The verdict on every hit, in the order they are drawn — `null` where the
   * destination can take this row.
   *
   * ONE memo over the list rather than a call per binding: each row asks
   * whether it is refused (twice — the dim and the press), and the sentence
   * under the list asks the same of the row the cursor is on. Answered per
   * hit, once per answer, they cannot disagree — and walking the list with the
   * arrows re-derives nothing, because the cursor is an index into this.
   *
   * The one step of ancestry the never-inside-itself rule needs is read off the
   * LIVE derivation, so it is the tree this tab is drawing.
   */
  const verdicts = createMemo<ReadonlyArray<string | null>>(() => {
    const indexes = derived()
    // NO INDEXES is the frame before the first one arrives — which no row is
    // drawn in, so no panel is open over it either. The answer if it ever were
    // is `null` rather than a refusal: this module is a preview of the
    // planner's verdict, and with nothing to preview from, the planner is the
    // one that answers. A refusal invented here would be a fence.
    return found.hits().map((hit) =>
      indexes === undefined ? null : whyNot(props.moved, hit, indexes)
    )
  })

  /** Why the destination under the cursor cannot take this row — `null` when it
   *  can, and when there is nothing under the cursor at all. */
  const refusal = (): string | null => verdicts()[cursor.at()] ?? null

  /**
   * TAKE the destination at `index` — the one thing both hands do, and one
   * function because they must do it identically: `Enter` on the row the
   * cursor is on, and a press on any row.
   *
   * A press POINTS FIRST, which is what makes the two the same gesture: the
   * cursor moves to what was pressed, so the sentence under the list is about
   * the row the hand just chose rather than about wherever the arrows had got
   * to.
   *
   * It answers whether the gesture was CLAIMED rather than whether anything was
   * written — a refused destination has already put its reason on screen, so
   * `Enter` there is answered and must not fall through to the row underneath.
   * Nothing to take at all is not claimed: swallowing `Enter` over an empty
   * list would be a key that does nothing.
   */
  const take = (index: number): boolean => {
    const hit = found.hits()[index]
    if (hit === undefined) return false
    cursor.to(index)
    if (verdicts()[index] !== null) return true
    props.onWrite({ verb: "under", id: props.moved.id, parent: hit.id })
    return true
  }

  return (
    <div
      class="my-1 w-[min(28rem,90vw)] rounded border border-rule/70 bg-panel p-2"
      data-testid={TESTID.movePicker}
      // WHICH ROW it is about, as a fact in the markup rather than something a
      // reader has to infer from where it is drawn — the row moves under it
      // when a write lands, and this is what says the panel followed.
      data-row={props.moved.id}
      // WHICH QUERY the hits below answer (`../search/nodes.ts`) — absent while
      // they answer one the reader has moved on from, which is what lets a
      // scenario wait for the rows of the search it just typed rather than for
      // any rows at all.
      data-asked={found.answering() ?? undefined}
    >
      <p class="m-0 mb-1 text-xs text-muted">
        Move <span class="text-ink">{props.title}</span> under…
      </p>

      <input
        type="text"
        class={`${TARGET} md:min-h-0 w-full rounded border border-rule bg-paper px-2 py-1 text-sm text-ink outline-none focus:border-accent`}
        data-testid={TESTID.moveSearch}
        aria-label="search for a new parent"
        placeholder="search every outline for a new parent"
        spellcheck={false}
        value={query()}
        // The caret goes here as the panel attaches — it was opened to be typed
        // in. `queueMicrotask` for the reason every other panel in this client
        // uses one: the element is not in the document when the ref runs.
        ref={(box) => queueMicrotask(() => box.focus())}
        onInput={(event) => {
          setQuery(event.currentTarget.value)
          // A keystroke is a NEW question, so the answer to the last one is not
          // where anybody's eye is (`../search/cursor.ts`).
          cursor.top()
        }}
        onKeyDown={(event) => {
          // The registry's, never a private match (`../keys.ts`): these are the
          // same four keys a row editor, the palette and the edge panel claim,
          // and a component matching them privately is the silent disagreement
          // that file exists to prevent.
          switch (listKey(event)) {
            case "dismiss":
              // Stopped here: the row's own editor and the palette both listen
              // for Escape further up, and one key must not close two things.
              event.preventDefault()
              event.stopPropagation()
              props.onClose()
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
          the same slot as a destination's: one is the server saying it could
          not answer, the other is an answer. */}
      <Show when={found.failure()}>
        {(failure) => (
          <p
            class="m-0 mt-1 font-mono text-xs text-alarm"
            data-testid={TESTID.moveSearchFailed}
            role="alert"
          >
            {failure()}
          </p>
        )}
      </Show>

      <ul class="m-0 max-h-56 list-none overflow-x-hidden overflow-y-auto p-0">
        {/* `<Index>` for the reason the edge panel uses one: the rows are
            positional, there are at most eight, and every keystroke mints fresh
            hits. */}
        <Index each={found.hits()}>
          {(hit, index) => (
            // The verdict is a fact about the ROW rather than a tone: a
            // destination that cannot take this row is dimmed so a reader
            // scanning the list can see it without walking onto it, and the
            // sentence below says why the one under the cursor cannot.
            <li
              data-refused={verdicts()[index] === null ? undefined : "true"}
              classList={{ "opacity-60": verdicts()[index] !== null }}
            >
              <Result
                label={hit().title}
                place={nodePlace(hit())}
                props={nodeProps(hit())}
                active={index === cursor.at()}
                testids={MOVE_ROW}
                id={hit().id}
                onHover={() => cursor.to(index)}
                onSelect={() => void take(index)}
              />
            </li>
          )}
        </Index>
      </ul>

      {/* Why the destination under the cursor cannot take this row — `../
          Refused.tsx`, which is the component that exists so a refusal is not a
          `<p>` copied per surface. The `<Show>` is around the BOX rather than
          left to the component's own: a bare wrapper with nothing in it is
          still a margin, and this panel is short enough for one to read as a
          gap somebody forgot to fill. */}
      <Show when={refusal()}>
        {(why) => (
          <div class="mt-1">
            <Refused said={why()} testid={TESTID.moveRefused} />
          </div>
        )}
      </Show>

      <div class="mt-1 flex items-center justify-end">
        <button
          type="button"
          class={`${TARGET} md:min-h-0 cursor-pointer rounded border-0 bg-transparent px-2 py-1 text-sm text-muted hover:text-ink`}
          data-testid={TESTID.movePickerClose}
          onClick={() => props.onClose()}
        >
          Done
        </button>
      </div>
    </div>
  )
}
