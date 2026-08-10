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
 * **It always draws.** Whether an agent is CONFIGURED is the server's answer,
 * and when the answer is no the panel says so ({@link NoAgent}) rather than
 * disappearing — a feature that is silently absent cannot be told apart from
 * one that is broken, or from one you have not found yet. Serving a directory
 * still does not depend on an agent being installed; that principle survives as
 * "the server is fine without one", not as "hide the panel".
 *
 * The TRANSCRIPT is subscribed to only while the drawer is open, which is why
 * the conversation is a component of its own rather than a call at the top of
 * this one. A shut drawer with a turn running in another tab would otherwise
 * take every streaming frame and re-fold the whole transcript for each — for a
 * panel nobody is looking at. Nothing is lost by dropping it: the collection is
 * server-authored, so re-opening re-seeds from the same object.
 */

import { Show } from "solid-js"

import { TESTID } from "../testids.ts"
import { Composer } from "./Composer.tsx"
import { Header } from "./Header.tsx"
import { NoAgent } from "./NoAgent.tsx"
import { chatOpen, setChatOpen } from "./open.ts"
import { createChat } from "./state.ts"
import { Transcript } from "./Transcript.tsx"

export function Panel() {
  return (
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
  )
}

/** The open drawer. Its own component so the transcript subscription is
 *  created and disposed with it — Solid ties both to this owner. */
function Conversation() {
  const chat = createChat()
  const off = () => chat.state().status === "off"

  return (
    <aside
      class="fixed bottom-0 right-0 top-0 z-30 flex w-chat max-w-full flex-col border-l border-rule bg-paper"
      data-testid={TESTID.chatPanel}
      data-status={chat.state().status}
      aria-label="agent"
    >
      <Header chat={chat} onClose={() => setChatOpen(false)} />
      {/* No agent means no transcript to draw and nothing to send, so the two
          go together and the explanation takes their place. */}
      <Show when={!off()} fallback={<NoAgent />}>
        <Transcript chat={chat} />
        <Composer chat={chat} />
      </Show>
    </aside>
  )
}
