/** THE `+` ON THE CHATS HEADING — the sidebar's way to a new conversation.
 *  With an engine that can start, it opens the palette already at New chat's
 *  where level (`./new-chat-level.ts`) through navigation's declared palette
 *  service; without one, it opens the engine menu (`./EngineMenu.tsx`) under
 *  itself — one quiet line and the plugins panel's door. A real button: Tab
 *  reaches it, Enter and Space press it, and the menu hands focus back to it
 *  on Escape. */
import { LAYER } from "@olai/web/client/layer.ts"
import { TESTID } from "../../testids.ts"
import { createSignal, lazy, Show } from "solid-js"
import { HEAD_ACTION } from "olai-plugin-layout/entry"
import { SaidLine } from "@olai/web/client/SaidLine.tsx"
import { palette } from "../navigation.ts"
import { useAgents } from "./answered.tsx"
import { agentReadings } from "./reading.ts"
import { NEW_CHAT_ROW } from "./new-chat-level.ts"
const EngineMenu = lazy(() => import("./EngineMenu.tsx"))

export function NewChat() {
  const agents = useAgents()
  const creation = agentReadings()?.newChat
  const [menu, setMenu] = createSignal<HTMLElement | null>(null)
  // A press on the `+` while its menu is up is the menu's outside-press: it
  // has shut by the time the click lands, and must not open again.
  let shutting = false
  return <>
    <button type="button" class={HEAD_ACTION} data-testid={TESTID.chatNew}
      aria-label="New chat" title="New chat" aria-haspopup={agents.engines().length === 0 ? "menu" : "dialog"}
      aria-expanded={menu() !== null} aria-busy={creation?.pending()}
      onPointerDown={() => { shutting = menu() !== null }}
      onClick={event => {
        // Deliberately LET the click bubble: the sidebar body puts the phone
        // drawer away, which is what a new chat wants — the palette opens over
        // the page the drawer was covering. The engine menu is portalled and
        // anchored to this button's last box, so it stays.
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
    <Show when={menu()}>{anchor => <EngineMenu layer={LAYER.over} anchor={anchor()} engines={agents.standings()}
      close={() => setMenu(null)} pick={() => setMenu(null)} />}</Show>
  </>
}

/** What the `+` could not do, said under the heading it sits on. */
export function NewChatSaid() {
  const creation = agentReadings()?.newChat
  return <Show when={creation?.said()}>{said => <SaidLine said={said()} testid={TESTID.agentRefused} class="px-2.5 text-label" />}</Show>
}
