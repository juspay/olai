/**
 * Minimized chat on desktop: a bottom-right pill with the last agent message.
 *
 * The other of the two chat states (open dock vs this). Clicking it opens the
 * dock; the header's agent toggle does the same. Pulses while a turn runs.
 * Deliberately carries NO connection dot — that stays in the header (#101
 * reconciliation, 2026-08-11).
 *
 * On a phone the collapsed face is the bottom strip (`./Strip.tsx`), not this
 * pill — both read the same last-message source.
 */

import { Show } from "solid-js"

import { chatOpen, setChatOpen } from "../layout/prefs.ts"
import { desktop } from "../layout/media.ts"
import { TESTID } from "../testids.ts"
import { createLastAgentText, previewText } from "./last.ts"
import { createChatState } from "./state.ts"

export function Pill() {
  // Desktop-only. Mobile uses the strip above the thumb.
  const state = createChatState()
  const last = createLastAgentText()
  const working = () => state().status === "thinking"
  const show = () => desktop() && !chatOpen()

  return (
    <Show when={show()}>
      <button
        type="button"
        class={`fixed bottom-4 right-4 z-40 flex max-w-[min(24rem,calc(100vw-2rem))] items-center gap-2 rounded-full border bg-paper px-3 py-2 text-left font-mono text-xs shadow-sm ${
          working()
            ? "animate-pulse border-doing text-doing"
            : "border-rule text-muted hover:border-accent hover:text-ink"
        }`}
        data-testid={TESTID.chatPill}
        data-busy={working()}
        title={working() ? "the agent is working — open the panel" : "open the agent panel"}
        onClick={() => setChatOpen(true)}
      >
        <span class="shrink-0 text-doing" aria-hidden="true">
          &gt;_
        </span>
        <span class="min-w-0 truncate" data-testid={TESTID.chatPillText}>
          <Show
            when={last()}
            fallback={
              <span>
                {working()
                  ? "working…"
                  : state().status === "off"
                  ? "no agent"
                  : "ask the agent"}
              </span>
            }
          >
            {(text) => previewText(text())}
          </Show>
        </span>
      </button>
    </Show>
  )
}
