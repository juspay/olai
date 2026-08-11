/**
 * Minimized chat — the other of the two states (open dock/sheet vs this).
 *
 * One component, two geometries: a bottom-right pill on desktop, a thumb
 * strip on a phone. Last-message text comes from `last.ts` (a snapshot the
 * open panel writes) — not a transcript subscription. Busy pulse comes from
 * the cheap `chat` cell via createChatState.
 */

import { Show } from "solid-js"

import { chatOpen, setChatOpen } from "../layout/prefs.ts"
import { desktop } from "../layout/media.ts"
import { TESTID } from "../testids.ts"
import { lastAgentPreview, previewText } from "./last.ts"
import { createChatState } from "./state.ts"

export function Minimized() {
  const state = createChatState()
  const working = () => state().status === "thinking"
  const show = () => !chatOpen()
  const onDesktop = () => desktop()

  const label = () =>
    working()
      ? "working…"
      : state().status === "off"
      ? "no agent"
      : "ask the agent"

  return (
    <Show when={show()}>
      <Show
        when={onDesktop()}
        fallback={
          <button
            type="button"
            class={`fixed inset-x-0 bottom-0 z-40 flex items-center gap-2 border-t bg-paper px-4 py-3 text-left font-mono text-xs ${
              working()
                ? "animate-pulse border-doing text-doing"
                : "border-rule text-muted"
            }`}
            style={{
              "padding-bottom":
                "calc(0.75rem + env(safe-area-inset-bottom, 0px))",
            }}
            data-testid={TESTID.chatStrip}
            data-busy={working()}
            title={
              working() ? "the agent is working — open chat" : "open chat"
            }
            onClick={() => setChatOpen(true)}
          >
            <Glyph />
            <Text last={lastAgentPreview()} fallback={label()} />
          </button>
        }
      >
        <button
          type="button"
          class={`fixed bottom-4 right-4 z-40 flex max-w-[min(24rem,calc(100vw-2rem))] items-center gap-2 rounded-full border bg-paper px-3 py-2 text-left font-mono text-xs shadow-sm ${
            working()
              ? "animate-pulse border-doing text-doing"
              : "border-rule text-muted hover:border-accent hover:text-ink"
          }`}
          data-testid={TESTID.chatPill}
          data-busy={working()}
          title={
            working()
              ? "the agent is working — open the panel"
              : "open the agent panel"
          }
          onClick={() => setChatOpen(true)}
        >
          <Glyph accent />
          <Text last={lastAgentPreview()} fallback={label()} />
        </button>
      </Show>
    </Show>
  )
}

function Glyph(props: { readonly accent?: boolean }) {
  return (
    <span
      class={`shrink-0 ${props.accent === true ? "text-doing" : ""}`}
      aria-hidden="true"
    >
      &gt;_
    </span>
  )
}

function Text(props: {
  readonly last: string | undefined
  readonly fallback: string
}) {
  return (
    <span class="min-w-0 flex-1 truncate" data-testid={TESTID.chatPillText}>
      <Show when={props.last} fallback={<span>{props.fallback}</span>}>
        {(text) => previewText(text())}
      </Show>
    </span>
  )
}
