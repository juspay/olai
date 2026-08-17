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
 * A CALL THAT SPAWNED AN AGENT says so on the line as well, in the slot the
 * locations take — because it cannot have any, and because "an agent was sent
 * out" is the fact a reader of a fan-out most needs and the one that used to
 * be nowhere on screen until the agent reported back ({@link ./spawn.ts}).
 * That is the whole of what this component does about a spawn: the live rail
 * under it belongs to the list, which is the thing that has rows to put a rail
 * beside.
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

import { fileKind } from "@olai/format"
import type { ChatEntry } from "@olai/surface"
import { Key } from "@solid-primitives/keyed"
import { createMemo, Show } from "solid-js"

import { TESTID } from "../testids.ts"
import { Diff } from "./Diff.tsx"
import { diffKey, isUnfolded, toggleFold } from "./folds.ts"
import { OutlineDiff } from "./OutlineDiff.tsx"
import { faceOf } from "./spawn.ts"
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
  /**
   * The blocks of change this call reported, each carrying the NAME that
   * identifies it ({@link ./folds.ts}'s `diffKey`).
   *
   * The name is minted HERE, once, and used for both things a block has an
   * identity for: the key the list below is drawn by, and the key its trim is
   * remembered under. Two mintings would be two answers to "which block is
   * this", free to disagree — and the crash this shape exists to prevent was
   * exactly one of them being wrong.
   *
   * It carries the block's PLACE in the report, because a path does not name a
   * block: the adapter reports an `Edit` as one `diff` per hunk of the patch,
   * all under one path, so an edit that landed in three places is three blocks
   * with one name between them. `<Key>` answers a repeated key with the SAME
   * element repeated, which is a thing no list of DOM nodes may contain — the
   * framework's reconciliation walks off the end of the array it is patching
   * and throws mid-draw, taking the page with it.
   *
   * A memo, so the fresh objects are minted when the blocks move and not on
   * every unrelated frame of the call.
   */
  const blocks = createMemo(() =>
    (props.entry.diffs ?? []).map((diff, at) => ({
      key: diffKey(props.entry.id, at, diff.path),
      diff,
    }))
  )
  /** There is something to unfold when there is either half of a body. A frame
   *  with neither is one line and nothing to press. */
  const body = () =>
    props.entry.detail !== undefined || props.entry.progress !== undefined

  return (
    <div
      class="min-w-0 rounded-lg border border-rule/70 bg-panel"
      data-testid={TESTID.chatTool}
      data-tool-status={status()}
      data-tool-id={props.entry.id}
      data-unfolded={open()}
    >
      {/* The fold, named — because it is no longer the only control in this
          frame: what the call CHANGED is drawn under it, and the node an olai
          write was about is a button of its own now ({@link ./Reference.tsx}).
          "The button in the tool frame" was a description that happened to be
          unique, and a scenario that reached for it that way found two. */}
      <button
        type="button"
        class="flex w-full items-center gap-2 px-2 py-1 text-left font-mono text-xs text-muted hover:text-ink"
        data-testid={TESTID.chatToolFold}
        aria-expanded={open()}
        disabled={!body()}
        onClick={() => toggleFold(props.entry.id)}
      >
        <span class={TONE[status()] ?? "text-muted"} aria-hidden="true">
          {MARK[status()] ?? "·"}
        </span>
        <span class="min-w-0 flex-1 truncate">{props.entry.text}</span>
        {/* WHO WAS SENT, on the line, from the moment the spawn is announced —
            which is a good while before the agent has done anything to draw a
            lane out of ({@link ./spawn.ts}). It shares the slot a call's
            locations take, and shares it safely: an `Agent` call works in no
            file and reports none, so the two are never on one row. */}
        <Show when={faceOf(props.entry)}>
          {(face) => (
            <span
              class="flex min-w-0 shrink-0 items-center gap-1 text-muted/70"
              data-testid={TESTID.chatSpawn}
              data-spawn-kind={face().who}
            >
              {/* The lane's own glyph, so the marker on the row and the label
                  on the rail under it are visibly the same fact: somebody
                  else is doing this. Without it, a kind sitting where a file
                  path usually sits reads as a file path. */}
              <span aria-hidden="true">↳</span>
              <span class="min-w-0 truncate">{face().who}</span>
            </span>
          )}
        </Show>
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
      {/* Keyed BY THE BLOCK'S OWN NAME, the way every other list in this app is
          keyed: a call is reported twice, and the second report carries the
          blocks in a fresh array — under `<For>` that is a new object at the
          same index, which remounts the row and throws away what it owns while
          a reader is looking at it. The rule the frame itself follows, one list
          down.

          The name is the call, the place and the path, and it used to be the
          path alone. That read as the same rule and was not: a path names a
          FILE, and one call reports several blocks about one file — so three
          hunks of one edit were three rows answering to one key, and the list
          drew one element three times. See `blocks` above. */}
      <Key each={blocks()} by="key">
        {(block) => (
          /* Which SHAPE a change is drawn in is decided by the FILE and not by
             the tool: an outline is one line per node, so a text diff of one is
             a single enormous line — the rule the Commit panel has always had,
             and it holds for an agent's own `Edit` as much as for an olai
             write. */
          <Show
            when={fileKind(block().diff.path) === "outline"}
            fallback={<Diff id={block().key} diff={block().diff} />}
          >
            <OutlineDiff id={block().key} diff={block().diff} />
          </Show>
        )}
      </Key>

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
