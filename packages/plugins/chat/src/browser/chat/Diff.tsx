import { textOfDiff } from "./carried.ts"
import { Grip, textCarry } from "./Grip.tsx"

import type { FileDiff } from "@kolu/acp/wire"
import { createMemo, For, Show } from "solid-js"

import { TESTID } from "../../testids.ts"
import { Tip } from "@olai/web/client/Tip.tsx"
import { type DiffLine, diffOf } from "./diff.ts"
import { useConversationUI } from "./ui.tsx"

const TRIMMED = 6

const NBSP = "\u00a0"

const LOOK: Readonly<Record<DiffLine["kind"], { mark: string; row: string; tone: string }>> =
  {
    add: { mark: "+", row: "bg-done/10", tone: "text-done" },
    remove: { mark: "-", row: "bg-alarm/10", tone: "text-alarm" },
    same: { mark: NBSP, row: "", tone: "text-muted" },
    gap: { mark: "", row: "", tone: "text-muted" },
  }

export function Diff(props: {
  readonly id: string
  readonly diff: FileDiff
}) {
  const { isUnfolded, toggleFold } = useConversationUI().folds
  const texts = createMemo(() => [props.diff.oldText, props.diff.newText] as const, undefined,
    { equals: (a, b) => a[0] === b[0] && a[1] === b[1] })
  const computed = createMemo(() => diffOf(...texts()))
  const open = createMemo(() => isUnfolded(props.id))
  const lines = () => computed().lines
  const more = () => Math.max(0, lines().length - TRIMMED)
  const shown = createMemo(() => (open() ? lines() : lines().slice(0, TRIMMED)))

  const words = () => textOfDiff(props.diff.path, props.diff.oldText, props.diff.newText)
  const carry = textCarry(words)

  return (
    <div
      onPointerDown={carry.touch} onContextMenu={carry.heldMenu}
      class="mt-1 min-w-0 overflow-hidden rounded-control border border-rule"
      data-testid={TESTID.chatDiff}
      data-path={props.diff.path}
      data-expanded={open()}
    >
      <p class="group/row relative flex items-baseline gap-2 border-b border-rule px-2 py-1 font-mono text-caption">
        <Grip has={true} carry={carry} />
        <Tip text={props.diff.path}>
          <span class="ml-4 min-w-0 flex-1 truncate text-muted">
            {props.diff.path}
          </span>
        </Tip>
        <Show when={computed().created}>
          <span class="shrink-0 text-done">New</span>
        </Show>
        <Show when={computed().kind === "replaced"}>
          <span class="shrink-0 text-muted" data-testid={TESTID.chatDiffWholesale}>
            Rewritten whole
          </span>
        </Show>
        <Show when={computed().added > 0}>
          <span class="shrink-0 text-done">+{computed().added}</span>
        </Show>
        <Show when={computed().removed > 0}>
          <span class="shrink-0 text-alarm">−{computed().removed}</span>
        </Show>
      </p>

      <div class="min-w-0 font-mono text-caption leading-5">
        <For each={shown()}>
          {(line) => (
            <div
              class={`grid min-w-0 grid-cols-[2rem_0.75rem_minmax(0,1fr)] items-start ${LOOK[line.kind].row}`}
              data-testid={TESTID.chatDiffLine}
              data-kind={line.kind}
            >
              <span
                class="select-none pr-2 text-right text-muted/80"
                aria-hidden="true"
                data-testid={TESTID.chatDiffGutter}
              >
                {line.kind === "gap" ? "" : line.after ?? line.before}
              </span>
              <Show
                when={line.kind !== "gap"}
                fallback={
                  <span class="col-span-2 min-w-0 text-muted/80">⋯ {line.hidden} unchanged</span>
                }
              >
                <span
                  class={`select-none pr-1 ${LOOK[line.kind].tone}`}
                  data-testid={TESTID.chatDiffMark}
                >
                  {LOOK[line.kind].mark}
                </span>
                <span
                  class="min-w-0 whitespace-pre-wrap wrap-anywhere text-ink"
                  data-testid={TESTID.chatDiffText}
                >
                  {line.text}
                </span>
              </Show>
            </div>
          )}
        </For>
      </div>

      <Show when={more() > 0}>
        <button
          type="button"
          class="w-full border-t border-rule px-2 py-1 text-left font-mono text-caption text-muted hover:text-ink"
          data-testid={TESTID.chatDiffExpand}
          aria-expanded={open()}
          onClick={() => toggleFold(props.id)}
        >
          {open() ? "Show less" : `+${more()} more lines`}
        </button>
      </Show>
    </div>
  )
}
