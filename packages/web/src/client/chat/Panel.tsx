/**
 * The chat panel: a drawer on the right, open or shut.
 *
 * It is a DRAWER rather than a column in the layout, and that is a decision
 * about what olai is: the outline is the page, and the agent is something you
 * open beside it. A permanent column would take a sixth of every screen from
 * the thing the app is for, and the panel is worth nothing when you are reading.
 *
 * Open-ness is this browser's, remembered in `localStorage`: it belongs to a
 * reading and not to the file, and nothing about it is sent anywhere. An open
 * drawer takes its width out of the LAYOUT on a screen wide enough to spare it
 * (`App.tsx`) rather than lying over the outline — a drawer you have to shut to
 * finish reading a sentence is a drawer that costs more than it is worth. On a
 * narrow one it covers the page, because there is no width to give it and half
 * a column of outline is not reading either.
 *
 * Opening it is {@link Toggle}, which is NOT drawn here: it is chrome that
 * belongs to the app rather than to the page, so the layout places it — in the
 * app header beside the connection pill and the theme picker (`AppHeader.tsx`).
 * It used to live in the sidebar's footer (or a corner when there was no
 * sidebar), which meant two homes to keep in step and a control that, on a
 * phone, sat behind the burger.
 *
 * **Under the header, not over it.** The drawer is fixed from the bottom of the
 * header bar (`--height-header`) rather than from the top of the viewport: the
 * header is the app's chrome and stays reachable while the agent is open — the
 * connection answer, the way to shut the panel by opening something else, the
 * theme. Covering it would bury exactly the chrome a long turn makes you want.
 * Height is `--visible-h` minus that strip, so an on-screen keyboard still
 * keeps the composer above itself (../viewport.ts).
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
import { createChat, createChatState } from "./state.ts"
import { Transcript } from "./Transcript.tsx"

export function Panel() {
  return (
    <Show when={chatOpen()}>
      <Conversation />
    </Show>
  )
}

/** The way in, when the drawer is shut — and nothing when it is open, because
 *  the drawer has its own × and two ways to close one thing is one too many. */
export function Toggle() {
  return (
    <Show when={!chatOpen()}>
      <ShutToggle />
    </Show>
  )
}

/**
 * ... and it says whether a turn is running behind it.
 *
 * A shut drawer with a turn in it used to be an inert pill: you asked for
 * something, closed the panel to read the outline, and nothing on screen knew
 * the agent was still working — including when it stopped. The state is the
 * server's, like everything else here.
 *
 * Its own component so the subscription is created and disposed with the shut
 * state, and {@link createChatState} rather than {@link createChat} so it is the
 * CELL that is subscribed and not the transcript: a shut drawer taking every
 * streaming frame is exactly what the drawer's own subscription is scoped to
 * avoid.
 */
function ShutToggle() {
  const state = createChatState()
  const working = () => state().status === "thinking"

  return (
    <button
      type="button"
      class={`rounded-full border bg-paper px-3 py-1.5 font-mono text-xs hover:text-ink ${
        working() ? "animate-pulse border-doing text-doing" : "border-rule text-muted"
      }`}
      data-testid={TESTID.chatToggle}
      data-busy={working()}
      title={working() ? "the agent is working" : "open the agent panel"}
      onClick={() => setChatOpen(true)}
    >
      &gt;_ agent
    </button>
  )
}

/** The open drawer. Its own component so the transcript subscription is
 *  created and disposed with it — Solid ties both to this owner. */
function Conversation() {
  const chat = createChat()
  const off = () => chat.state().status === "off"

  return (
    <aside
      // Under the header, not over it: `top` and height both subtract
      // `--height-header` (set on the header bar). `--visible-h` rather than
      // the viewport's own height: an on-screen keyboard covers the bottom of
      // the page without shrinking it (../viewport.ts), so a panel sized by
      // `100dvh` puts its composer underneath the keyboard being typed into.
      // Falls back to `100dvh` where nothing publishes the variable, which is
      // every desktop; falls back to `3rem` for the header where the bar has
      // not painted yet (a single frame, if any).
      class="fixed right-0 top-[var(--height-header,3rem)] z-30 flex h-[calc(var(--visible-h,100dvh)-var(--height-header,3rem))] w-chat max-w-full flex-col border-l border-rule bg-paper"
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
