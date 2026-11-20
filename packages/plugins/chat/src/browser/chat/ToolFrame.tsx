import { Dynamic } from "solid-js/web"
import { servedDirectory } from "../vault.ts"
import { Terminals } from "./Terminals.tsx"
import { fileKind } from "@olai/format"
import type { ToolEntry } from "olai-plugin-chat/wire"
import type { ToolStatus } from "@kolu/acp/wire"
import { Key } from "@solid-primitives/keyed"
import { createMemo, Show } from "solid-js"

import { TESTID } from "../../testids.ts"
import { Tip } from "@olai/web/client/Tip.tsx"
import { Markdown } from "@olai/markdown-ui/Markdown.tsx"
import { armedOf, endedOf, watchOf } from "./background.ts"
import { Diff } from "./Diff.tsx"
import { diffBlocks } from "./folds.ts"
import { useConversationUI } from "./ui.tsx"
import { OutlineDiff } from "./OutlineDiff.tsx"
import { useElapsed } from "./elapsing.tsx"
import { whoOf } from "./spawn.ts"
import { faceOf } from "../marks.ts"

const LOOK: Record<ToolStatus, { mark: string; tone: string; said: string }> = {
  pending: { mark: "·", tone: "text-muted", said: "Pending" },
  in_progress: { mark: "…", tone: "text-doing", said: "In progress" },
  completed: { mark: "✓", tone: "text-done", said: "Completed" },
  failed: { mark: "✗", tone: "text-alarm", said: "Failed" },
}

const FOLD_BLOCK =
  "m-0 max-h-64 overflow-auto whitespace-pre-wrap break-words border-t border-rule px-2 py-1 font-mono text-caption text-muted"

function Saying(props: { readonly said: string; readonly tall: boolean }) {
  return (
    <pre
      class="m-0 overflow-auto whitespace-pre-wrap border-t border-rule px-2 py-1 font-mono text-caption text-ink"
      classList={{ "max-h-64": props.tall, "max-h-32": !props.tall }}
      data-testid={TESTID.chatToolProgress}
    >{props.said}</pre>
  )
}

