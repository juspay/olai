/**
 * An outline the agent rewrote with its own tools — drawn as nodes, never as
 * lines.
 *
 * The sibling of {@link ./Diff.tsx} and the reason it has one: a `.jsonl` is one
 * line per node, so a text diff of it is a single enormous line with everything
 * on it changing at once. That is the Commit panel's oldest rule, and until this
 * drew, it held for olai's own writes and not for a file — an agent's `Edit`
 * aimed at an outline arrived as an ordinary diff block and was rendered as
 * ordinary lines.
 *
 * The rows are the Commit panel's rows: the same glyph, the same phrase, from
 * the same table ({@link ../changes.ts}). A person watching an agent edit an
 * outline by hand and a person reading what is waiting to be committed are
 * looking at one event, and it says the same thing in both places.
 *
 * The trim is the same idiom as the text diff's and shares its fold key, so a
 * reader who opened one file's change opened that file's change whichever shape
 * it took.
 */

import type { FileDiff } from "@olai/surface"
import { createMemo, For, Show } from "solid-js"

import { GLYPH, SAID } from "../changes.ts"
import { CARD } from "../surface.ts"
import { TESTID } from "../testids.ts"
import { diffKey, isUnfolded, toggleFold } from "./folds.ts"
import { outlineDiffOf } from "./outline.ts"

/** How many node rows a trimmed outline change shows. The text diff's number,
 *  because it is the same promise about the same panel. */
const TRIMMED = 6

export function OutlineDiff(props: {
  readonly call: string
  readonly diff: FileDiff
}) {
  const read = createMemo(() => outlineDiffOf(props.diff))
  const changes = createMemo(() => {
    const answer = read()
    return answer._tag === "Changes" ? answer.changes : []
  })
  /** Which side would not parse, or `null` when both did. */
  const unreadable = createMemo(() => {
    const answer = read()
    return answer._tag === "Unreadable" ? answer.side : null
  })
  const key = () => diffKey(props.call, props.diff.path)
  const open = createMemo(() => isUnfolded(key()))
  const more = () => Math.max(0, changes().length - TRIMMED)
  const shown = createMemo(() => (open() ? changes() : changes().slice(0, TRIMMED)))

  return (
    <div
      class={`mt-1.5 overflow-hidden rounded-lg ${CARD}`}
      data-testid={TESTID.chatOutlineDiff}
      data-path={props.diff.path}
      data-expanded={open()}
    >
      <p class="flex items-baseline gap-2 border-b border-seam px-2 py-1 font-mono text-[0.6875rem]">
        <span class="min-w-0 flex-1 truncate text-muted" title={props.diff.path}>
          {props.diff.path}
        </span>
        <Show when={props.diff.oldText === null}>
          <span class="shrink-0 text-done">new</span>
        </Show>
      </p>

      <Show
        when={unreadable() === null}
        fallback={
          /* Never a text diff, not even when the nodes cannot be read: what a
             reader is owed is which side stopped parsing, which is exactly the
             thing an agent hand-editing an outline does wrong. */
          <p class="px-2 py-1 text-xs text-alarm" data-testid={TESTID.chatOutlineUnreadable}>
            {unreadable() === "after"
              ? "the outline this call wrote does not parse, so what changed in it cannot be told"
              : "the outline as it stood does not parse, so what changed in it cannot be told"}
          </p>
        }
      >
        <Show
          when={changes().length > 0}
          fallback={
            <p class="px-2 py-1 text-xs text-muted">
              the file was rewritten and no node changed
            </p>
          }
        >
          <ul class="px-2 py-1 text-xs">
            <For each={shown()}>
              {(change) => (
                <li
                  class="flex items-baseline gap-2 py-0.5"
                  data-testid={TESTID.chatOutlineChange}
                  data-node-id={change.id}
                  data-sort={change.sort}
                  title={change.fields.join(", ")}
                >
                  <span class="w-3 shrink-0 text-muted" aria-hidden="true">
                    {GLYPH[change.sort]}
                  </span>
                  <span class="min-w-0 truncate text-ink">{change.title}</span>
                  <span class="ml-auto shrink-0 text-muted">{SAID[change.sort]}</span>
                </li>
              )}
            </For>
          </ul>
        </Show>
      </Show>

      <Show when={more() > 0}>
        <button
          type="button"
          class="w-full border-t border-seam px-2 py-1 text-left font-mono text-[0.6875rem] text-muted hover:text-ink"
          data-testid={TESTID.chatDiffExpand}
          aria-expanded={open()}
          onClick={() => toggleFold(key())}
        >
          {open() ? "show less" : `+${more()} more nodes`}
        </button>
      </Show>
    </div>
  )
}
