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
 * FOLLOWING THE BOTTOM is the other half of this file, and it is two questions
 * that were being answered as one:
 *
 *   - **is the reader following?** A decision they make by scrolling, so it is
 *     recorded when they scroll and at no other time. It used to be re-derived
 *     from the scroll position AFTER new content had already been added — by
 *     which point a paragraph taller than the slack had pushed the bottom out
 *     of reach, the answer came back "not following", and the panel stopped
 *     following at exactly the moment there was something to follow.
 *   - **has anything arrived?** A `ResizeObserver` on the content, because the
 *     thing that grows is not the thing the row list reports. Rows are KEYS,
 *     so the list is unchanged while an answer streams into a row that already
 *     exists — an effect watching it fires once for the paragraph and never
 *     again for the four hundred tokens that fill it.
 *
 * Leaving a reader alone when they have scrolled away is the part worth
 * keeping: being yanked to the newest token while reading what the agent did
 * two turns ago is worse than a panel that never scrolled at all.
 */

import { For, onCleanup, onMount, Show } from "solid-js"

import { useShowNode } from "../focus.ts"
import { TESTID } from "../testids.ts"
import { Entry } from "./Entry.tsx"
import { nodeRefIn } from "./refs.ts"
import { Refusal } from "./Refusal.tsx"
import type { Chat } from "./state.ts"

/** How close to the bottom still counts as "at the bottom". Anything under a
 *  line or two of slack and a smooth scroll mid-flight reads as "the reader
 *  scrolled away". */
const NEAR = 64

export function Transcript(props: { readonly chat: Chat }) {
  const show = useShowNode()
  let pane: HTMLDivElement | undefined
  let content: HTMLDivElement | undefined
  /** Should new text pull the view down with it? True until the reader scrolls
   *  away from the bottom, and true again the moment they come back. */
  let following = true

  const atBottom = (): boolean =>
    pane !== undefined &&
    pane.scrollHeight - pane.scrollTop - pane.clientHeight < NEAR

  onMount(() => {
    if (content === undefined) return
    // Content growing does NOT move `scrollTop`, so the browser fires no scroll
    // event for it — which is what makes this safe: every scroll event this
    // component sees is one the reader caused, or the one our own jump below
    // causes, and that one lands at the bottom and agrees.
    const grown = new ResizeObserver(() => {
      if (following && pane !== undefined) pane.scrollTop = pane.scrollHeight
    })
    grown.observe(content)
    onCleanup(() => grown.disconnect())
  })

  /** An id the agent named, pressed. ONE listener on the pane rather than a
   *  handler per span, because the spans are inside rendered markdown and
   *  belong to no component — the same arrangement a relative link between two
   *  documents has on the main pane, for the same reason. The panel's OWN
   *  references are buttons and do not come through here (`./NodeRef.tsx`);
   *  both ends call the same `focusNode`. */
  const pressed = (target: EventTarget | null): void => {
    const id = nodeRefIn(target)
    if (id === null) return
    show(id)
  }

  return (
    <div
      class="flex-1 overflow-y-auto px-3 py-2"
      data-testid={TESTID.chatTranscript}
      ref={pane}
      onScroll={() => {
        following = atBottom()
      }}
      onClick={(event) => pressed(event.target)}
      // The keyboard's half of the same control: a marked span is given
      // `role="button"` and a tab stop (`./refs.ts`), and those two promise
      // Enter and Space do what a click does.
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return
        if (nodeRefIn(event.target) === null) return
        // Space scrolls a pane it is pressed in, which is exactly the pane
        // this is — and the press was aimed at a reference.
        event.preventDefault()
        pressed(event.target)
      }}
    >
      {/* A wrapper with no styling of its own, purely so there is something
          whose HEIGHT can be observed: the pane's own size never changes, and
          it is the content inside it that grows. */}
      <div ref={content}>
        <For each={props.chat.rows()}>
          {(key) => {
            const entry = props.chat.entry(key)
            return (
              <Show when={entry()}>
                {(row) => <Entry entry={row()} chat={props.chat} />}
              </Show>
            )
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
    </div>
  )
}
