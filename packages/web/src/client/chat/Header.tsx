/**
 * The panel's header: which conversation, which model, and the ways to change
 * session.
 *
 * The model is here because a turn's cost and character depend on it and
 * nothing else on screen says. USAGE is the other half of that same sentence —
 * how much room is left to run the turn in — and it is here because the
 * question it answers, "is it time to `/compact`?", had no answer on screen at
 * all: a person found out by watching the agent start forgetting. The session
 * title is here because the agent writes one in the background, and a
 * conversation with a name is one you can come back to — which is what the
 * picker beside it is for.
 *
 * WORKING is drawn BESIDE the model, not instead of it. The status used to take
 * that line until a model arrived and then never appear again, so from the
 * second turn onwards the header said "Fake One" whether the agent was thinking
 * or idle — the one line a reader looks at to find out, answering a different
 * question. They are two facts and they take two slots: what it runs on, and
 * whether it is running.
 *
 * Closing the panel is not here. The app header's agent pill is the permanent
 * toggle (./Panel.tsx); a × beside it would be a second way to close one
 * thing, which is one too many — the rule this file used to enforce by only
 * drawing the toggle while the drawer was shut, inverted for a header that
 * never loses its chrome.
 *
 * Everything drawn is a projection of the chat cell. Nothing is remembered
 * locally, so a second tab's header says the same thing as this one.
 */

import { Show } from "solid-js"

import { QUIET_PILL } from "../pill.ts"
import { TESTID } from "../testids.ts"
import { LIVE_DOT } from "./live.ts"
import { Sessions } from "./Sessions.tsx"
import type { Chat } from "./state.ts"
import { usageOf } from "./usage.ts"

export function Header(props: {
  readonly chat: Chat
}) {
  const state = () => props.chat.state()

  return (
    <header class="flex shrink-0 items-center gap-2 border-b border-rule/70 px-3 py-2">
      <div class="min-w-0 flex-1">
        <div
          class="truncate text-sm font-semibold"
          data-testid={TESTID.chatTitle}
        >
          {state().status === "off"
            ? "agent"
            : state().session?.title ?? "new conversation"}
        </div>
        <div class="flex items-center gap-2 truncate font-mono text-[0.6875rem] text-muted">
          <Show when={state().model} fallback={<span>{statusWord(state().status)}</span>}>
            {(model) => <span data-testid={TESTID.chatModel}>{model()}</span>}
          </Show>
          {/* The other half of the model's own sentence: what a turn runs on,
              and how much room is left to run it in. Drawn only once the agent
              has reported some — before the first turn there is nothing to
              say, and a `0/?` invented for that gap would be a claim about a
              window nobody named. */}
          <Show when={usageOf(state().usage)}>
            {(usage) => (
              <span data-testid={TESTID.chatUsage} title="context used / context window">
                {usage()}
              </span>
            )}
          </Show>
          {/* Always in the tree while a turn runs, whether or not a model is
              named — the two are independent, and a cue that only appears in
              one of two otherwise identical states is a cue nobody learns.
              A turn stopped on a question is still a turn in flight, so this is
              the same slot with the true word in it: "working…" while it is the
              agent's move, "waiting on you" while it is yours. */}
          <Show when={state().status === "thinking"}>
            <span
              class="flex items-center gap-1 text-doing"
              data-testid={TESTID.chatWorking}
              aria-live="polite"
            >
              <span class={LIVE_DOT} aria-hidden="true" />
              {state().asking > 0 ? "waiting on you" : "working…"}
            </span>
          </Show>
        </div>
      </div>

      {/* Both verbs need an agent to act on. With none they would refuse, so
          they are not offered — the panel's body says why. */}
      <Show when={state().status !== "off"}>
        <Sessions chat={props.chat} />
        <button
          type="button"
          class={QUIET_PILL}
          data-testid={TESTID.chatNew}
          onClick={() => props.chat.newSession()}
        >
          + new
        </button>
      </Show>
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
