/**
 * The chat panel: open dock (or mobile bottom sheet), or minimized signal.
 *
 * Every panel has exactly two states — open, or minimized-with-signal. Open on
 * desktop is a drag-resizable right dock under the header; open on a phone is
 * a bottom sheet with half/full snap points (drag the grab handle between
 * them). Minimized is the bottom-right pill (desktop) or the thumb strip
 * (phone).
 *
 * The header's agent toggle stays the permanent chrome control (#101). The
 * TRANSCRIPT is subscribed only while the panel is open; Minimized reads a
 * module-scoped snapshot updated from here (`last.ts`), never the collection.
 */

import { createEffect, createSignal, Show } from "solid-js"

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
import { sampleLastAgent } from "./last.ts"
import { Minimized } from "./Minimized.tsx"
import { NoAgent } from "./NoAgent.tsx"
import { createChat, createChatState } from "./state.ts"
import { Transcript } from "./Transcript.tsx"

export function Panel() {
  return (
    <>
      <Show when={chatOpen()}>
        <Show when={desktop()} fallback={<MobileSheet />}>
          <DesktopDock />
        </Show>
      </Show>
      <Minimized />
    </>
  )
}

/**
 * The agent control in the app header: always on screen, toggles open/minimized.
 */
export function Toggle() {
  const state = createChatState()
  const working = () => state().status === "thinking"
  /** A turn stopped on a question. Its own bit on the permanent chrome,
   *  because this is the one state a shut panel must not swallow: an agent
   *  thinking behind a closed drawer will finish by itself, and an agent
   *  waiting on somebody who cannot see it never will. */
  const asking = () => state().asking > 0
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
      data-asking={asking()}
      aria-pressed={open() ? "true" : "false"}
      title={
        asking()
          ? open()
            ? "the agent is waiting on your answer"
            : "the agent is waiting on your answer — open the panel"
          : working()
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

  // Snapshot the last agent row for the minimized face; dies with this owner.
  createEffect(() => sampleLastAgent(chat))

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
 * Mobile bottom sheet under the header: half / full snaps, drag the grab
 * handle between them (or tap to cycle). Scrim dismiss → minimized strip.
 * Host starts below the header so chrome stays tappable.
 */
function MobileSheet() {
  const chat = createChat()
  const off = () => chat.state().status === "off"
  const [dragPct, setDragPct] = createSignal<number | null>(null)
  /** True when the last pointer gesture moved enough to count as a drag
   *  rather than a tap-to-cycle. */
  let dragged = false

  createEffect(() => sampleLastAgent(chat))

  const heightPct = () => {
    const drag = dragPct()
    if (drag !== null) return drag
    return chatSnap() === "full" ? 92 : 50
  }

  const onHandlePointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return
    event.preventDefault()
    dragged = false
    const startY = event.clientY
    const startPct = heightPct()
    const visible =
      typeof window !== "undefined"
        ? window.visualViewport?.height ?? window.innerHeight
        : 800
    const header = 48 // --height-header 3rem; good enough for gesture math
    const usable = Math.max(1, visible - header)

    const onMove = (e: PointerEvent) => {
      const dy = startY - e.clientY
      if (Math.abs(dy) > 4) dragged = true
      // Drag up → taller sheet.
      const next = Math.min(95, Math.max(30, startPct + (dy / usable) * 100))
      setDragPct(next)
    }
    const onEnd = () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onEnd)
      window.removeEventListener("pointercancel", onEnd)
      const pct = dragPct() ?? startPct
      setDragPct(null)
      if (dragged) setChatSnap(pct >= 70 ? "full" : "half")
    }
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onEnd)
    window.addEventListener("pointercancel", onEnd)
  }

  return (
    <div
      class="fixed inset-x-0 bottom-0 top-[var(--height-header,3rem)] z-40 md:hidden"
      data-testid={TESTID.chatSheet}
    >
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
          height: `${heightPct()}%`,
          "max-height": "100%",
          "padding-bottom": "env(safe-area-inset-bottom, 0px)",
        }}
        data-testid={TESTID.chatPanel}
        data-status={chat.state().status}
        data-layout="sheet"
        data-snap={chatSnap()}
        aria-label="agent"
      >
        <div
          role="separator"
          aria-orientation="horizontal"
          aria-label={
            chatSnap() === "half"
              ? "drag to expand chat, or tap to toggle"
              : "drag to shrink chat, or tap to toggle"
          }
          class="flex shrink-0 cursor-grab touch-none flex-col items-center gap-1 py-2 active:cursor-grabbing"
          data-testid={TESTID.chatSheetHandle}
          onPointerDown={onHandlePointerDown}
          onClick={() => {
            // Tap without a meaningful drag still cycles.
            if (dragged) return
            setChatSnap(chatSnap() === "half" ? "full" : "half")
          }}
        >
          <span class="h-1 w-10 rounded-full bg-rule" aria-hidden="true" />
        </div>
        <Header chat={chat} />
        <Show when={!off()} fallback={<NoAgent />}>
          <Transcript chat={chat} />
          <Composer chat={chat} />
        </Show>
      </aside>
    </div>
  )
}

export type { ChatSnap }
