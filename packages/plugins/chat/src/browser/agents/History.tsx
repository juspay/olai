import { createMemo, For, Show } from "solid-js"
import { createInlinePicker } from "@olai/web/client/inlinePicker.ts"
import { WITHIN } from "@olai/web/client/layer.ts"
import { Conversation } from "../chat/Conversation.tsx"
import type { Chat } from "../chat/state.ts"
import { whenOf } from "../chat/when.ts"
import { agentReadings } from "./reading.ts"
import { useAgents } from "./answered.tsx"
import { pastOf, successorIn } from "../../lineage.ts"
import { TESTID } from "../../testids.ts"

/** The conversation's fold line owns its picker; selecting a past pair changes
 * the reader, never the node's current binding. */
export function History(props: { readonly chat: Chat; readonly node: string }) {
  const agents = useAgents()
  const agent = () => agents.at(props.node)
  const picker = createInlinePicker<true>({ opening: () => { agents.askChats(); return true } })
  const past = createMemo(() => {
    const row = agent()
    return row?.session == null ? [] : pastOf(agents.chats()?.sessions ?? [], row.engine, row.session)
  })
  const visiting = () => agentReadings()?.visiting(props.node)
  const isPast = () => visiting() !== undefined && (visiting()?.agent !== agent()?.engine || visiting()?.session !== agent()?.session)
  const opened = () => agents.chats()?.sessions.find(one => one.agent === (visiting()?.agent ?? agent()?.engine) && one.id === (visiting()?.session ?? agent()?.session))
  const count = () => past().every(one => one.messageCount !== null) ? past().reduce((sum, one) => sum + (one.messageCount ?? 0), 0) : null
  return <div class="relative flex flex-wrap items-center gap-2 border-b border-rule px-3 py-2 text-xs text-muted">
    <span class="italic">conversation</span><span class="h-px min-w-2 flex-1 bg-rule" />
    <button type="button" ref={picker.setTrigger} class="font-mono hover:text-ink"
      data-testid={TESTID.chatSessions} data-count={past().length + 1} aria-expanded={picker.open()} onClick={picker.toggle}>
      <Show when={isPast()} fallback={<>
        <Show when={whenOf(props.chat.state().session?.updatedAt ?? null)}>{date => <>last {date()} · </>}</Show>
        <Show when={count() !== null} fallback={<>past sessions ↑</>}>{count()} messages above the fresh start ↑</Show>
      </>}>
        past session<Show when={whenOf(opened()?.updatedAt ?? null)}>{date => <> · {date()}</>}</Show>
      </Show>
    </button>
    <Show when={isPast() && agent()?.session}>{session =>
      <button type="button" class="font-mono hover:text-ink" data-session-id={session()}
        onClick={() => { picker.shut(); const row = agent(); if (row?.session) props.chat.loadSession(row.engine, row.session) }}>current session ↩</button>
    }</Show>
    <Show when={picker.open()}>
      <ul ref={picker.setList} class={`absolute inset-x-3 top-full ${WITHIN.pop} mt-1 max-h-80 list-none overflow-x-hidden overflow-y-auto rounded border border-rule/70 bg-panel p-1 shadow-lg`} data-testid={TESTID.chatSessionList}>
        <li class="px-2 py-1 text-xs text-muted" data-testid={TESTID.chatPastSessions} data-count={past().length}>past sessions ({past().length})</li>
        <For each={past()}>{session => <li><Conversation session={session}
          successor={successorIn(agents.chats()?.sessions ?? [], session)} current={(visiting()?.agent ?? agent()?.engine) === session.agent && (visiting()?.session ?? agent()?.session) === session.id}
          testid={TESTID.chatPastSession} onPick={() => { picker.shut(); props.chat.loadSession(session.agent, session.id) }} /></li>}</For>
      </ul>
    </Show>
  </div>
}
