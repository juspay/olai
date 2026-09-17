import { createEffect, createSignal, onCleanup } from "solid-js"
import { documentBox } from "@olai/web/client/carry.ts"
import { carriedNodes } from "olai-plugin-outlines/carry"
import { carriedText } from "../../carry.ts"
import { carriedPath } from "olai-plugin-files/carry"
import { landings } from "../landings.ts"
import { quoted, type Insertion } from "../chat/insertion.ts"
import { inserted } from "../chat/completion.ts"
import { LAYER } from "@olai/web/client/layer.ts"
import { CLEARANCE } from "olai-plugin-layout/clearance"
import { ConversationUIProvider } from "../chat/ui.tsx"
import { Show } from "solid-js"
import { createNodeConversation } from "./conversation.ts"
import { useAgents } from "./answered.tsx"
import { unfolded } from "./folding.ts"
import { type Chat } from "../chat/state.ts"
import { TESTID } from "../../testids.ts"
import { History } from "./History.tsx"
import { AgentLine } from "./AgentLine.tsx"
import { Plan } from "../chat/Plan.tsx"
import { Roster } from "../chat/Roster.tsx"
import { Watching } from "../chat/Watching.tsx"
import { Wake } from "../chat/Wake.tsx"
import { Transcript } from "../chat/Transcript.tsx"
import { Preview } from "../chat/Preview.tsx"
import { Busy } from "../chat/Busy.tsx"
import { Composer } from "../chat/Composer.tsx"
import { DropTarget } from "../chat/DropTarget.tsx"
import { createHolding } from "../chat/holding.ts"
import { ElapsedProvider } from "../chat/elapsing.tsx"
import { Unopened } from "../chat/Unopened.tsx"

export function Fold(props: { readonly node: string; readonly record?: string }) {
  const agents = useAgents()
  return <Show when={unfolded(props.record ?? props.node)}>{_open => {
    const { chat: conversation } = createNodeConversation(() => props.node)
    return <Show when={conversation()} keyed>{chat =>
    <ConversationUIProvider value={chat.ui}><section class="my-2 rounded border border-rule bg-panel" data-testid={TESTID.agentFold} data-agent={props.node} aria-label={agents.at(props.node)?.title}>
      <AgentLine chat={chat} node={props.node} />
      <Conversation chat={chat} node={props.node} />
    </section></ConversationUIProvider>
    }</Show>
  }}</Show>
}

export function Conversation(props: { readonly chat: Chat; readonly unbounded?: boolean; readonly node: string }) {
  let box: HTMLDivElement | undefined
  let insert: ((text: Insertion) => void) | undefined
  const [carrying, setCarrying] = createSignal<string | null>(null)
  createEffect(() => {
    const table = landings()
    if (!table) return
    onCleanup(table.register({
      lift: value => props.chat.state().unopened || !(carriedNodes(value) || carriedText(value) || carriedPath(value)) ? null : documentBox(box),
      aim: value => setCarrying(carriedNodes(value) ? `drop to ask about ${value.ids.length === 1 ? "it" : "them"}` : carriedText(value) ? "drop to quote it" : "drop to name it"),
      leave: () => setCarrying(null),
      drop: async value => {
        if (props.chat.state().unopened || !documentBox(box)) return null
        if (carriedNodes(value)) for (const id of value.ids) props.chat.ui.armed.armNode(id)
        else if (carriedText(value)) insert?.(before => quoted(value.text, before))
        else if (carriedPath(value)) insert?.(inserted(value.path))
        return null
      },
    }))
  })
  const holding = createHolding(props.chat)
  const live = () => props.chat.state().status === "thinking" || props.chat.state().watching.length > 0
  return <div class="flex min-h-0 flex-col" data-testid={TESTID.chatPanel}
    data-session-id={props.chat.state().session?.id} data-session-title={props.chat.state().session?.title ?? undefined} data-status={props.chat.state().status} data-pending-sends={props.chat.pendingSends()}>
    <ElapsedProvider live={live()}>
      <Plan chat={props.chat} /><Roster chat={props.chat} /><Watching chat={props.chat} /><Wake chat={props.chat} />
      <History chat={props.chat} node={props.node} />
      <Show when={props.chat.state().unopened} fallback={<DropTarget ref={element => { box = element }} carrying={carrying()} onFiles={files => void holding.take(files)}>
        <Preview chat={props.chat} unbounded={props.unbounded} /><Transcript chat={props.chat} unbounded={props.unbounded} />
        <div class={props.unbounded ? `sticky bottom-0 ${LAYER.row} bg-paper ${CLEARANCE}` : "contents"}>
          <Busy chat={props.chat} /><Composer chat={props.chat} holding={holding} onInsert={write => { insert = write; return () => { if (insert === write) insert = undefined } }} />
        </div>
      </DropTarget>}>{unopened => <Unopened chat={props.chat} unopened={unopened()} />}</Show>
    </ElapsedProvider>
  </div>
}
