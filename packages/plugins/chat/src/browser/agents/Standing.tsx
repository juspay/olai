import { createSignal, lazy, Show } from "solid-js"
import { OFFER_REVEAL } from "@olai/ui-primitives/touch.ts"
import { QUIET_PILL } from "@olai/web/client/pill.ts"
import { DOT } from "@olai/web/client/readout.ts"
import { agoOf } from "@olai/web/client/ago.ts"
import { createTicking, MINUTE } from "@olai/web/client/clock.ts"
import { runAsync } from "@olai/web/client/run.ts"
import { createSaying } from "@olai/web/client/saying.ts"
import { SaidLine } from "@olai/web/client/SaidLine.tsx"
import { Tip } from "@olai/web/client/Tip.tsx"
import { AgentMark } from "../chat/AgentMark.tsx"
import { createNow, outFor } from "../chat/elapsed.ts"
import { chatWire } from "../wire.ts"
import { TESTID } from "../../testids.ts"
import { useAgents } from "./answered.tsx"
import { LOOK, talking, type Row } from "./roster.ts"
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
  return <>
    <Show when={roster.at(props.node)} fallback={
      <Show when={roster.engines().length > 0}>
        <button type="button" class={`${QUIET_PILL} ${OFFER_REVEAL} gap-1 border-dashed whitespace-nowrap`}
          data-testid={TESTID.agentStart} data-agent={props.node} disabled={starting()}
          onClick={event => {
            event.stopPropagation()
            const only = roster.only()
            if (only !== null) void start(only.id)
            else setMenu(event.currentTarget)
          }}><AgentMark id={roster.engines()[0]?.id ?? ""} />Start an agent</button>
      </Show>
    }>{agent => <AgentStanding row={agent()} fold={props.record ?? props.node} />}</Show>
    <Show when={menu()}>{anchor => <EngineMenu anchor={anchor()} engines={roster.standings()}
      close={() => setMenu(null)} pick={agent => void start(agent)} />}</Show>
    <Show when={saying.said()}>{said => <SaidLine said={said()} testid={TESTID.agentRefused} class="text-label" />}</Show>
  </>
}

export function StandingWords(props: { readonly row: Row }) {
  const busy = () => props.row.standing === "working" || props.row.standing === "waking"
  const now = createNow(busy)
  const age = createTicking(MINUTE, () => props.row.standing === "asleep")
  const look = () => LOOK[props.row.standing]
  return <>
    <AgentMark id={props.row.engine} /><span class={`${DOT} ${look().dot}`} aria-hidden="true" />
    {look().label}
    <Show when={busy() && props.row.since}>{since => <span class="tabular-nums"> · {outFor(since(), now())}</span>}</Show>
    <Show when={props.row.standing === "asleep" && props.row.said}>{said => <span class="tabular-nums"> · {agoOf(said().at, age())}</span>}</Show>
    <span class="sr-only"> — {look().detail}</span>
  </>
}

export function AgentStanding(props: { readonly row: Row; readonly fold: string }) {
  const look = () => LOOK[props.row.standing]
  return <Tip text={look().detail}>
    <button type="button" class="inline-flex items-center gap-1 whitespace-nowrap rounded-control px-1.5 text-caption text-muted enabled:hover:bg-ink/5 enabled:hover:text-ink"
      classList={{ "text-doing": props.row.standing === "needs-you" }}
      disabled={!talking(props.row)}
      data-testid={TESTID.agentStanding} data-agent={props.row.id} data-standing={props.row.standing}
      aria-expanded={talking(props.row) ? unfolded(props.fold) : undefined}
      onClick={event => { event.stopPropagation(); unfolded(props.fold) ? fold(props.fold) : unfold(props.fold) }}>
      <StandingWords row={props.row} />
    </button>
  </Tip>
}
