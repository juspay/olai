import { LAYER } from "@olai/web/client/layer.ts"
import { TESTID } from "../../testids.ts"
import { createSignal, lazy, Show } from "solid-js"
import { ENTRY_SHAPE } from "olai-plugin-layout/entry"
import { SaidLine } from "@olai/web/client/SaidLine.tsx"
import { useAgents } from "./answered.tsx"
import { agentReadings } from "./reading.ts"
const EngineMenu = lazy(() => import("./EngineMenu.tsx"))

export function NewChat() {
  const agents = useAgents()
  const creation = agentReadings()!.newChat
  const [menu, setMenu] = createSignal<HTMLElement | null>(null)
  const start = (agent: string) => { setMenu(null); void creation.start(agent) }
  return <li>
    <button type="button" class={`${ENTRY_SHAPE} w-full text-left text-paper/65`} data-testid={TESTID.chatNew}
      disabled={creation.pending() || agents.engines().length === 0} aria-busy={creation.pending()}
      onClick={event => {
        const only = agents.engines()[0]
        if (agents.engines().length === 1 && only !== undefined) start(only.id)
        else setMenu(event.currentTarget)
      }}>new chat</button>
    <Show when={menu()}>{anchor => <EngineMenu layer={LAYER.over} anchor={anchor()} engines={agents.engines()}
      close={() => setMenu(null)} pick={start} />}</Show>
    <Show when={creation.said()}>{said => <SaidLine said={said()} testid={TESTID.agentRefused} class="text-xs" />}</Show>
  </li>
}
