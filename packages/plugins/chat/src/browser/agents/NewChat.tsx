import { LAYER } from "@olai/web/client/layer.ts"
import { TESTID } from "../../testids.ts"
import { createSignal, lazy, Show } from "solid-js"
import { HEAD_ACTION } from "olai-plugin-layout/entry"
import { SaidLine } from "@olai/web/client/SaidLine.tsx"
import { Tip } from "@olai/web/client/Tip.tsx"
import { palette } from "../navigation.ts"
import { useAgents } from "./answered.tsx"
import { agentReadings } from "./reading.ts"
import { NEW_CHAT_ROW } from "./new-chat-level.ts"
const EngineMenu = lazy(() => import("./EngineMenu.tsx"))

export function NewChat() {
  const agents = useAgents()
  const creation = agentReadings()?.newChat
  const [menu, setMenu] = createSignal<HTMLElement | null>(null)
  let shutting = false
  return <>
    <Tip text="New chat">
    <button type="button" class={HEAD_ACTION} data-testid={TESTID.chatNew}
      aria-label="New chat" aria-haspopup={agents.engines().length === 0 ? "menu" : "dialog"}
      aria-expanded={menu() !== null} aria-busy={creation?.pending()}
      onPointerDown={() => { shutting = menu() !== null }}
      onClick={event => {
        if (shutting) { shutting = false; setMenu(null); return }
        if (agents.engines().length === 0) { setMenu(event.currentTarget); return }
        const control = palette()
        if (control === undefined || creation === undefined) { creation?.say({ tone: "alarm", text: "Chat isn't available" }); return }
        creation.say(undefined)
        control.showAt([NEW_CHAT_ROW])
      }}>
      <svg viewBox="0 0 16 16" class="size-3.5" aria-hidden="true" fill="currentColor">
        <path d="M8 2.75a.75.75 0 0 1 .75.75v3.75h3.75a.75.75 0 0 1 0 1.5H8.75v3.75a.75.75 0 0 1-1.5 0V8.75H3.5a.75.75 0 0 1 0-1.5h3.75V3.5A.75.75 0 0 1 8 2.75z" />
      </svg>
    </button>
    </Tip>
    <Show when={menu()}>{anchor => <EngineMenu layer={LAYER.over} anchor={anchor()} engines={agents.standings()}
      close={() => setMenu(null)} pick={() => setMenu(null)} />}</Show>
  </>
}

export function NewChatSaid() {
  const creation = agentReadings()?.newChat
  return <Show when={creation?.said()}>{said => <SaidLine said={said()} testid={TESTID.agentRefused} class="px-2.5 text-label" />}</Show>
}
