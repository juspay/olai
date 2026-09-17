import { createSignal, lazy, Show } from "solid-js"
import { HOVER_REVEAL } from "@olai/ui-primitives/touch.ts"
import { QUIET_PILL } from "@olai/web/client/pill.ts"
import { DOT } from "@olai/web/client/readout.ts"
import { agoOf, createNow as createAgeClock } from "@olai/web/client/ago.ts"
import { runAsync } from "@olai/web/client/run.ts"
import { createSaying } from "@olai/web/client/saying.ts"
import { SaidLine } from "@olai/web/client/SaidLine.tsx"
import { AgentMark } from "../chat/AgentMark.tsx"
import { createNow, outFor } from "../chat/elapsed.ts"
import { chatWire } from "../wire.ts"
import { TESTID } from "../../testids.ts"
import { useAgents } from "./answered.tsx"
import { LOOK, type Row } from "./roster.ts"
import { fold, unfold, unfolded } from "./folding.ts"
const EngineMenu = lazy(() => import("./EngineMenu.tsx"))

export function Standing(props: { readonly node: string; readonly record?: string }) {
  const roster = useAgents()
  const saying = createSaying()
  const [starting, setStarting] = createSignal(false)
  const [menu, setMenu] = createSignal<HTMLElement | null>(null)
  const start = async (agent: string) => {
    if (starting()) return
    setMenu(null)
    setStarting(true)
    saying.say(undefined)
    try {
      const result = await runAsync(chatWire().procedures.conversation.startAgentSession({ node: props.node, agent }))
      if (result._tag === "Success") unfold(props.record ?? props.node)
      else saying.say({ tone: "alarm", text: result.failure.message, kind: result.failure._tag })
    } finally { setStarting(false) }
  }
  return <Show when={roster.engines().length > 0}>
    <span class="relative inline-flex items-center gap-1">
      <Show when={roster.at(props.node)} fallback={
        <button type="button" class={`${QUIET_PILL} ${HOVER_REVEAL} inline-flex items-center gap-1 border-dashed whitespace-nowrap`}
          data-testid={TESTID.agentStart} data-agent={props.node} disabled={starting()}
          onClick={event => {
            event.stopPropagation()
            const only = roster.engines()[0]
            if (roster.engines().length === 1 && only !== undefined) void start(only.id)
            else setMenu(event.currentTarget)
          }}><AgentMark id={roster.engines()[0]?.id ?? ""} />start an agent</button>
      }>{agent => <AgentStanding row={agent()} record={props.record} />}</Show>
      <Show when={menu()}>{anchor => <EngineMenu anchor={anchor()} engines={roster.engines()}
        close={() => setMenu(null)} pick={agent => void start(agent)} />}</Show>
      <Show when={saying.said()}>{said => <SaidLine said={said()} testid={TESTID.agentRefused} class="text-xs" />}</Show>
    </span>
  </Show>
}

function AgentStanding(props: { readonly row: Row; readonly record?: string }) {
  const busy = () => props.row.standing === "working" || props.row.standing === "waking"
  const now = createNow(busy)
  const age = createAgeClock()
  const look = () => LOOK[props.row.standing]
  return <button type="button" class="inline-flex items-center gap-1 whitespace-nowrap rounded px-1 text-xs text-muted enabled:hover:bg-rule"
    classList={{ "text-doing": props.row.standing === "needs-you" }}
    disabled={props.row.session === null} title={look().detail}
    data-testid={TESTID.agentStanding} data-agent={props.row.id} data-standing={props.row.standing}
    aria-expanded={props.row.session === null ? undefined : unfolded(props.record ?? props.row.id)}
    onClick={event => { event.stopPropagation(); unfolded(props.record ?? props.row.id) ? fold(props.record ?? props.row.id) : unfold(props.record ?? props.row.id) }}>
    <AgentMark id={props.row.engine} /><span class={`${DOT} ${look().dot}`} aria-hidden="true" />
    {look().label}
    <Show when={busy() && props.row.since}>{since => <span class="font-mono"> · {outFor(since(), now())}</span>}</Show>
    <Show when={props.row.standing === "asleep" && props.row.said}>{said => <span class="font-mono"> · {agoOf(said().at, age())}</span>}</Show>
  </button>
}
