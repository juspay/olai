/**
 * The panel that WRITES a node's edges — one relation at a time, in place under
 * the row (or under the heading, on a node's own page).
 *
 * MCP could add and drop `see` references and `after` dependencies, and a
 * person could do neither: the web has DRAWN both since edges-ui — the links
 * under a node, the dim and the `blocked by` line of a blocked row — and had no
 * affordance to change one. That is a standing consistency deviation rather
 * than a missing feature (HACKING.md, `parity-see` / `parity-after`), and this
 * is what closes it. What it sends is the intent every other write on this face
 * sends: one `see` / `after` edit at the same gate `set_see` and `set_after` go
 * through, judged by the same planner, refused in the same words. Nothing is
 * echoed — a reference appears when the file says it does.
 *
 * ## One panel for both fields, and both directions
 *
 * The ops layer plans them with ONE function, because they are one gesture over
 * two fields; the words that differ are a table (`./relation.ts`). So this
 * draws the relation's own heading, what the node says NOW with an `×` on each,
 * and a search for what to add — and a person managing a node's links never has
 * to find two different controls for the two halves of the same job.
 *
 * The `×` is here rather than only on the rendered refs row for a reason a
 * reader can see: a tree row draws its `see` links inside the note it expands,
 * so a node with references and no note has nowhere to put one. The row on a
 * node's own page has the `×` too (`./EdgeRefs.tsx`) — two
 * doors onto one write, which is the shape `Clear date` already has.
 *
 * ## The search is the SERVER's, like every other one in this client
 *
 * `../search/nodes.ts` — the same procedure, debounce and minimum the ⌘K
 * palette, the header box and the `((` widget call, drawing the same row
 * (`../search/Result.tsx`) walked with the same cursor. A browser that grew a
 * second matcher for this panel would break the consistency rule INSIDE one
 * process: what this finds and what an agent's `search_nodes` finds cannot
 * drift.
 *
 * ## In place, not floating
 *
 * The date picker's argument, unchanged (`../date/DatePicker.tsx`): everything
 * else a row says about a write is drawn under it, and a panel floating over
 * the tree would be the one editing surface with geometry of its own to keep
 * anchored while the page scrolls. Escape and `Done` are the ways out; a write
 * that landed leaves it OPEN, because linking two or three nodes is one job and
 * a panel that shut after each would ask for the menu again every time.
 *
 * WHAT A WRITE SAID is not drawn here, and that is the one seam worth naming:
 * the `×` on a reference drawn OUTSIDE this panel is the same write, and it can
 * be refused for the same reasons, so the line that says so belongs to whatever
 * outlives both (`./editing.tsx`). This component chooses a target and sends;
 * it keeps no answer.
 *
 * NOTHING IS FENCED. The node itself is in the list it searches, and so is a
 * node that would close a loop: an `after` add that deadlocks is refused by the
 * ops layer NAMING the loop, which is the sentence a person needs and exactly
 * the sentence an agent gets. A panel that hid those rows would be teaching a
 * rule this app does not have, and hiding it in a browser is not the same as
 * the file being unable to say it.
 */

import type { RegularNode } from "@olai/format"
import type { Edit } from "@olai/surface"
import { createMemo, createSignal, For, Index, Show } from "solid-js"

import { useDerived } from "../derived.tsx"
import { listKey } from "../keys.ts"
import { createCursor } from "../search/cursor.ts"
import { createNodeSearch } from "../search/nodes.ts"
import { nodePlace } from "../search/place.ts"
import { Result } from "../search/Result.tsx"
import { TESTID } from "../testids.ts"
import { TARGET } from "../touch.ts"
import { DropRef } from "./DropRef.tsx"
import { namedBy } from "./named.ts"
import { linking, type Relation, relating, unlinking } from "./relation.ts"

