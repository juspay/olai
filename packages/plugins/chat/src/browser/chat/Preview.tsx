import { For, Show } from "solid-js"

import type { ChatEntry } from "olai-plugin-chat/wire"
import { TESTID } from "../../testids.ts"
import type { Lane } from "./lanes.ts"
import { useConversationUI } from "./ui.tsx"
import { railOf } from "./rail.ts"
import { Row } from "./Row.tsx"
import { sentOf, whoOf } from "./spawn.ts"
import type { Chat } from "./state.ts"

export function Preview(props: { readonly chat: Chat; readonly page?: boolean }) {
  const { previewing } = useConversationUI().previewing
  const of = () => {
    const row = previewing()
    if (row === null) return null
    const entry = props.chat.entry(row)()
    return entry === undefined || whoOf(entry) === null ? null : { row, entry }
  }
  return (
    <Show when={of()}>{(open) => <Shelf chat={props.chat} open={open()} page={props.page} />}</Show>
  )
}

function Shelf(props: {
  readonly chat: Chat
  readonly page?: boolean
  readonly open: { readonly row: string; readonly entry: ChatEntry }
}) {
  const { closePreview, previewing, togglePreview } = useConversationUI().previewing
  const calls = () => props.chat.lanes().get(props.open.row) ?? EMPTY
  const lane = (): Lane => ({ parent: props.open.row, label: null })
  const asked = () => props.chat.state().asking > 0
  const parent = () => {
    const row = props.open.entry
    if (row.kind !== "tool" || row.parent === undefined) return null
    const name = sentOf(props.chat.entry(row.parent)())
    return name === null ? null : { row: row.parent, name }
  }
  return (
    <section
      class="flex min-h-0 flex-col border-b border-rule/60 bg-panel"
      classList={{ "max-h-96 shrink": !props.page }}
      data-testid={TESTID.chatPreview}
      data-row={props.open.row}
      aria-label="Agent's work"
    >
      <Show when={asked()}>
        <button
          type="button"
          class="flex w-full shrink-0 items-center gap-1.5 border-b border-rule/60 bg-alarm/10 px-3 py-1.5 text-left text-caption leading-snug text-alarm hover:bg-alarm/20 focus-visible:outline focus-visible:outline-1 focus-visible:-outline-offset-2 focus-visible:outline-accent"
          data-testid={TESTID.chatPreviewAsked}
          onClick={() => {
            closePreview()
            props.chat.ui.reveal[1](true)
          }}
        >
          <span aria-hidden="true">◆</span>
          <span class="min-w-0 flex-1 truncate">A question is waiting on you</span>
          <span class="shrink-0 opacity-70">Show me</span>
        </button>
      </Show>
      <Show when={parent()}>{(above) => (
        <button type="button" class="px-3 pt-1 text-left text-label text-muted hover:text-ink"
          aria-label={`Back to ${above().name}`} onClick={() => togglePreview(above().row)}>
          ← {above().name}
        </button>
      )}</Show>
      <p
        class="flex min-w-0 shrink-0 items-baseline gap-1 px-3 py-1.5 text-caption leading-snug text-ink"
        data-testid={TESTID.chatPreviewOf}
        data-spawn-kind={whoOf(props.open.entry) ?? undefined}
      >
        <span aria-hidden="true">↳</span>
        <span class="sr-only">the work of&#32;</span>
        <span class="min-w-0 truncate">{sentOf(props.open.entry)}</span>
      </p>
      <div class="min-h-0 px-3 pb-2 text-ink"
        classList={{ "olai-scroll flex-1 overflow-x-hidden overflow-y-auto": !props.page }}>
        <Show
          when={calls().length > 0}
          fallback={
            <p class="py-1 text-caption text-muted" data-testid={TESTID.chatPreviewNothing}>
              Nothing yet
            </p>
          }
        >
          <For each={calls()}>
            {(key) => {
              const entry = props.chat.entry(key)
              return (
                <Show when={entry()}>
                  {(row) => (
                    <Row
                      entry={row()}
                      chat={props.chat}
                      lane={lane()}
                      rail={railOf(entry())}
                      speaker={null}
                    />
                  )}
                </Show>
              )
            }}
          </For>
        </Show>
      </div>
    </section>
  )
}

const EMPTY: ReadonlyArray<string> = []
