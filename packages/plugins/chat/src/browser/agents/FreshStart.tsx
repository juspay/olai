import { createSignal, lazy, Show } from "solid-js"
import { memoryOf } from "@olai/format"
import { ALARM_PILL, QUIET_PILL } from "@olai/web/client/pill.ts"
import { run } from "@olai/web/client/run.ts"
import { createSaying } from "@olai/web/client/saying.ts"
import { SaidLine } from "@olai/web/client/SaidLine.tsx"
import type { AgentChoice } from "olai-plugin-chat/wire"
import { chatWire } from "../wire.ts"
import { agentReadings } from "./reading.ts"
import { useAgents } from "./answered.tsx"
import type { Row } from "./roster.ts"
import { LAYER } from "@olai/web/client/layer.ts"
import { createConfirming } from "@olai/web/client/confirming.ts"
import { freshStartQuestion } from "./fresh-start.ts"
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
  const [menu, setMenu] = createSignal<HTMLElement | null>(null)
  const agents = useAgents()
  const confirm = createConfirming(() => JSON.stringify([props.agent.id, props.agent.engine, props.agent.session]))
  const starting = () => confirm.where() === "working"
  const [chosen, setChosen] = createSignal("")
  let trigger: HTMLButtonElement | undefined
  const ask = (engine: string): void => {
    if (starting() || confirm.where() === "asking") return
    setChosen(engine)
    confirm.ask()
  }
  const cancel = (): void => {
    confirm.drop()
    trigger?.focus()
  }

  /** The fresh start itself, on whichever engine the press named. */
  const fresh = (engine: string): void => {
    if (starting() || confirm.where() !== "asking") return
    confirm.begin()
    const reading = agentReadings()
    const node = props.agent.id
    saying.say(undefined)
    run(
      chatWire().procedures.conversation.startAgentSession({
        node,
        agent: engine,
      }),
      (failure) => {
        confirm.done()
        saying.say({ tone: "alarm", text: failure.message, kind: failure._tag })
      },
      () => {
        confirm.done()
        if (agentReadings() === reading) reading?.visit(node)
        // The completed history revision refreshes this tab and its siblings.
      },
    )
  }

  const pressed = (event: MouseEvent): void => {
    if (starting() || confirm.where() === "asking") return
    if (agents.only() !== null || agents.engines().length === 0) {
      // Preserve the node's engine. A withdrawal must refuse this request,
      // never silently move its conversation onto a surviving engine.
      ask(props.agent.engine)
      return
    }
    setMenu(event.currentTarget as HTMLElement)
  }

  /** Current engine first; all other standings retain bundle order. Opening
   * the menu is not consent to move the node to whichever engine sorts first. */
  const ordered = (): ReadonlyArray<AgentChoice> => {
    const engines = agents.standings()
    const current = engines.find(engine => engine.id === props.agent.engine)
    return current === undefined
      ? engines
      : [current, ...engines.filter(engine => engine.id !== current.id)]
  }

  return <span class="relative">
    <button ref={trigger} type="button" class={QUIET_PILL} data-testid={TESTID.chatFreshSession}
      data-agent={props.agent.id} disabled={starting()} aria-busy={starting()}
      title={`memory is the subtree (${memoryOf(props.agent)}); the transcript becomes history`}
      onClick={pressed}>fresh start</button>
    <Show when={confirm.where() === "asking"}>
      <span role="group" aria-label="Confirm fresh start" class="block max-w-sm whitespace-normal text-xs"
        onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); cancel() } }}>
        <span>{freshStartQuestion(props.agent.title)}</span>
        <span class="mt-2 flex gap-2">
          <button type="button" class={ALARM_PILL} onClick={() => fresh(chosen())}>Start fresh conversation</button>
          <button type="button" class={QUIET_PILL}
            ref={element => queueMicrotask(() => { if (element.isConnected) element.focus() })}
            onClick={cancel}>Cancel</button>
        </span>
      </span>
    </Show>
    <Show when={saying.said()}>{said => <SaidLine said={said()} testid={TESTID.chatFreshSaid} class="mt-1 text-xs" />}</Show>
    <Show when={menu()}>
      {(anchor) => <EngineMenu layer={props.page ? LAYER.over : LAYER.row} anchor={anchor()}
        engines={ordered()} pick={engine => { setMenu(null); ask(engine) }} close={() => setMenu(null)} />}
    </Show>
  </span>
}