export function EdgePanel(props: {
  /** The node these edges belong to — the node a row SHOWS, never a placement,
   *  which carries no edges at all. */
  readonly node: RegularNode
  readonly relation: Relation
  /** Send it. The host is what knows the write gate, the undo stack and where
   *  the answer is drawn (`./editing.tsx`); this is what knows which target.
   *  One write at a time is the host's guard too, for the same reason the
   *  answer is: both outlive the panel, which a write that landed may close. */
  readonly onWrite: (edit: Edit) => void
  readonly onClose: () => void
}) {
  const derived = useDerived()
  /** A table index, not a computation: a memo here would cost a reactive node
   *  to cache a property read whose key cannot change under it. */
  const words = () => relating(props.relation)
  const [query, setQuery] = createSignal("")

  /** What the node says NOW — the same reading the row of links draws
   *  (`./named.ts`), so the panel and the page cannot disagree about what an id
   *  names or about the frame before the indexes arrive. */
  const held = createMemo(() => namedBy(props.node, props.relation, derived))

  const found = createNodeSearch(() => query())
  const cursor = createCursor(() => found.hits().length)

  /** Take the row the cursor is on. Nothing to take is not a key — swallowing
   *  Enter over an empty list would be a keystroke that does nothing at all. */
  const take = (): boolean => {
    const hit = found.hits()[cursor.at()]
    if (hit === undefined) return false
    props.onWrite(linking(props.node.id, props.relation, hit.id))
    return true
  }

  return (
    <div
      class="my-1 w-[min(28rem,90vw)] rounded border border-rule/70 bg-panel p-2"
      data-testid={TESTID.edgePanel}
      data-relation={props.relation}
      // WHICH QUERY the rows below answer (`../search/nodes.ts`), as a fact in
      // the markup rather than something a reader has to infer from what is in
      // them. It is the same kind of claim `data-relation` beside it is, and it
      // is what lets a scenario wait for the rows of the query it just typed —
      // a wait for "any rows" is a wait a second search in one scenario would
      // satisfy with the first one's list.
      data-asked={found.answering() ?? undefined}
    >
      <p class="m-0 mb-1 text-xs text-muted">{words().heading}</p>

      {/* What it says now, each with the write that takes it off. Drawn before
          the box because it is what the panel is ABOUT — the search adds to
          this list, and a person opening the panel to remove one should not
          have to read past a control they do not want. */}
      <Show when={held().length > 0}>
        <ul
          class="m-0 mb-1 flex list-none flex-wrap gap-1 p-0"
          data-testid={TESTID.edgeHeld}
        >
          <For each={held()}>
            {(one) => (
              <li class="flex items-center gap-1 rounded border border-rule/70 px-1.5 py-0.5 text-sm text-ink">
                <span data-ref={one.id}>{one.title}</span>
                {/* The same × the drawn row carries, saying the same sentence
                    (`./DropRef.tsx`) — two doors onto one op, named once. */}
                <DropRef
                  testid={TESTID.edgeDrop}
                  relation={props.relation}
                  id={one.id}
                  title={one.title}
                  onDrop={(target) =>
                    props.onWrite(unlinking(props.node.id, props.relation, target))}
                />
              </li>
            )}
          </For>
        </ul>
      </Show>

      <input
        type="text"
        class={`${TARGET} md:min-h-0 w-full rounded border border-rule bg-paper px-2 py-1 text-sm text-ink outline-none focus:border-accent`}
        data-testid={TESTID.edgeSearch}
        aria-label={words().placeholder}
        placeholder={words().placeholder}
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
          // same four keys a row editor, the palette and the `((` widget claim,
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
              if (take()) event.preventDefault()
              return
            case null:
              return
          }
        }}
      />

      {/* The search's own refusal, in its own words — never dropped. */}
      <Show when={found.failure()}>
        {(failure) => (
          <p
            class="m-0 mt-1 font-mono text-xs text-alarm"
            data-testid={TESTID.edgeSearchFailed}
            role="alert"
          >
            {failure()}
          </p>
        )}
      </Show>

      <ul class="m-0 max-h-56 list-none overflow-x-hidden overflow-y-auto p-0">
        {/* `<Index>` for the reason the completions list uses one: the rows are
            positional, there are at most eight, and every keystroke mints fresh
            hits. */}
        <Index each={found.hits()}>
          {(hit, index) => (
            <li>
              <Result
                label={hit().title}
                place={nodePlace(hit())}
                active={index === cursor.at()}
                testid={TESTID.edgeHit}
                placeTestid={TESTID.edgeHitPlace}
                id={hit().id}
                onHover={() => cursor.to(index)}
                onSelect={() =>
                  props.onWrite(linking(props.node.id, props.relation, hit().id))}
              />
            </li>
          )}
        </Index>
      </ul>

      <div class="mt-1 flex items-center justify-end">
        <button
          type="button"
          class={`${TARGET} md:min-h-0 cursor-pointer rounded border-0 bg-transparent px-2 py-1 text-sm text-muted hover:text-ink`}
          data-testid={TESTID.edgePanelClose}
          onClick={() => props.onClose()}
        >
          Done
        </button>
      </div>
    </div>
  )
}
