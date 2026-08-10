/**
 * The conversation, drawn.
 *
 * One `<For>` over the row KEYS, with each row's value read lazily inside it —
 * the framework's own shape (`@kolu/surface`'s fleet-top example), and
 * `state.ts` says why it is the one to follow.
 *
 * `<Show>` is deliberately UNKEYED: it re-renders when the value appears or
 * goes away, not when it changes, so the row component stays mounted across
 * every update and only the text inside it moves.
 *
 * Scroll follows the bottom while the reader is already there and leaves them
 * alone when they are not. A panel that yanked you back to the newest token
 * while you were reading what the agent did two turns ago would be worse than
 * one that never scrolled at all.
 */

import { createEffect, For, Show } from "solid-js"

import { TESTID } from "../testids.ts"
import { Entry } from "./Entry.tsx"
import { Refusal } from "./Refusal.tsx"
import type { Chat } from "./state.ts"

/** How close to the bottom still counts as "at the bottom". Anything under a
 *  line or two of slack and a smooth scroll mid-flight reads as "the reader
 *  scrolled away". */
const NEAR = 64

export function Transcript(props: { readonly chat: Chat }) {
  let pane: HTMLDivElement | undefined

  createEffect(() => {
    // Depend on the rows, so this runs after every frame.
    props.chat.rows()
    const at = pane
    if (at === undefined) return
    const atBottom = at.scrollHeight - at.scrollTop - at.clientHeight < NEAR
    if (atBottom) at.scrollTop = at.scrollHeight
  })

  return (
    <div
      class="flex-1 overflow-y-auto px-3 py-2"
      data-testid={TESTID.chatTranscript}
      ref={pane}
    >
      <For each={props.chat.rows()}>
        {(key) => {
          const entry = props.chat.entry(key)
          return <Show when={entry()}>{(row) => <Entry entry={row()} />}</Show>
        }}
      </For>

      <Show when={props.chat.refused()}>
        {(failure) => (
          <div class="mt-2" data-testid={TESTID.chatRefused}>
            <Refusal failure={failure()} />
          </div>
        )}
      </Show>

      <Show when={props.chat.state().trouble}>
        {(trouble) => (
          <p class="mt-2 text-xs text-alarm" data-testid={TESTID.chatTrouble}>
            {trouble()}
          </p>
        )}
      </Show>
    </div>
  )
}
