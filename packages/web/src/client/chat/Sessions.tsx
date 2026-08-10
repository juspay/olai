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

import { createSignal, For, Show } from "solid-js"

import { TESTID } from "../testids.ts"
import type { Chat } from "./state.ts"
import type { SessionInfo } from "@olai/surface"

/**
 * The picker is a small state machine, and it is ONE signal because it is one
 * fact: shut, asking, or showing what came back.
 *
 * Spread over an `open` boolean, an `asking` boolean and a list, three of the
 * eight combinations are unreachable and nothing says so — "asking while shut"
 * and "a list while asking" are states the type would admit and the code would
 * have to remember not to enter.
 */
type Picker = { readonly _tag: "shut" } | { readonly _tag: "asking" } | {
  readonly _tag: "listed"
  readonly sessions: ReadonlyArray<SessionInfo>
}

export function Sessions(props: { readonly chat: Chat }) {
  const [picker, setPicker] = createSignal<Picker>({ _tag: "shut" })

  const toggle = () => {
    if (picker()._tag !== "shut") {
      setPicker({ _tag: "shut" })
      return
    }
    setPicker({ _tag: "asking" })
    void props.chat.sessions().then((sessions) => {
      // Ignore an answer that arrived after the popover was shut: the reader
      // moved on, and re-opening it asks again.
      if (picker()._tag === "asking") setPicker({ _tag: "listed", sessions })
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
          <Show
            when={listedIn(picker())}
            fallback={<li class="px-2 py-1 text-xs text-muted">asking the agent…</li>}
          >
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
          </Show>
        </ul>
      </Show>
    </div>
  )
}

/** The sessions, when there are some — `undefined` in the two states that have
 *  none, which is what `<Show>` takes. */
const listedIn = (picker: Picker): ReadonlyArray<SessionInfo> | undefined =>
  picker._tag === "listed" ? picker.sessions : undefined
