/**
 * The chat panel: a drawer on the right, open or shut.
 *
 * It is a DRAWER rather than a column in the layout, and that is a decision
 * about what olai is: the outline is the page, and the agent is something you
 * open beside it. A permanent column would take a sixth of every screen from
 * the thing the app is for, and the panel is worth nothing when you are reading.
 *
 * Open-ness is this browser's, remembered in `localStorage` — like which nodes
 * are folded, it belongs to a reading and not to the file, and nothing about it
 * is sent anywhere.
 *
 * Whether there is a panel AT ALL is the server's: with no ACP agent
 * configured the cell reads `off`, and nothing here draws. A directory is
 * readable whether or not an agent is installed.
 */

import { Show } from "solid-js"

import { TESTID } from "../testids.ts"
import { Composer } from "./Composer.tsx"
import { Header } from "./Header.tsx"
import { createChat } from "./state.ts"
import { Transcript } from "./Transcript.tsx"
import { chatOpen, setChatOpen } from "./open.ts"

export function Panel() {
  const chat = createChat()
  const off = () => chat.state().status === "off"

  return (
    <Show when={!off()}>
      <Show
        when={chatOpen()}
        fallback={
          <button
            type="button"
            class="fixed bottom-3 right-32 z-40 rounded-full border border-rule bg-paper px-3 py-1.5 font-mono text-xs text-muted hover:text-ink"
            data-testid={TESTID.chatToggle}
            onClick={() => setChatOpen(true)}
          >
            &gt;_ agent
          </button>
        }
      >
        <aside
          class="fixed bottom-0 right-0 top-0 z-30 flex w-[26rem] max-w-full flex-col border-l border-rule bg-paper"
          data-testid={TESTID.chatPanel}
          data-status={chat.state().status}
          aria-label="agent"
        >
          <Header chat={chat} onClose={() => setChatOpen(false)} />
          <Transcript chat={chat} />
          <Composer chat={chat} />
        </aside>
      </Show>
    </Show>
  )
}
