/**
 * Minimized chat on a phone: a strip above the thumb with the last message.
 *
 * Discharges the mobile-pwa item's owed "chat full sheet" collapsed form. Tap
 * opens the bottom sheet. Same content contract as the desktop pill — last
 * agent text + pulse while running — different geometry for a thumb.
 */

import { Show } from "solid-js"

import { chatOpen, setChatOpen } from "../layout/prefs.ts"
import { desktop } from "../layout/media.ts"
import { TESTID } from "../testids.ts"
import { createLastAgentText, previewText } from "./last.ts"
import { createChatState } from "./state.ts"

export function Strip() {
  const state = createChatState()
  const last = createLastAgentText()
  const working = () => state().status === "thinking"
  const show = () => !desktop() && !chatOpen()

  return (
    <Show when={show()}>
      <button
        type="button"
        class={`fixed inset-x-0 bottom-0 z-40 flex items-center gap-2 border-t bg-paper px-4 py-3 text-left font-mono text-xs ${
          working()
            ? "animate-pulse border-doing text-doing"
            : "border-rule text-muted"
        }`}
        style={{
          "padding-bottom": "calc(0.75rem + env(safe-area-inset-bottom, 0px))",
        }}
        data-testid={TESTID.chatStrip}
        data-busy={working()}
        title={working() ? "the agent is working — open chat" : "open chat"}
        onClick={() => setChatOpen(true)}
      >
        <span class="shrink-0" aria-hidden="true">
          &gt;_
        </span>
        <span class="min-w-0 flex-1 truncate" data-testid={TESTID.chatPillText}>
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
