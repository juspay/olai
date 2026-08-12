/**
 * The picker: the agent's stored conversations, newest first.
 *
 * Asked of the SERVER every time it opens rather than kept in a cell, because
 * the agent's list is the only one that is right — it changes when a terminal
 * `claude --resume` writes to the same directory, and a cached copy would
 * quietly stop being true. The cost is one round trip on a click.
 *
 * The one this server is in is marked, and clicking it does nothing: loading
 * the session you are already in would throw away a transcript to replace it
 * with the same one.
 */

import { createSignal, For, Match, Show, Switch } from "solid-js"

import { Refusal } from "./Refusal.tsx"
import { TESTID } from "../testids.ts"
import type { Chat, Sessions as Answer } from "./state.ts"
import type { OpFailure, SessionInfo } from "@olai/surface"

/**
 * The picker is a small state machine, and it is ONE signal because it is one
 * fact: shut, asking, or whichever answer came back.
 *
 * Spread over an `open` boolean, an `asking` boolean and a list, three of the
 * eight combinations are unreachable and nothing says so — "asking while shut"
 * and "a list while asking" are states the type would admit and the code would
 * have to remember not to enter.
 *
 * The answer's own two arms ({@link Sessions}) are spliced in whole rather than
 * flattened to a list, which is the fix this file carries: a refusal used to
 * arrive as `[]` and be drawn as "no stored conversations" — a claim about the
 * agent's disk, standing in for never having reached it.
 */
type Picker = { readonly _tag: "shut" } | { readonly _tag: "asking" } | Answer

export function Sessions(props: { readonly chat: Chat }) {
  const [picker, setPicker] = createSignal<Picker>({ _tag: "shut" })

  const toggle = () => {
    if (picker()._tag !== "shut") {
      setPicker({ _tag: "shut" })
      return
    }
    setPicker({ _tag: "asking" })
    void props.chat.sessions().then((answer) => {
      // Ignore an answer that arrived after the popover was shut: the reader
      // moved on, and re-opening it asks again.
      if (picker()._tag === "asking") setPicker(answer)
    })
  }

  const current = () => props.chat.state().session?.id ?? null

  return (
    <div class="relative">
      <button
        type="button"
        class="rounded border border-rule px-2 py-1 text-xs text-muted hover:text-ink"
        data-testid={TESTID.chatSessions}
        aria-expanded={picker()._tag !== "shut"}
        onClick={toggle}
      >
        chats
      </button>

      <Show when={picker()._tag !== "shut"}>
        <ul
          class="absolute right-0 top-full z-50 mt-1 max-h-80 w-80 list-none overflow-y-auto rounded border border-rule bg-paper p-1 shadow-lg"
          data-testid={TESTID.chatSessionList}
        >
          {/* A `<Switch>` over the one signal, because the picker IS one: the
              three things it can be showing are the three arms of the union
              above, and drawing them as siblings that each test the tag would
              be the exclusivity spelled again in a second place. "Refused" was
              the arm that did not exist, and an empty list was standing in for
              it. `asking` is the FALLBACK rather than a third `<Match>`: it is
              the state the popover opens in and the one nothing has answered
              yet, so it is what is left rather than something to test for. */}
          <Switch
            fallback={<li class="px-2 py-1 text-xs text-muted">asking the agent…</li>}
          >
            <Match when={refusedIn(picker())}>
              {(failure) => (
                <li class="px-2 py-1" data-testid={TESTID.chatSessionsRefused}>
                  <Refusal failure={failure()} />
                </li>
              )}
            </Match>
            <Match when={listedIn(picker())}>
              {(sessions) => (
                <Show
                  when={sessions().length > 0}
                  fallback={
                    <li class="px-2 py-1 text-xs text-muted">no stored conversations</li>
                  }
                >
                  <For each={sessions()}>
                    {(session) => (
                      <li>
                        <button
                          type="button"
                          class="block w-full truncate rounded px-2 py-1 text-left text-xs hover:bg-rule"
                          data-testid={TESTID.chatSession}
                          data-session-id={session.id}
                          data-current={session.id === current()}
                          disabled={session.id === current()}
                          onClick={() => {
                            setPicker({ _tag: "shut" })
                            props.chat.loadSession(session.id)
                          }}
                        >
                          <span class={session.id === current() ? "text-accent" : ""}>
                            {session.title ?? session.id}
                          </span>
                          <Show when={session.updatedAt}>
                            {(at) => (
                              <span class="ml-2 font-mono text-[0.625rem] text-muted">
                                {at().slice(0, 10)}
                              </span>
                            )}
                          </Show>
                        </button>
                      </li>
                    )}
                  </For>
                </Show>
              )}
            </Match>
          </Switch>
        </ul>
      </Show>
    </div>
  )
}

/** The sessions, when there are some — `undefined` in the states that have
 *  none, which is what `<Show>` takes. */
const listedIn = (picker: Picker): ReadonlyArray<SessionInfo> | undefined =>
  picker._tag === "listed" ? picker.sessions : undefined

/** Why there is no list, when that is the answer. */
const refusedIn = (picker: Picker): OpFailure | undefined =>
  picker._tag === "refused" ? picker.failure : undefined
