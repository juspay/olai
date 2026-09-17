import { createSignal, Show } from "solid-js"
import { memoryOf } from "@olai/format"
import { QUIET_PILL } from "@olai/web/client/pill.ts"
import { run } from "@olai/web/client/run.ts"
import { createSaying } from "@olai/web/client/saying.ts"
import { SaidLine } from "@olai/web/client/SaidLine.tsx"
import { lazy, Suspense } from "solid-js"
import type { AgentChoice } from "olai-plugin-chat/wire"
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
    const engines = agents.engines()
    if (engines.length <= 1) {
      // ONE engine: the existing single-engine gesture, unchanged — start it
      // immediately on the engine the node runs.
      fresh(props.agent.engine)
      return
    }
    setMenu(event.currentTarget as HTMLElement)
  }

  /** The engine the node runs first, then the rest in roster order — picking
   *  nothing changes the node's engine, and the current one's row is the press
   *  somebody already read. */
  const ordered = (): ReadonlyArray<AgentChoice> => {
    const engines = agents.engines()
    if (engines.length <= 1) return engines
    const current = engines.find((engine) => engine.id === props.agent.engine)
    return current === undefined
      ? engines
      : [current, ...engines.filter((engine) => engine.id !== current.id)]
  }

  return <span class="relative">
    <button type="button" class={QUIET_PILL} data-testid={TESTID.chatFreshSession}
      data-agent={props.agent.id} disabled={starting()} aria-busy={starting()}
      title={`memory is the subtree (${memoryOf(props.agent)}); the transcript becomes history`}
      onClick={pressed}>fresh start</button>
    <Show when={saying.said()}>{said => <SaidLine said={said()} testid={TESTID.chatFreshSaid} class="mt-1 text-xs" />}</Show>
    <Show when={menu()}>
      {(anchor) => <Suspense fallback={null}>
        <EngineMenu layer={props.page ? LAYER.over : LAYER.row} anchor={anchor()}
          engines={ordered()} pick={engine => { setMenu(null); fresh(engine) }} close={() => setMenu(null)} />
      </Suspense>}
    </Show>
  </span>
}
