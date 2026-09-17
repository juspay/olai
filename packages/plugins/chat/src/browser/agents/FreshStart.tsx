import { createSignal, lazy, Show } from "solid-js"
import { memoryOf } from "@olai/format"
import { QUIET_PILL } from "@olai/web/client/pill.ts"
import { run } from "@olai/web/client/run.ts"
import { createSaying } from "@olai/web/client/saying.ts"
import { SaidLine } from "@olai/web/client/SaidLine.tsx"

import { chatWire } from "../wire.ts"
import { agentReadings } from "./reading.ts"
import { useAgents } from "./answered.tsx"
import type { Row } from "./roster.ts"
import { LAYER } from "@olai/web/client/layer.ts"
import { TESTID } from "../../testids.ts"

/** The engine menu, loaded on the first press that needs it — the same lazy
 *  door the other two engine pickers use. */
const EngineMenu = lazy(() => import("./EngineMenu.tsx"))

/** The node's fresh-start gesture is independent of which of its sessions the
 *  reader has open. The pending owner guards physical repeat presses. */
export function FreshStart(props: {
  readonly agent: Row
  /** Whether the press sits on a zoomed page (over layer) rather than a row. */
  readonly page?: boolean
}) {
  const saying = createSaying()
  const [starting, setStarting] = createSignal(false)
  const [menu, setMenu] = createSignal<HTMLElement | null>(null)
  const agents = useAgents()

  /** The fresh start itself, on whichever engine the press named. */
  const fresh = (engine: string): void => {
    if (starting()) return
    const reading = agentReadings()
    const node = props.agent.id
    setStarting(true)
    saying.say(undefined)
    run(
      chatWire().procedures.conversation.startAgentSession({
        node,
        agent: engine,
      }),
      (failure) => {
        setStarting(false)
        saying.say({ tone: "alarm", text: failure.message, kind: failure._tag })
      },
      () => {
        setStarting(false)
        if (agentReadings() === reading) reading?.visit(node)
        // The completed history revision refreshes this tab and its siblings.
      },
    )
  }

  const pressed = (event: MouseEvent): void => {
    const only = agents.engines()[0]
    if (agents.standings().length === 1 && only !== undefined) fresh(only.id)
    else setMenu(event.currentTarget as HTMLElement)
  }

  return <span class="relative">
    <button type="button" class={QUIET_PILL} data-testid={TESTID.chatFreshSession}
      data-agent={props.agent.id} disabled={starting() || agents.engines().length === 0} aria-busy={starting()}
      title={`memory is the subtree (${memoryOf(props.agent)}); the transcript becomes history`}
      onClick={pressed}>fresh start</button>
    <Show when={saying.said()}>{said => <SaidLine said={said()} testid={TESTID.chatFreshSaid} class="mt-1 text-xs" />}</Show>
    <Show when={menu()}>
      {(anchor) => <EngineMenu layer={props.page ? LAYER.over : LAYER.row} anchor={anchor()}
        engines={agents.standings()} pick={engine => { setMenu(null); fresh(engine) }} close={() => setMenu(null)} />}
    </Show>
  </span>
}
