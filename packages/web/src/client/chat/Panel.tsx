/**
 * The chat panel: open dock (or mobile bottom sheet), or minimized signal.
 *
 * Every panel has exactly two states — open, or minimized-with-signal. Open on
 * desktop is a drag-resizable right dock under the header; open on a phone is
 * a bottom sheet with half/full snap points. Minimized is the bottom-right
 * pill (desktop) or the thumb strip (phone), carrying the last agent message
 * and pulsing while a turn runs.
 *
 * The header's agent toggle stays the permanent chrome control (#101): it
 * opens and minimizes the panel. There is no × in the panel header.
 *
 * **Under the header, not over it** on desktop. Height is `--visible-h` minus
 * the header strip so an on-screen keyboard keeps the composer above itself.
 *
 * The TRANSCRIPT is subscribed only while the panel is open — a shut panel
 * with a turn running elsewhere would otherwise take every streaming frame.
 * The pill/strip uses a lighter last-message subscription of its own.
 */

import { Show } from "solid-js"

import { ChatHandle } from "../layout/Handle.tsx"
import { desktop } from "../layout/media.ts"
import {
  chatOpen,
  chatSnap,
  chatWidth,
  setChatOpen,
  setChatSnap,
  type ChatSnap,
} from "../layout/prefs.ts"
import { TESTID } from "../testids.ts"
import { Composer } from "./Composer.tsx"
import { Header } from "./Header.tsx"
import { NoAgent } from "./NoAgent.tsx"
import { Pill } from "./Pill.tsx"
import { createChat, createChatState } from "./state.ts"
import { Strip } from "./Strip.tsx"
import { Transcript } from "./Transcript.tsx"

export function Panel() {
  return (
    <>
      <Show when={chatOpen()}>
        <Show when={desktop()} fallback={<MobileSheet />}>
          <DesktopDock />
        </Show>
      </Show>
      <Pill />
      <Strip />
    </>
  )
}

/**
 * The agent control in the app header: always on screen, toggles open/minimized.
 *
 * Pressed while open. Pulses while a turn runs in either state. The minimized
 * pill is the chat's collapsed face; this toggle is app chrome and stays put.
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
            ? "the agent is working — minimize the panel"
            : "the agent is working — open the panel"
          : open()
          ? "minimize the agent panel"
          : "open the agent panel"
      }
      onClick={() => setChatOpen(!open())}
    >
      &gt;_ agent
    </button>
  )
}

function DesktopDock() {
  const chat = createChat()
  const off = () => chat.state().status === "off"

  return (
    <aside
      class="fixed right-0 top-[var(--height-header,3rem)] z-30 flex h-[calc(var(--visible-h,100dvh)-var(--height-header,3rem))] max-w-full flex-col border-l border-rule bg-paper"
      style={{ width: `${chatWidth()}px` }}
      data-testid={TESTID.chatPanel}
      data-status={chat.state().status}
      data-layout="dock"
      aria-label="agent"
    >
      <div class="absolute inset-y-0 left-0 z-10">
        <ChatHandle />
      </div>
      <Header chat={chat} />
      <Show when={!off()} fallback={<NoAgent />}>
        <Transcript chat={chat} />
        <Composer chat={chat} />
      </Show>
    </aside>
  )
}

/**
 * Mobile bottom sheet: half / full snap points over a scrim.
 *
 * Hand-rolled rather than a drawer library: two fixed snap heights, a grab
 * handle that cycles them, scrim dismiss → minimized strip. No third "closed
 * to nowhere" state — dismissing lands on the strip.
 */
function MobileSheet() {
  const chat = createChat()
  const off = () => chat.state().status === "off"
  const height = () => (chatSnap() === "full" ? "92%" : "50%")

  const cycleSnap = () => {
    setChatSnap(chatSnap() === "half" ? "full" : "half")
  }

  return (
    <div class="fixed inset-0 z-40 md:hidden" data-testid={TESTID.chatSheet}>
      <button
        type="button"
        class="absolute inset-0 bg-ink/40"
        data-testid={TESTID.chatSheetScrim}
        aria-label="minimize the agent panel"
        onClick={() => setChatOpen(false)}
      />
      <aside
        class="absolute inset-x-0 bottom-0 flex flex-col rounded-t-xl border-t border-rule bg-paper shadow-lg"
        style={{
          height: height(),
          "max-height": "calc(var(--visible-h, 100dvh) - var(--height-header, 3rem))",
          "padding-bottom": "env(safe-area-inset-bottom, 0px)",
        }}
        data-testid={TESTID.chatPanel}
        data-status={chat.state().status}
        data-layout="sheet"
        data-snap={chatSnap()}
        aria-label="agent"
      >
        <button
          type="button"
          class="flex shrink-0 flex-col items-center gap-1 py-2"
          data-testid={TESTID.chatSheetHandle}
          aria-label={
            chatSnap() === "half" ? "expand chat to full height" : "shrink chat to half height"
          }
          onClick={cycleSnap}
        >
          <span class="h-1 w-10 rounded-full bg-rule" aria-hidden="true" />
        </button>
        <Header chat={chat} />
        <Show when={!off()} fallback={<NoAgent />}>
          <Transcript chat={chat} />
          <Composer chat={chat} />
        </Show>
      </aside>
    </div>
  )
}

/** For tests and the palette: the snap point type. */
export type { ChatSnap }
