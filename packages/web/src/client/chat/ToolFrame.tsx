/**
 * A tool call: one line, foldable.
 *
 * A turn can be a dozen of these, and unfolded they would bury the conversation
 * they belong to. So the default is one line — a status mark and the agent's
 * own title — and the arguments are a click away for the times you want to know
 * exactly what was asked for.
 *
 * Two things escape that fold, because both are about a call that is HAPPENING
 * rather than about one that happened:
 *
 *   - **where it is working** (the protocol's follow-along locations) is drawn
 *     on the line itself, so a reader can see which file an agent is in without
 *     opening anything;
 *   - **what it is saying** (the protocol's incremental content) is drawn
 *     first in the unfolded body, ABOVE the arguments. A call that has been
 *     running for thirty seconds has something to show and its arguments are
 *     not it — until this was read, an unfolded running call showed what was
 *     asked for and then nothing at all until it completed, which is
 *     indistinguishable from one that had hung.
 *
 * And a third escapes it for a different reason: what the call CHANGED. A diff
 * of a file it rewrote ({@link ./Diff.tsx}), or the node-level story of a write
 * it made through the ops layer ({@link ./Wrote.tsx}) — the two vocabularies,
 * one per kind of write, and in practice a call is one or the other. That is
 * not detail:
 * the arguments are what was asked for, and this is what happened to somebody's
 * files. It is trimmed rather than folded, and the trim opens where it stands.
 *
 * The row is UPDATED rather than replaced. The transcript keys these by the
 * agent's own call id, so `pending` becoming `completed` is the same row
 * changing.
 *
 * The FOLD is keyed by that same id and kept outside this component
 * ({@link ./folds.ts}). Rendering by stable key keeps this row mounted across a
 * status change, but the drawer being closed and reopened rebuilds the panel
 * regardless — and a fold that shuts under the reader is exactly what somebody
 * unfolded it to avoid.
 */

import type { ChatEntry } from "@olai/surface"
import { For, Show } from "solid-js"

import { TESTID } from "../testids.ts"
import { Diff } from "./Diff.tsx"
import { isUnfolded, toggleFold } from "./folds.ts"
import { Wrote } from "./Wrote.tsx"

/** What each status looks like in one character. Words would wrap the line the
 *  frame exists to keep to one. */
const MARK: Record<string, string> = {
  pending: "·",
  in_progress: "…",
  completed: "✓",
  failed: "✗",
}

const TONE: Record<string, string> = {
  pending: "text-muted",
  in_progress: "text-doing",
  completed: "text-done",
  failed: "text-alarm",
}

export function ToolFrame(props: { readonly entry: ChatEntry }) {
  const open = () => isUnfolded(props.entry.id)
  const status = () => props.entry.status ?? "pending"
  /** There is something to unfold when there is either half of a body. A frame
   *  with neither is one line and nothing to press. */
  const body = () =>
    props.entry.detail !== undefined || props.entry.progress !== undefined

  return (
    <div
      class="rounded border border-rule"
      data-testid={TESTID.chatTool}
      data-tool-status={status()}
      data-tool-id={props.entry.id}
      data-unfolded={open()}
    >
      <button
        type="button"
        class="flex w-full items-center gap-2 px-2 py-1 text-left font-mono text-xs text-muted hover:text-ink"
        aria-expanded={open()}
        disabled={!body()}
        onClick={() => toggleFold(props.entry.id)}
      >
        <span class={TONE[status()] ?? "text-muted"} aria-hidden="true">
          {MARK[status()] ?? "·"}
        </span>
        <span class="min-w-0 flex-1 truncate">{props.entry.text}</span>
        {/* Unfolded: where it is working, on the line, because a reader
            following an agent through a tree wants the file more often than
            the arguments. Truncated rather than wrapped — the frame's whole
            promise is one line. */}
        <Show when={props.entry.locations}>
          {(locations) => (
            <span
              class="min-w-0 max-w-[45%] shrink truncate text-muted/70"
              data-testid={TESTID.chatToolLocations}
              title={locations().join("\n")}
            >
              {locations().join(" ")}
            </span>
          )}
        </Show>
        <Show when={body()}>
          <span aria-hidden="true">{open() ? "▾" : "▸"}</span>
        </Show>
      </button>

      {/* What the call CHANGED, outside the fold — in whichever of the two
          vocabularies applies, which in practice is one of them. A change is
          not detail: the arguments are what was asked for, and this is what
          happened to somebody's files. Folding it away would be putting the
          one thing the row is about behind the same click as the JSON. */}
      <Show when={props.entry.wrote}>
        {(wrote) => <Wrote wrote={wrote()} />}
      </Show>
      <For each={props.entry.diffs}>
        {(diff) => <Diff call={props.entry.id} diff={diff} />}
      </For>

      <Show when={open()}>
        {/* Progress FIRST: it is the live half, and a reader who unfolded a
            running call did it to see this rather than to re-read what was
            asked for. */}
        <Show when={props.entry.progress}>
          {(progress) => (
            <pre
              class="m-0 max-h-64 overflow-auto whitespace-pre-wrap border-t border-rule px-2 py-1 font-mono text-[0.6875rem] text-ink"
              data-testid={TESTID.chatToolProgress}
            >{progress()}</pre>
          )}
        </Show>
        <Show when={props.entry.detail}>
          {(detail) => (
            <pre
              class="m-0 max-h-64 overflow-auto border-t border-rule px-2 py-1 font-mono text-[0.6875rem] text-muted"
              data-testid={TESTID.chatToolDetail}
            >{detail()}</pre>
          )}
        </Show>
      </Show>
    </div>
  )
}
