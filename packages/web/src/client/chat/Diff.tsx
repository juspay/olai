/**
 * A file the agent rewrote, in the transcript: trimmed, and expanded in place
 * on a click.
 *
 * This is the half of `chat-edit-diffs` that is NOT an outline. An olai write
 * shows up in the tree in front of you and is reported here as a node-level
 * story ({@link ./Wrote.tsx}); a direct edit to a `.md` or a source file shows
 * up nowhere at all, so until this drew, the answer to "what did it change" was
 * a terminal.
 *
 * The idiom is Claude Code CLI's, and both halves of it matter. A diff is drawn
 * rather than folded away — it is what the call DID, and a fold would put the
 * one interesting thing behind the same click as the arguments. And it is
 * TRIMMED, because a turn can rewrite four files and a panel is 26rem wide:
 * what shows is the first few rows of the change and a line saying how much
 * more there is, which expands where it stands.
 *
 * What is trimmed is the DIFF and never the file — the line diff collapses
 * unchanged runs into gaps before this sees it ({@link ./diff.ts}) — so the
 * first rows are the change itself rather than the top of a document.
 *
 * The colours are the palette's own two verdicts (`done` for what arrived,
 * `alarm` for what went), and they are spent on the TINT and the marker rather
 * than on the words: text stays `ink`, which is the one pair every palette
 * promises and holds. A line of code read in a colour is a line half the
 * palettes would have to be checked for.
 */

import type { FileDiff } from "@olai/surface"
import { createMemo, For, Show } from "solid-js"

import { TESTID } from "../testids.ts"
import { type DiffLine, diffOf } from "./diff.ts"
import { diffKey, isUnfolded, toggleFold } from "./folds.ts"

/** How many rows a trimmed diff shows. Enough for a small edit to be whole —
 *  which is most of them — and few enough that four rewritten files still read
 *  as a conversation rather than as a page of text. */
const TRIMMED = 6

/** What each kind of row looks like: the marker in the gutter, and how the row
 *  is painted. A table rather than three ternaries in the markup, so "what does
 *  an added line look like" is answered in one place. TOTAL over the kinds,
 *  including the gap — whose row still asks for a `row` class (it is painted
 *  like an unchanged line) while drawing its own contents below, so its `mark`
 *  and `tone` go unread. Spelled anyway rather than left as a missing key: an
 *  answer of "nothing" is a decision, and `said.ts`'s `MARK` makes the same
 *  one. */
const LOOK: Readonly<Record<DiffLine["kind"], { mark: string; row: string; tone: string }>> =
  {
    add: { mark: "+", row: "bg-done/10", tone: "text-done" },
    remove: { mark: "-", row: "bg-alarm/10", tone: "text-alarm" },
    // A NON-BREAKING space, and it is load-bearing: an ordinary one collapses
    // in HTML, which shifted every unchanged line one character left of the
    // changed lines around it — in a monospace column, where the whole point
    // is that the lines are under each other.
    same: { mark: " ", row: "", tone: "text-muted" },
    gap: { mark: "", row: "", tone: "text-muted" },
  }

export function Diff(props: {
  /** The call this diff belongs to — half of the key its expansion is
   *  remembered under. */
  readonly call: string
  readonly diff: FileDiff
}) {
  // Recomputed when the texts change and not on every render: an agent
  // rewriting a file reports the call twice, and the second report is the same
  // two texts with a status beside them.
  const computed = createMemo(() => diffOf(props.diff.oldText, props.diff.newText))
  const key = () => diffKey(props.call, props.diff.path)
  // A MEMO, because the fold set is one signal for every diff on screen: any
  // fold anywhere re-runs this, and a memo over the boolean is what stops that
  // reaching the slice and the list below it. Without it, opening one diff
  // re-slices and re-reconciles every other one in the transcript.
  const open = createMemo(() => isUnfolded(key()))
  const lines = () => computed().lines
  /** How many rows the trim is holding back — never the `hidden` a gap row
   *  carries, which counts unchanged lines inside the diff. */
  const more = () => Math.max(0, lines().length - TRIMMED)
  const shown = createMemo(() => (open() ? lines() : lines().slice(0, TRIMMED)))

  return (
    <div
      class="mt-1 overflow-hidden rounded border border-rule"
      data-testid={TESTID.chatDiff}
      data-path={props.diff.path}
      data-expanded={open()}
    >
      <p class="flex items-baseline gap-2 border-b border-rule px-2 py-1 font-mono text-[0.6875rem]">
        <span class="min-w-0 flex-1 truncate text-muted" title={props.diff.path}>
          {props.diff.path}
        </span>
        {/* A file that did not exist before is different news from one that was
            rewritten, and the counts alone cannot say it: a new file is all
            additions, and so is a file everything was appended to. */}
        <Show when={computed().created}>
          <span class="shrink-0 text-done">new</span>
        </Show>
        {/* The two sides were too far apart to line up, so every row below is
            a change and the first ones are the top of the old file. Said out
            loud rather than drawn as though it were an ordinary diff. */}
        <Show when={computed().wholesale}>
          <span class="shrink-0 text-muted" data-testid={TESTID.chatDiffWholesale}>
            rewritten whole
          </span>
        </Show>
        <Show when={computed().added > 0}>
          <span class="shrink-0 text-done">+{computed().added}</span>
        </Show>
        <Show when={computed().removed > 0}>
          <span class="shrink-0 text-alarm">−{computed().removed}</span>
        </Show>
      </p>

      <div class="overflow-x-auto font-mono text-[0.6875rem] leading-5">
        <For each={shown()}>
          {(line) => (
            <div
              class={`flex ${LOOK[line.kind].row}`}
              data-testid={TESTID.chatDiffLine}
              data-kind={line.kind}
            >
              {/* ONE number column, and it is the line as the file reads NOW
                  — except for a line that is gone, which has no such number
                  and shows where it used to be. Two columns is what a diff
                  tool with a full pane does; this is 26rem wide. */}
              <span
                class="w-8 shrink-0 select-none pr-2 text-right text-muted/70"
                aria-hidden="true"
              >
                {line.kind === "gap" ? "" : line.after ?? line.before}
              </span>
              <Show
                when={line.kind !== "gap"}
                fallback={
                  <span class="text-muted/70">⋯ {line.hidden} unchanged</span>
                }
              >
                <span class={`shrink-0 select-none pr-1 ${LOOK[line.kind].tone}`}>
                  {LOOK[line.kind].mark}
                </span>
                {/* `pre` so leading indentation is what the file has, and no
                    wrapping: a wrapped line of code is two rows that look like
                    two lines. The block scrolls sideways instead. */}
                <span class="whitespace-pre text-ink">{line.text}</span>
              </Show>
            </div>
          )}
        </For>
      </div>

      {/* IN PLACE: the same block grows, so the reader's eye stays where the
          change is. Absent when the whole diff already fits, because a control
          that does nothing is worse than no control. */}
      <Show when={more() > 0}>
        <button
          type="button"
          class="w-full border-t border-rule px-2 py-1 text-left font-mono text-[0.6875rem] text-muted hover:text-ink"
          data-testid={TESTID.chatDiffExpand}
          aria-expanded={open()}
          onClick={() => toggleFold(key())}
        >
          {open() ? "show less" : `+${more()} more lines`}
        </button>
      </Show>
    </div>
  )
}
