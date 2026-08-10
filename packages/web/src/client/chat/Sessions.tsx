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

export function Sessions(props: { readonly chat: Chat }) {
  const [open, setOpen] = createSignal(false)
  const [listed, setListed] = createSignal<ReadonlyArray<SessionInfo>>([])
  const [asking, setAsking] = createSignal(false)

  const toggle = () => {
    if (open()) {
      setOpen(false)
      return
    }
    setOpen(true)
    setAsking(true)
    void props.chat.sessions().then((sessions) => {
      setListed(sessions)
      setAsking(false)
    })
  }

  const current = () => props.chat.state().session?.id ?? null

  return (
    <div class="relative">
      <button
        type="button"
        class="rounded border border-rule px-2 py-1 text-xs text-muted hover:text-ink"
        data-testid={TESTID.chatSessions}
        aria-expanded={open()}
        onClick={toggle}
      >
        chats
      </button>

      <Show when={open()}>
        <ul
          class="absolute right-0 top-full z-50 mt-1 max-h-80 w-80 list-none overflow-y-auto rounded border border-rule bg-paper p-1 shadow-lg"
          data-testid={TESTID.chatSessionList}
        >
          <Show
            when={!asking()}
            fallback={<li class="px-2 py-1 text-xs text-muted">asking the agent…</li>}
          >
            <Show
              when={listed().length > 0}
              fallback={
                <li class="px-2 py-1 text-xs text-muted">no stored conversations</li>
              }
            >
              <For each={listed()}>
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
                        setOpen(false)
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
          </Show>
        </ul>
      </Show>
    </div>
  )
}
