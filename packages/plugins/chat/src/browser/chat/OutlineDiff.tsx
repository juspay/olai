import { Grip, textCarry } from "./Grip.tsx"
import { servedDirectory } from "../vault.ts"

import type { FileDiff } from "@kolu/acp/wire"
import { createMemo, For, Show } from "solid-js"

import { GLYPH, SAID } from "olai-plugin-outlines/changes"
import { renderTitle } from "@olai/markdown-ui/title.ts"
import { TitleHtml } from "@olai/markdown-ui/TitleHtml.tsx"
import { TESTID } from "../../testids.ts"
import { Tip } from "@olai/web/client/Tip.tsx"
import { useConversationUI } from "./ui.tsx"
import { createOutlineDiff } from "./outline.ts"

const TRIMMED = 6

export function OutlineDiff(props: {
  readonly id: string
  readonly diff: FileDiff
}) {
  const { isUnfolded, toggleFold } = useConversationUI().folds
  const { read, line } = createOutlineDiff(servedDirectory, () => props.diff)
  const changes = createMemo(() => {
    const answer = read()
    return answer?._tag === "Changes" ? answer.changes : []
  })
  const unreadable = createMemo(() => {
    const answer = read()
    return answer?._tag === "Unreadable" ? answer.side : null
  })
  const open = createMemo(() => isUnfolded(props.id))
  const more = () => Math.max(0, changes().length - TRIMMED)
  const shown = createMemo(() => (open() ? changes() : changes().slice(0, TRIMMED)))

  const words = () => changes().length ? [props.diff.path, ...changes().map(change => `${change.title} ${SAID[change.sort]}`)].join("\n") : null
  const carry = textCarry(words)

  return (
    <div
      onPointerDown={carry.touch} onContextMenu={carry.heldMenu}
      class="mt-1 overflow-hidden rounded-control border border-rule"
      data-testid={TESTID.chatOutlineDiff}
      data-path={props.diff.path}
      data-expanded={open()}
    >
      <p class="group/row relative flex items-baseline gap-2 border-b border-rule px-2 py-1 font-mono text-caption">
        <Grip has={changes().length > 0} carry={carry} />
        <Tip text={props.diff.path}>
          <span class="ml-4 min-w-0 flex-1 truncate text-muted">
            {props.diff.path}
          </span>
        </Tip>
        <Show when={props.diff.oldText === null}>
          <span class="shrink-0 text-done">New</span>
        </Show>
      </p>

      <Show when={read() !== undefined} fallback={
        <p class="px-2 py-1 text-label text-muted" data-testid={TESTID.chatOutlineUnreadable}>
          {line()}
        </p>
      }>
      <Show
        when={unreadable() === null}
        fallback={
          <p class="px-2 py-1 text-label text-alarm" data-testid={TESTID.chatOutlineUnreadable}>
            {unreadable() === "after"
              ? "Can't show changes: the new outline doesn't parse"
              : "Can't show changes: the old outline doesn't parse"}
          </p>
        }
      >
        <Show
          when={changes().length > 0}
          fallback={
            <p class="px-2 py-1 text-label text-muted">
              Rewritten, but no rows changed
            </p>
          }
        >
          <ul class="px-2 py-1 text-label">
            <For each={shown()}>
              {(change) => (
                <Tip text={change.fields.join(", ")}>
                  <li
                    class="flex items-baseline gap-2 py-0.5"
                    data-testid={TESTID.chatOutlineChange}
                    data-node-id={change.id}
                    data-sort={change.sort}
                  >
                    <span class="w-3 shrink-0 text-muted" aria-hidden="true">
                      {GLYPH[change.sort]}
                    </span>
                    <span class="min-w-0 truncate text-ink">
                      <TitleHtml drawing={renderTitle(servedDirectory()?.claims(), change.title, change.file)} />
                    </span>
                    <span class="ml-auto shrink-0 text-muted">{SAID[change.sort]}</span>
                    <span class="sr-only">{change.fields.join(", ")}</span>
                  </li>
                </Tip>
              )}
            </For>
          </ul>
        </Show>
      </Show>

      </Show>
      <Show when={more() > 0}>
        <button
          type="button"
          class="w-full border-t border-rule px-2 py-1 text-left font-mono text-caption text-muted hover:text-ink"
          data-testid={TESTID.chatDiffExpand}
          aria-expanded={open()}
          onClick={() => toggleFold(props.id)}
        >
          {open() ? "Show less" : `+${more()} more rows`}
        </button>
      </Show>
    </div>
  )
}
