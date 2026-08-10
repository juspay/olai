/**
 * The chat panel: a drawer on the right, open or shut.
 *
 * It is a DRAWER rather than a column in the layout, and that is a decision
 * about what olai is: the outline is the page, and the agent is something you
 * open beside it. A permanent column would take a sixth of every screen from
 * the thing the app is for, and the panel is worth nothing when you are reading.
 *
 * Open-ness is this browser's, remembered in `localStorage`: it belongs to a
 * reading and not to the file, and nothing about it is sent anywhere.
 *
 * Whether there is a panel AT ALL is the server's: with no ACP agent
 * configured the cell reads `off`, and nothing here draws. A directory is
 * readable whether or not an agent is installed.
 *
 * The TRANSCRIPT is subscribed to only while the drawer is open, which is why
 * the conversation is a component of its own rather than a call at the top of
 * this one. A shut drawer with a turn running in another tab would otherwise
 * take every streaming frame and re-fold the whole transcript for each — for a
 * panel nobody is looking at. Nothing is lost by dropping it: the collection is
 * server-authored, so re-opening re-seeds from the same object.
 */

import { CHAT_OFF } from "@olai/surface"
import { Show } from "solid-js"

import { TESTID } from "../testids.ts"
import { olai } from "../wire.ts"
import { Composer } from "./Composer.tsx"
import { Header } from "./Header.tsx"
import { createChat } from "./state.ts"
import { Transcript } from "./Transcript.tsx"
import { chatOpen, setChatOpen } from "./open.ts"

export function Panel() {
  // The CELL only — one small value, and the one that says whether to draw
  // anything at all.
  const state = olai.cells.chat.use()
  const off = () => (state.value() ?? CHAT_OFF).status === "off"

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
        <Conversation />
      </Show>
    </Show>
  )
}

/** The open drawer. Its own component so the transcript subscription is
 *  created and disposed with it — Solid ties both to this owner. */
function Conversation() {
  const chat = createChat()
  return (
    <aside
      class="fixed bottom-0 right-0 top-0 z-30 flex w-chat max-w-full flex-col border-l border-rule bg-paper"
      data-testid={TESTID.chatPanel}
      data-status={chat.state().status}
      aria-label="agent"
    >
      <Header chat={chat} onClose={() => setChatOpen(false)} />
      <Transcript chat={chat} />
      <Composer chat={chat} />
    </aside>
  )
}
