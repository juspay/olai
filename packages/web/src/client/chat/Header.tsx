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
          {state().status === "off"
            ? "agent"
            : state().session?.title ?? "new conversation"}
        </div>
        <div class="truncate font-mono text-[0.6875rem] text-muted">
          <Show when={state().model} fallback={<span>{statusWord(state().status)}</span>}>
            {(model) => (
              <span data-testid={TESTID.chatModel}>{model()}</span>
            )}
          </Show>
        </div>
      </div>

      {/* Both verbs need an agent to act on. With none they would refuse, so
          they are not offered — the panel's body says why. */}
      <Show when={state().status !== "off"}>
        <Sessions chat={props.chat} />
        <button
          type="button"
          class="rounded border border-rule px-2 py-1 text-xs text-muted hover:text-ink"
          data-testid={TESTID.chatNew}
          onClick={() => props.chat.newSession()}
        >
          + new
        </button>
      </Show>
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

/** What to say before the agent has named a model — the cell's own five states,
 *  `off` included: the panel draws without an agent, and the header is where a
 *  reader looks first for why it is not doing anything. */
const statusWord = (status: string): string =>
  status === "off"
    ? "not configured"
    : status === "booting"
    ? "starting…"
    : status === "gone"
    ? "not running"
    : status === "thinking"
    ? "working…"
    : "ready"
