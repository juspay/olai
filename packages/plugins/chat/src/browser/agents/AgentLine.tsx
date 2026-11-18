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
import { Identity } from "./Identity.tsx"
import { AgentAbove } from "./AgentAbove.tsx"
import { FreshStart } from "./FreshStart.tsx"
import type { Chat } from "../chat/state.ts"
import { TESTID } from "../../testids.ts"
import { Tip } from "@olai/web/client/Tip.tsx"
import { LINE_VERB } from "./verb.ts"
import { type AgentItem, itemOf } from "@olai/format"
import { ChatBeside } from "./ChatBeside.tsx"

export function AgentLine(props: { readonly chat: Chat; readonly node: string; readonly page?: boolean; readonly beside?: AgentItem }) {
  const agents = useAgents()
  const state = () => props.chat.state()
  const doing = () => busyIn(state())
  return <div class="relative flex flex-wrap items-center gap-2 border-b border-rule bg-desk/50 px-3 py-1.5 text-label text-muted" classList={{ "rounded-t-surface": !props.page }}>
    <Show when={agentIn(state())}>{agent => <span class="inline-flex items-center gap-1" data-testid={TESTID.chatAgent} data-agent={agent().id}>
      <AgentMark id={agent().id} />{agent().name}
    </span>}</Show>
    {/* WHO, after the agent's name — and only for an agent that says
        (`../chat/identityChip.ts` has both rules). Pressable exactly where the
        handshake offered a way in AND no sign-in row is already on screen:
        `signIn(null)` replaces that row with a chooser, which would hide a
        terminal login quietly waiting for its code. `/login` has the same hole
        and the chip is one click from the row, so the chip does not add one. */}
    <Show when={state().identity}>{identity => <Identity
      chat={props.chat}
      identity={identity}
      pressable={(agentIn(state())?.methods.length ?? 0) > 0 && state().signIn === null}
    />}</Show>
    <Show when={state().model || state().settings.length > 0} fallback={<Show when={doing() === null || doing()?.kind === "starting"}><span>{doing()?.kind === "starting" ? "Starting…" : state().status === "off" ? "Not set up" : state().status === "gone" ? "Not running" : "Ready"}</span></Show>}><Model chat={props.chat} name={state().model ?? "Settings"} /></Show>
    {/* WHAT THE NUMBER IS. The percentage alone names nothing, so the words
        ride an sr-only companion AFTER the chip — outside it, because a
        scenario reads the chip's own text — and the tip is the pointer's
        half of the same sentence. */}
    <Show when={usageOf(state().usage)}>{usage => <Tip text="Context used" say>
      <span data-testid={TESTID.chatUsage}>{usage()}</span>
    </Tip>}</Show>
    <Show when={doing()?.kind === "working" || doing()?.kind === "waiting"}>
      <span class="flex items-center gap-1 text-doing" data-testid={TESTID.chatWorking} aria-live="polite"><span class={LIVE_DOT} aria-hidden="true" />{doing()?.kind === "waiting" ? "Waiting on you" : "Working…"}</span>
    </Show>
    <span class="flex-1" />
    <AgentAbove node={props.node} />
    {/* THIS CONVERSATION, BESIDE WHAT IT IS ABOUT — offered on every line
        drawn where the item itself is (a fold, a node's page, the line at the
        top of a note), and never on the chat's own page, whose head carries
        the opposite verb (`./ChatPage.tsx`'s pinned line, which is where the
        way back has to be: this line scrolls away with the conversation).
        `beside` is how that page says the line is its own.

        DRAWN ONLY WHERE THERE CAN BE A PANE BESIDE THIS ONE. Below `md` the
        panes are a strip of tabs, one at a time, so "beside" names nothing a
        reader would see — and this line is drawn inside a fold on the
        narrowest screen there is, where one more wrapped row of verbs pushes
        the rows under it off the bottom of the window (a phone is 844 tall,
        and the row under an open fold sat at 845). The one-line *Shown
        beside* is NOT gated: wherever a conversation has gone, the way back
        to it is drawn. */}
    <Show when={props.beside === undefined}>
      <ChatBeside item={itemOf(props.node)} class={`hidden md:inline-flex ${LINE_VERB}`} />
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
