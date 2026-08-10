/**
 * A tool call: one line, foldable.
 *
 * A turn can be a dozen of these, and unfolded they would bury the conversation
 * they belong to. So the default is one line — a status mark and the agent's
 * own title — and the arguments are a click away for the times you want to know
 * exactly what was asked for.
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
import { Show } from "solid-js"

import { TESTID } from "../testids.ts"
import { isUnfolded, toggleFold } from "./folds.ts"

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
        disabled={props.entry.detail === undefined}
        onClick={() => toggleFold(props.entry.id)}
      >
        <span class={TONE[status()] ?? "text-muted"} aria-hidden="true">
          {MARK[status()] ?? "·"}
        </span>
        <span class="min-w-0 flex-1 truncate">{props.entry.text}</span>
        <Show when={props.entry.detail !== undefined}>
          <span aria-hidden="true">{open() ? "▾" : "▸"}</span>
        </Show>
      </button>

      <Show when={open() && props.entry.detail !== undefined}>
        <pre
          class="m-0 max-h-64 overflow-auto border-t border-rule px-2 py-1 font-mono text-[0.6875rem] text-muted"
          data-testid={TESTID.chatToolDetail}
        >{props.entry.detail}</pre>
      </Show>
    </div>
  )
}
