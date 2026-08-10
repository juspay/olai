/**
 * The panel's header: which conversation, which model, and the two ways out of
 * it.
 *
 * The model is here because a turn's cost and character depend on it and
 * nothing else on screen says. The session title is here because the agent
 * writes one in the background, and a conversation with a name is one you can
 * come back to — which is what the picker beside it is for.
 *
 * Everything drawn is a projection of the chat cell. Nothing is remembered
 * locally, so a second tab's header says the same thing as this one.
 */

import { Show } from "solid-js"

import { TESTID } from "../testids.ts"
import { Sessions } from "./Sessions.tsx"
import type { Chat } from "./state.ts"

export function Header(props: {
  readonly chat: Chat
  readonly onClose: () => void
}) {
  const state = () => props.chat.state()

  return (
    <header class="flex shrink-0 items-center gap-2 border-b border-rule px-3 py-2">
      <div class="min-w-0 flex-1">
        <div
          class="truncate text-sm"
          data-testid={TESTID.chatTitle}
        >
          {state().session?.title ?? "new conversation"}
        </div>
        <div class="truncate font-mono text-[0.6875rem] text-muted">
          <Show when={state().model} fallback={<span>{statusWord(state().status)}</span>}>
            {(model) => (
              <span data-testid={TESTID.chatModel}>{model()}</span>
            )}
          </Show>
        </div>
      </div>

      <Sessions chat={props.chat} />

      <button
        type="button"
        class="rounded border border-rule px-2 py-1 text-xs text-muted hover:text-ink"
        data-testid={TESTID.chatNew}
        onClick={() => props.chat.newSession()}
      >
        + new
      </button>
      <button
        type="button"
        class="rounded border border-rule px-2 py-1 text-xs text-muted hover:text-ink"
        data-testid={TESTID.chatClose}
        aria-label="close the agent panel"
        onClick={() => props.onClose()}
      >
        ×
      </button>
    </header>
  )
}

/** What to say before the agent has named a model. The four are the cell's own
 *  states; `off` never reaches here, because a panel with no agent is not
 *  drawn at all. */
const statusWord = (status: string): string =>
  status === "booting"
    ? "starting…"
    : status === "gone"
    ? "not running"
    : status === "thinking"
    ? "working…"
    : "ready"
