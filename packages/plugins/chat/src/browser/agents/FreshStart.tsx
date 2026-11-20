import { createSignal, lazy, Show } from "solid-js"
import { memoryOf } from "@olai/format"
import { ALARM_PILL, QUIET_PILL } from "@olai/web/client/pill.ts"
import { LINE_VERB } from "./verb.ts"
import { createSaying } from "@olai/web/client/saying.ts"
import { SaidLine } from "@olai/web/client/SaidLine.tsx"
import type { AgentChoice } from "olai-plugin-chat/wire"
import { useAgents } from "./answered.tsx"
import type { Row } from "./roster.ts"
import { LAYER } from "@olai/web/client/layer.ts"
import { createConfirming } from "@olai/web/client/confirming.ts"
import { Tip } from "@olai/web/client/Tip.tsx"
import { freshStartQuestion, startFreshChat } from "./fresh-start.ts"
import { isPast as movedOn } from "./past.ts"
import { TESTID } from "../../testids.ts"
import type { Conversing } from "../../sessions.ts"

const EngineMenu = lazy(() => import("./EngineMenu.tsx"))

export function FreshStart(props: {
  readonly agent: Row
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

  const fresh = (engine: string): void => {
    if (starting() || confirm.where() !== "asking") return
    confirm.begin()
    const node = props.agent.id
    const previous: Conversing | null = props.agent.session === null
      ? null
      : { agent: props.agent.engine, session: props.agent.session }
    saying.say(undefined)
    void (async () => {
      const failure = await startFreshChat(node, engine, () =>
        previous !== null && !movedOn(previous, props.agent) ? previous : null)
      confirm.done()
      if (failure !== null) saying.say({ tone: "alarm", text: failure.message, kind: failure._tag })
    })()
  }

  const pressed = (event: MouseEvent): void => {
    if (starting() || confirm.where() === "asking") return
    if (agents.only() !== null || agents.engines().length === 0) {
      ask(props.agent.engine)
      return
    }
    setMenu(event.currentTarget as HTMLElement)
  }

  const ordered = (): ReadonlyArray<AgentChoice> => {
    const engines = agents.standings()
    const current = engines.find(engine => engine.id === props.agent.engine)
    return current === undefined
      ? engines
      : [current, ...engines.filter(engine => engine.id !== current.id)]
  }

  const keeping = (): string => props.agent.kind === "note"
    ? `keeping the note ${agents.named(props.agent).name} as its memory`
    : props.agent.memory === 0
      ? "and there is nothing under it yet to keep"
      : `keeping memory in ${memoryOf(props.agent)}`

  return <span class="relative">
    <Tip text={`Start over, ${keeping()}`}>
      <button ref={trigger} type="button" class={LINE_VERB} data-testid={TESTID.chatFreshSession}
        data-agent={props.agent.id} disabled={starting()} aria-busy={starting()}
        onClick={pressed}>Fresh start<span class="sr-only"> — start over, {keeping()}</span></button>
    </Tip>
    <Show when={confirm.where() === "asking"}>
      <span role="group" aria-label="Confirm fresh start" class="block max-w-sm whitespace-normal text-label"
        onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); cancel() } }}>
        <span>{freshStartQuestion(agents.named(props.agent).name)}</span>
        <span class="mt-2 flex gap-2">
          <button type="button" class={ALARM_PILL} onClick={() => fresh(chosen())}>Start fresh chat</button>
          <button type="button" class={QUIET_PILL}
            ref={element => queueMicrotask(() => { if (element.isConnected) element.focus() })}
            onClick={cancel}>Cancel</button>
        </span>
      </span>
    </Show>
    <Show when={saying.said()}>{said => <SaidLine said={said()} testid={TESTID.chatFreshSaid} class="mt-1 text-label" />}</Show>
    <Show when={menu()}>
      {(anchor) => <EngineMenu layer={props.page ? LAYER.over : LAYER.row} anchor={anchor()}
        engines={ordered()} pick={engine => { setMenu(null); ask(engine) }} close={() => setMenu(null)} />}
    </Show>
  </span>
}
