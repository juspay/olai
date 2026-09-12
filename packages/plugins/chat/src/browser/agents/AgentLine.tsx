import { useAgents } from "./answered.tsx"
import { Show } from "solid-js"
import { agentIn } from "olai-plugin-chat/wire"
import { Link } from "olai-plugin-navigation/routing"
import { atNode } from "olai-plugin-navigation/routes"
import { AgentMark } from "../chat/AgentMark.tsx"
import { Model } from "../chat/Model.tsx"
import { usageOf } from "../chat/usage.ts"
import { LIVE_DOT } from "../chat/live.ts"
import { busyIn } from "../chat/busy.ts"
import { NodeSessions } from "../chat/NodeSessions.tsx"
import type { Chat } from "../chat/state.ts"
import { TESTID } from "../../testids.ts"

export function AgentLine(props: { readonly chat: Chat; readonly node: string; readonly page?: boolean }) {
  const agents = useAgents()
  const state = props.chat.state
  const doing = () => busyIn(state())
  return <div class="relative flex flex-wrap items-center gap-2 border-b border-rule px-3 py-2 text-xs text-muted">
    <Show when={agentIn(state())}>{agent => <span class="inline-flex items-center gap-1" data-testid={TESTID.chatAgent} data-agent={agent().id}>
      <AgentMark id={agent().id} />{agent().name}
    </span>}</Show>
    <Show when={state().model || state().settings.length > 0} fallback={<Show when={doing() === null || doing()?.kind === "starting"}><span>{doing()?.kind === "starting" ? "starting…" : state().status === "off" ? "not configured" : state().status === "gone" ? "not running" : "ready"}</span></Show>}><Model chat={props.chat} name={state().model ?? "settings"} /></Show>
    <Show when={usageOf(state().usage)}>{usage => <span data-testid={TESTID.chatUsage} title="context used / context window">{usage()}</span>}</Show>
    <Show when={doing()?.kind === "working" || doing()?.kind === "waiting"}>
      <span class="flex items-center gap-1 text-doing" data-testid={TESTID.chatWorking} aria-live="polite"><span class={LIVE_DOT} aria-hidden="true" />{doing()?.kind === "waiting" ? "waiting on you" : "working…"}</span>
    </Show>
    <span class="flex-1" />
    <Show when={!props.page}><Link route={atNode(props.node)}>open the page ›</Link></Show>
    <Show when={agents.at(props.node)}>{agent => <NodeSessions chat={props.chat} agent={agent()} />}</Show>
  </div>
}
