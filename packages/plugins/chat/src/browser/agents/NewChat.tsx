/** THE `+` ON THE CHATS HEADING — the sidebar's way to a new conversation.
 *  It starts at once where exactly one engine can start; otherwise it opens
 *  the engine menu (`./EngineMenu.tsx`) under itself — the engines that can
 *  start, or with none, one quiet line and the plugins panel's door. A real button: Tab reaches it, Enter
 *  and Space press it, and the menu hands focus back to it on Escape. */
import { LAYER } from "@olai/web/client/layer.ts"
import { TESTID } from "../../testids.ts"
import { createSignal, lazy, Show } from "solid-js"
import { HEAD_ACTION } from "olai-plugin-layout/entry"
import { SaidLine } from "@olai/web/client/SaidLine.tsx"
import { useAgents } from "./answered.tsx"
import { agentReadings } from "./reading.ts"
const EngineMenu = lazy(() => import("./EngineMenu.tsx"))

export function NewChat() {
  const agents = useAgents()
  const creation = agentReadings()?.newChat
  const [menu, setMenu] = createSignal<HTMLElement | null>(null)
  const start = (agent: string) => { setMenu(null); void creation?.start(agent) }
  // A press on the `+` while its menu is up is the menu's outside-press: it
  // has shut by the time the click lands, and must not open again.
  let shutting = false
  return <>
    <button type="button" class={HEAD_ACTION} data-testid={TESTID.chatNew}
      aria-label="New chat" title="New chat" aria-haspopup="menu" aria-expanded={menu() !== null}
      disabled={creation === undefined || creation?.pending()} aria-busy={creation?.pending()}
      onPointerDown={() => { shutting = menu() !== null }}
      onClick={event => {
        // Deliberately LET the click bubble: the sidebar body puts the phone
        // drawer away, which is what a new chat wants — the conversation it
        // starts unfolds in the page the drawer was covering. The engine menu
        // is portalled and anchored to this button's last box, so it stays.
        if (shutting) { shutting = false; setMenu(null); return }
        // One startable engine is no choice, regardless of how many missing
        // engines the build ships. Their advice remains in the inspector.
        const only = agents.only()
        if (only !== null) start(only.id)
        else setMenu(event.currentTarget)
      }}>
      <svg viewBox="0 0 16 16" class="size-3.5" aria-hidden="true" fill="currentColor">
        <path d="M8 2.75a.75.75 0 0 1 .75.75v3.75h3.75a.75.75 0 0 1 0 1.5H8.75v3.75a.75.75 0 0 1-1.5 0V8.75H3.5a.75.75 0 0 1 0-1.5h3.75V3.5A.75.75 0 0 1 8 2.75z" />
      </svg>
    </button>
    <Show when={menu()}>{anchor => <EngineMenu layer={LAYER.over} anchor={anchor()} engines={agents.standings()}
      close={() => setMenu(null)} pick={start} />}</Show>
  </>
}

/** What the last start refused, said under the heading the `+` sits on. */
export function NewChatSaid() {
  const creation = agentReadings()?.newChat
  return <Show when={creation?.said()}>{said => <SaidLine said={said()} testid={TESTID.agentRefused} class="px-2.5 text-label" />}</Show>
}
