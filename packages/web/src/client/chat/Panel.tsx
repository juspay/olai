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
 *
 * Both layouts render the same `Face` — the header, whatever this conversation
 * is short of, and the conversation itself — so the two shells own their chrome
 * and their geometry and nothing else. Inside it, `Body` is the conversation,
 * the box and the drop target around them: a file let go of anywhere on the
 * conversation is attached to it, and the chips land in the composer inside.
 * The body only — the header is session controls, and a file cannot go there.
 *
 * Between those two sits {@link Missing}, which draws nothing at all unless this
 * conversation was short of an MCP server it was meant to have. It is OUTSIDE
 * the no-agent fallback and outside the drop target on purpose: it is a fact
 * about the session rather than a part of the conversation, and it belongs
 * where the header's other facts are — above the scroll, and never carried
 * away by it.
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
import { LAYER, WITHIN } from "../layer.ts"
import { TESTID } from "../testids.ts"
import { ICON_BUTTON } from "../readout.ts"
import { Composer } from "./Composer.tsx"
import { DropTarget } from "./DropTarget.tsx"
import { Header } from "./Header.tsx"
import { createHolding } from "./holding.ts"
import { sampleLastAgent } from "./last.ts"
import { Minimized } from "./Minimized.tsx"
import { Missing } from "./Missing.tsx"
import { NoAgent } from "./NoAgent.tsx"
import { type Chat, createChat, createChatState } from "./state.ts"
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
 *
 * Below 40rem it is its MARK alone. The bar holds five things at 390pt and it
 * cannot hold five labels, so the header spends its pixels in a stated order
 * (`../AppHeader.tsx`) — and `>_` is the one label in it that is already an
 * icon, recognisable without the word beside it. The word is `sr-only` rather
 * than gone: it is what names this button to a screen reader, and a control
 * whose accessible name shrank with the viewport would be a control that is
 * harder to reach on exactly the device that needs it most.
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
      // The bar's icon-button shape (`../readout.ts`), which the preferences
      // trigger beside it wears too — 44px included, and it is what keeps the
      // line below from being a bad trade: dropping the word to its mark takes
      // this button's WIDTH with it, and a primary control a thumb has to aim
      // at is not somewhere to save 12px. This bar's other tap targets have
      // measured 44×44 since #104 and this one was 76×27 — wide, and never tall
      // enough. The BORDER is this button's own news: a turn running, or the
      // panel open.
      class={`${ICON_BUTTON} border ${
        working()
          ? "animate-pulse border-doing text-doing"
          : open()
          ? "border-accent text-paper"
          : "border-paper/25"
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
      &gt;_<span class="sr-only sm:not-sr-only"> agent</span>
    </button>
  )
}

/**
 * Everything inside either shell: the header, whatever this conversation is
 * short of, and then the conversation or the explanation of why there is none.
 *
 * The two layouts differ in their chrome and their geometry and never in THIS,
 * and the argument is the one {@link Body} already makes one level down: three
 * elements in a fixed order, kept identical in two places 100 lines apart, is
 * one place for the next one to be added and another for it to be forgotten —
 * and the phone is the copy that gets forgotten, because the scenarios that
 * would notice mostly run on a desktop viewport.
 */
function Face(props: { readonly chat: Chat }) {
  const off = () => props.chat.state().status === "off"
  return (
    <>
      <Header chat={props.chat} />
      <Missing chat={props.chat} />
      <Show when={!off()} fallback={<NoAgent />}>
        <Body chat={props.chat} />
      </Show>
    </>
  )
}

/**
 * Everything under the header: the conversation, the box, and the drop target
 * around both.
 *
 * One component because the two layouts differ in their chrome and their
 * geometry and never in this — and because the drop target and the composer
 * have to share one `holding`, which is a wiring nobody should have to keep
 * identical in two places 100 lines apart.
 */
function Body(props: { readonly chat: Chat }) {
  const holding = createHolding(props.chat)
  return (
    <DropTarget onFiles={(files) => void holding.take(files)}>
      <Transcript chat={props.chat} />
      <Composer chat={props.chat} holding={holding} />
    </DropTarget>
  )
}

function DesktopDock() {
  const chat = createChat()

  // Snapshot the last agent row for the minimized face; dies with this owner.
  createEffect(() => sampleLastAgent(chat))

  return (
    <aside
      class={`fixed right-0 top-[var(--height-header,4rem)] ${LAYER.page} flex h-[calc(var(--visible-h,100dvh)-var(--height-header,4rem))] max-w-full min-w-0 flex-col border-l border-rule/70 bg-desk`}
      style={{ width: `${chatWidth()}px` }}
      data-testid={TESTID.chatPanel}
      data-status={chat.state().status}
      data-layout="dock"
      aria-label="agent"
    >
      <div class={`absolute inset-y-0 left-0 ${WITHIN.raised}`}>
        <ChatHandle />
      </div>
      <Face chat={chat} />
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
    const header = 64 // --height-header 4rem; good enough for gesture math
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
      class={`fixed inset-x-0 bottom-0 top-[var(--height-header,4rem)] ${LAYER.chrome} md:hidden`}
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
        class="absolute inset-x-0 bottom-0 flex min-w-0 flex-col rounded-t-xl border-t border-rule/70 bg-desk shadow-lg"
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
        <Face chat={chat} />
      </aside>
    </div>
  )
}

export type { ChatSnap }
