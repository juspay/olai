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
import { CloseAgent } from "./CloseAgent.tsx"
import { AgentAbove } from "./AgentAbove.tsx"
import { FreshStart } from "./FreshStart.tsx"
import type { Chat } from "../chat/state.ts"
import { TESTID } from "../../testids.ts"
import { dock } from "../dock.ts"
import { LINE_VERB } from "./verb.ts"

export function AgentLine(props: { readonly chat: Chat; readonly node: string; readonly page?: boolean; readonly dock?: boolean }) {
  const agents = useAgents()
  const state = () => props.chat.state()
  const doing = () => busyIn(state())
  /** The seat's door, offered where there is a seat and this is not already
   *  it: a desktop with the dock component standing (`../dock.ts`). */
  const dockable = () => props.dock !== true && (dock()?.desktop() ?? false)
  return <div class="relative flex flex-wrap items-center gap-2 border-b border-rule bg-desk/50 px-3 py-1.5 text-label text-muted" classList={{ "rounded-t-surface": !props.page && !props.dock }}>
    <Show when={agentIn(state())}>{agent => <span class="inline-flex items-center gap-1" data-testid={TESTID.chatAgent} data-agent={agent().id}>
      <AgentMark id={agent().id} />{agent().name}
    </span>}</Show>
    <Show when={state().model || state().settings.length > 0} fallback={<Show when={doing() === null || doing()?.kind === "starting"}><span>{doing()?.kind === "starting" ? "Starting…" : state().status === "off" ? "Not set up" : state().status === "gone" ? "Not running" : "Ready"}</span></Show>}><Model chat={props.chat} name={state().model ?? "Settings"} /></Show>
    <Show when={usageOf(state().usage)}>{usage => <span data-testid={TESTID.chatUsage} title="Context used">{usage()}</span>}</Show>
    <Show when={doing()?.kind === "working" || doing()?.kind === "waiting"}>
      <span class="flex items-center gap-1 text-doing" data-testid={TESTID.chatWorking} aria-live="polite"><span class={LIVE_DOT} aria-hidden="true" />{doing()?.kind === "waiting" ? "Waiting on you" : "Working…"}</span>
    </Show>
    <span class="flex-1" />
    <AgentAbove node={props.node} />
    <Show when={dockable()}>
      <button type="button" class={LINE_VERB} data-testid={TESTID.chatDockHere} title="Keep this conversation beside the page (⌘J shows or hides the panel)"
        onClick={() => dock()?.open(props.node)}>Open in panel ›</button>
    </Show>
    <Show when={!props.page}><Link route={atNode(props.node)} class={LINE_VERB}>Show in outline ›</Link></Show>
    <Show when={agents.at(props.node)}>
      {agent => <>
        <FreshStart agent={agent()} page={props.page} />
        <CloseAgent node={props.node} />
      </>}
    </Show>
  </div>
}
