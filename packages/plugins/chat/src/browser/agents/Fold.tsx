import { CLEARANCE } from "olai-plugin-layout/clearance"
import { ConversationUIProvider } from "../chat/ui.tsx"
import { createAsked } from "../chat/attention/asked.ts"
import { createEffect, createMemo, Show } from "solid-js"
import { agentReadings, readAgent } from "./reading.ts"
import { useAgents } from "./answered.tsx"
import { unfolded } from "./folding.ts"
import { createChat, type Chat } from "../chat/state.ts"
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

export function Fold(props: { readonly node: string }) {
  const agents = useAgents()
  const conversation = createMemo(() => {
    const agent = agents.at(props.node)
    return agent?.session == null ? null : agentReadings()?.visiting(props.node) ?? { agent: agent.engine, session: agent.session }
  }, null, { equals: (a, b) => a?.agent === b?.agent && a?.session === b?.session })
  return <Show when={unfolded(props.node)}><Show when={conversation()} keyed>{conv => {
    const chat = createChat(conv, { ui: agentReadings()?.ui(conv), visit: to => agentReadings()?.visit(props.node, to) })
    readAgent(props.node, chat)
    const question = createAsked(chat)
    createEffect(() => chat.ui.question[1](question()))
    return <ConversationUIProvider value={chat.ui}><section class="my-2 rounded border border-rule bg-panel" data-testid={TESTID.agentFold} data-agent={props.node} aria-label={agents.at(props.node)?.title}>
      <AgentLine chat={chat} node={props.node} />
      <Conversation chat={chat} node={props.node} />
    </section></ConversationUIProvider>
  }}</Show></Show>
}

export function Conversation(props: { readonly chat: Chat; readonly unbounded?: boolean; readonly node: string }) {
  const holding = createHolding(props.chat)
  const live = () => props.chat.state().status === "thinking" || props.chat.state().watching.length > 0
  return <div class="flex min-h-0 flex-col" data-testid={TESTID.chatPanel}
    data-session-id={props.chat.state().session?.id} data-session-title={props.chat.state().session?.title ?? undefined} data-status={props.chat.state().status} data-pending-sends={props.chat.pendingSends()}>
    <ElapsedProvider live={live()}>
      <Plan chat={props.chat} /><Roster chat={props.chat} /><Watching chat={props.chat} /><Wake chat={props.chat} />
      <History chat={props.chat} node={props.node} />
      <Show when={props.chat.state().unopened} fallback={<DropTarget onFiles={files => void holding.take(files)}>
        <Preview chat={props.chat} /><Transcript chat={props.chat} unbounded={props.unbounded} />
        <div class={props.unbounded ? `sticky bottom-0 z-10 bg-paper ${CLEARANCE}` : "contents"}>
          <Busy chat={props.chat} /><Composer chat={props.chat} holding={holding} />
        </div>
      </DropTarget>}>{unopened => <Unopened chat={props.chat} unopened={unopened()} />}</Show>
    </ElapsedProvider>
  </div>
}