export function ToolFrame(props: { readonly entry: ToolEntry }) {
  const { isUnfolded, toggleFold } = useConversationUI().folds
  const replyFace = createMemo(() => faceOf(props.entry.row))
  const replyFile = createMemo(() => {
    const reply = props.entry.reply
    return reply === undefined ? null : replyFace()?.fileOf(reply) ?? null
  })
  const elapsed = useElapsed()
  const open = () => isUnfolded(props.entry.id)
  const status = () => props.entry.status
  const look = () => LOOK[status()]
  const blocks = createMemo(() => diffBlocks(props.entry.id, props.entry.diffs))
  const ended = () => endedOf(props.entry) !== null
  const body = () =>
    props.entry.reply !== undefined
    || props.entry.detail !== undefined
    || (!ended() && props.entry.reply === undefined && props.entry.progress !== undefined)
    || Boolean(armedOf(props.entry)?.report)

  return (
    <div
      class="min-w-0 rounded-control border border-rule bg-desk/40"
      data-testid={TESTID.chatTool}
      data-tool-status={status()}
      data-tool-id={props.entry.id}
      data-unfolded={open()}
    >
      <button
        type="button"
        class="flex w-full items-center gap-2 px-2 py-1 text-left font-mono text-label text-muted hover:text-ink"
        data-testid={TESTID.chatToolFold}
        aria-expanded={open()}
        disabled={!body()}
        onClick={() => toggleFold(props.entry.id)}
      >
        <span class={look().tone} aria-hidden="true">
          {look().mark}
        </span>
        <span class="sr-only">{look().said}</span>
        <Tip text={props.entry.called ?? ""} disabled={!props.entry.called || props.entry.called === props.entry.text}>
          <span class="min-w-0 flex-1 truncate" data-testid={TESTID.chatToolText}>{props.entry.text}</span>
          <Show when={props.entry.called && props.entry.called !== props.entry.text ? props.entry.called : undefined}>
            {(called) => <span class="sr-only">{called()}</span>}
          </Show>
        </Tip>
        <Show when={whoOf(props.entry)}>
          {(who) => (
            <span
              class="flex min-w-0 shrink-0 items-center gap-1 text-muted/80"
              data-testid={TESTID.chatSpawn}
              data-spawn-kind={who()}
            >
              <span aria-hidden="true">↳</span>
              <span class="sr-only">sent out&#32;</span>
              <span class="min-w-0 truncate">{who()}</span>
            </span>
          )}
        </Show>
        <Show when={armedOf(props.entry)}>
          {(armed) => (
            <>
              <Show when={watchOf(props.entry)}>
                {(watching) => (
                  <span
                    class="flex min-w-0 shrink items-center gap-1 text-muted/80"
                    data-testid={TESTID.chatArmed}
                    data-task={armed().task}
                  >
                    <span aria-hidden="true">◷</span>
                    <span class="sr-only">watching&#32;</span>
                    <span class="min-w-0 truncate">{watching()}</span>
                  </span>
                )}
              </Show>
              <Show when={endedOf(props.entry)}>
                {(ended) => (
                  <span
                    class="shrink-0 text-muted"
                    data-testid={TESTID.chatArmedEnded}
                    data-ended={ended()}
                  >
                    <span aria-hidden="true">·&#32;</span>
                    <span class="sr-only">ended&#32;</span>
                    {ended()}
                  </span>
                )}
              </Show>
            </>
          )}
        </Show>
        <Show when={props.entry.locations}>
          {(locations) => (
            <Tip text={locations().join("\n")}>
              <span
                class="min-w-0 max-w-[45%] shrink truncate text-muted/80"
                data-testid={TESTID.chatToolLocations}
              >
                {locations().join(" ")}
              </span>
            </Tip>
          )}
        </Show>
        <Show when={replyFile()}>{file => <span class="min-w-0 max-w-[45%] shrink truncate text-muted/80" data-testid={TESTID.chatToolFile}>{file()}</span>}</Show>
        <Show when={elapsed(props.entry)}>
          {(said) => (
            <span class="shrink-0 text-doing">
              <span aria-hidden="true">·&#32;</span>
              <span class="sr-only">running for&#32;</span>
              <span data-testid={TESTID.chatToolElapsed}>{said()}</span>
            </span>
          )}
        </Show>
        <Show when={body()}>
          <span aria-hidden="true">{open() ? "▾" : "▸"}</span>
        </Show>
      </button>

      <Show when={props.entry.reply !== undefined}><Dynamic component={replyFace()?.story} reply={props.entry.reply!} /></Show>
      <Show when={ended() && props.entry.reply === undefined && props.entry.progress}>
        {(said) => <Saying said={said()} tall={false} />}
      </Show>
      <Key each={blocks()} by="key">
        {(block) => (
          <Show
            when={servedDirectory()?.claims().byKind.get(servedDirectory()?.kindOf(block().diff.path) ?? "")?.holds === "nodes"}
            fallback={<Diff id={block().key} diff={block().diff} />}
          >
            <OutlineDiff id={block().key} diff={block().diff} />
          </Show>
        )}
      </Key>

      <Terminals entries={props.entry.terminals ?? []} />
      <Show when={open()}>
        <Show when={!ended() && props.entry.reply === undefined && props.entry.progress}>
          {(progress) => <Saying said={progress()} tall={true} />}
        </Show>
        <Show when={armedOf(props.entry)?.report}>
          {(report) => (
            <Markdown
            claims={servedDirectory()?.claims()}
              source={report()}
              from=""
              class="olai-md-compact border-t border-rule px-2 py-1 text-body"
              testid={TESTID.chatToolReport}
            />
          )}
        </Show>
        <Show when={props.entry.row && props.entry.called}>
          {called => <p class="m-0 border-t border-rule px-2 py-1 font-mono text-label text-muted" data-testid={TESTID.chatToolCalled}>{called()}</p>}
        </Show>
        <Show when={props.entry.detail}>
          {(detail) => (
            <pre class={FOLD_BLOCK} data-testid={TESTID.chatToolDetail}>{detail()}</pre>
          )}
        </Show>
        <Show when={props.entry.row !== undefined && props.entry.reply !== undefined}>
          <pre class={FOLD_BLOCK} data-testid={TESTID.chatToolReply}>{JSON.stringify(props.entry.reply, null, 2)}</pre>
        </Show>
      </Show>
    </div>
  )
}
