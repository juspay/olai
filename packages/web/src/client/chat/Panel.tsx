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
 * Opening and closing it is {@link Toggle}, which is NOT drawn here: it is
 * chrome that belongs to the app rather than to the page, so the layout places
 * it — in the app header beside the connection pill and the theme picker
 * (`AppHeader.tsx`). It is a permanent TOGGLE (always on screen, pressed while
 * the drawer is open), not a pill that vanishes once the panel is up: the
 * header is the home for app chrome whether or not the agent is open, and a
 * control that disappears when you need it to reverse itself was the old
 * drawer-era shape. There is no × in the panel header for the same reason the
 * old comment gave — two ways to close one thing is one too many; the header
 * toggle is the one that remains.
 *
 * **Under the header, not over it.** The drawer is fixed from the bottom of the
 * header bar (`--height-header`) rather than from the top of the viewport: the
 * header is the app's chrome and stays reachable while the agent is open — the
 * connection answer, the agent toggle itself, the theme. Covering it would bury
 * exactly the chrome a long turn makes you want. Height is `--visible-h` minus
 * that strip, so an on-screen keyboard still keeps the composer above itself
 * (../viewport.ts).
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

/**
 * The agent control in the app header: always on screen, toggles the drawer.
 *
 * Pressed while the drawer is open (`aria-pressed` + an accent border so a
 * screen reader and a glance agree). Clicking while open shuts it — there is
 * no second close affordance in the panel. And it says whether a turn is
 * running in either state: a shut drawer with a turn used to be an inert pill
 * that knew nothing, including when the turn stopped; the pulse is that cue,
 * and it has to survive a panel being open just as much as shut.
 *
 * {@link createChatState} rather than {@link createChat} so it is the CELL
 * that is subscribed and not the transcript: taking every streaming frame for
 * a busy bit on a pill is exactly what the drawer's own subscription is scoped
 * to avoid.
 */
export function Toggle() {
  const state = createChatState()
  const working = () => state().status === "thinking"
  const open = () => chatOpen()

  return (
    <button
      type="button"
      class={`shrink-0 rounded-full border bg-paper px-2 py-1.5 font-mono text-xs hover:text-ink sm:px-3 ${
        working()
          ? "animate-pulse border-doing text-doing"
          : open()
          ? "border-accent text-ink"
          : "border-rule text-muted"
      }`}
      data-testid={TESTID.chatToggle}
      data-busy={working()}
      aria-pressed={open() ? "true" : "false"}
      title={
        working()
          ? open()
            ? "the agent is working — close the panel"
            : "the agent is working — open the panel"
          : open()
          ? "close the agent panel"
          : "open the agent panel"
      }
      onClick={() => setChatOpen(!open())}
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
      // `--height-header` is a static `:root` token in styles.css (3rem, the
      // bar's `h-12`); the `3rem` fallback only fires if the sheet failed to
      // load. `--visible-h` falls back to `100dvh` on desktops that never
      // publish the variable.
      class="fixed right-0 top-[var(--height-header,3rem)] z-30 flex h-[calc(var(--visible-h,100dvh)-var(--height-header,3rem))] w-chat max-w-full flex-col border-l border-rule bg-paper"
      data-testid={TESTID.chatPanel}
      data-status={chat.state().status}
      aria-label="agent"
    >
      <Header chat={chat} />
      {/* No agent means no transcript to draw and nothing to send, so the two
          go together and the explanation takes their place. */}
      <Show when={!off()} fallback={<NoAgent />}>
        <Transcript chat={chat} />
        <Composer chat={chat} />
      </Show>
    </aside>
  )
}
