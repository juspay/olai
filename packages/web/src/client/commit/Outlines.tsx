/**
 * The outlines, one group per file: what changed in each, node by node.
 *
 * Every row here is a NODE and what changed about it — "marked done", "note
 * rewritten", "archived". There is no text diff and there will not be one: a
 * `.jsonl` diff is one enormous line per node with everything on it changing at
 * once, which is exactly the shape this format bought line-based merges with and
 * exactly the shape nobody can read.
 *
 * Grouped by FILE because that is the unit git commits and the unit the sidebar
 * already lists — and, since the panel learnt to be piecemeal, the unit a person
 * ticks. Ordered as the server derived them, which is the outline's own order.
 *
 * The group is drawn from `pending.outlines` rather than by grouping the
 * changes, and that is what makes a dirty outline with NO node changes visible:
 * a reformat, a reordered line, a file somebody touched and saved. It is dirty,
 * it is committable, and grouping the changes would have drawn nothing at all.
 */

import type { DirtyOutline, NodeChange } from "@olai/format"
import { For, Show } from "solid-js"

import { GLYPH, HOW, HOW_TONE, SAID } from "./said.ts"
import type { Selection } from "./selection.ts"
import { TESTID } from "../testids.ts"
import { Tick } from "./Tick.tsx"

export function Outlines(props: {
  readonly outlines: ReadonlyArray<DirtyOutline>
  readonly changes: ReadonlyArray<NodeChange>
  readonly selection: Selection
}) {
  const changesIn = (file: string): ReadonlyArray<NodeChange> =>
    props.changes.filter((change) => change.file === file)

  return (
    <For each={props.outlines}>
      {(outline) => (
        <div
          data-testid={TESTID.commitGroup}
          data-file={outline.file}
          data-path={outline.path}
          // Unticked is DIMMED rather than hidden: what a person left out is
          // still waiting, and a row that vanished when it was unticked would
          // read as one that had been dealt with.
          class={props.selection.ticked(outline.path) ? "" : "opacity-40"}
        >
          <p class="flex items-baseline gap-2">
            <Tick
              path={outline.path}
              ticked={props.selection.ticked(outline.path)}
              toggle={() => props.selection.toggle(outline.path)}
              label={`commit ${outline.path}`}
            />
            <span class="min-w-0 truncate font-mono text-xs text-muted">
              {outline.file}
            </span>
            {/* A brand-new outline is UNTRACKED, which no node comparison can
                say: every node in it reads as created either way. */}
            <Show when={outline.how !== "modified"}>
              <span class={`ml-auto shrink-0 text-xs ${HOW_TONE[outline.how]}`}>
                {HOW[outline.how]}
              </span>
            </Show>
          </p>
          <ul class="pl-5">
            <For each={changesIn(outline.file)}>
              {(change) => (
                <li
                  class="flex items-baseline gap-2 py-0.5"
                  data-testid={TESTID.commitChange}
                  data-node-id={change.id}
                  data-sort={change.sort}
                  // The fields behind the word: "moved" is `parent, ord`, and a
                  // row that changed three things says which three without
                  // spending a line on it.
                  title={change.fields.join(", ")}
                >
                  <span class="w-3 shrink-0 text-muted" aria-hidden="true">
                    {GLYPH[change.sort]}
                  </span>
                  <span class="min-w-0 truncate">{change.title}</span>
                  <span class="ml-auto shrink-0 text-xs text-muted">
                    {SAID[change.sort]}
                  </span>
                </li>
              )}
            </For>
          </ul>
        </div>
      )}
    </For>
  )
}
