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
 * SUBAGENT LANES are the one thing this file decides about a row rather than
 * delegating. A tool call a spawned agent made carries the `Agent` frame it
 * belongs to ({@link ../../../../surface/src/chat.ts}'s `ChatEntry.parent`),
 * and it is drawn indented behind a rail under that frame — but whether the
 * lane has to NAME itself depends on the row above, which is a fact about the
 * list and about nothing else. {@link ./lanes.ts} is that rule; this file is
 * where the only reader of it lives.
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

import { createMemo, For, onCleanup, onMount, Show } from "solid-js"

import { useShowNode } from "../focus.ts"
import { TESTID } from "../testids.ts"
import { Entry } from "./Entry.tsx"
import { laneOf } from "./lanes.ts"
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

  /** An id the agent named, pressed — shown, or nothing when the press landed
   *  on the words around one.
   *
   *  ONE listener on the pane rather than a handler per span, because the spans
   *  are inside rendered markdown and belong to no component: the same
   *  arrangement a relative link between two documents has on the main pane,
   *  for the same reason. The panel's OWN references are buttons and do not
   *  come through here (`./Reference.tsx`); both ends call the same
   *  `useShowNode`.
   *
   *  It answers whether it CLAIMED the press, so the keyboard half below can
   *  preventDefault on exactly the presses it took rather than asking the same
   *  question twice about one event. */
  const pressed = (target: EventTarget | null): boolean => {
    const id = nodeRefIn(target)
    if (id === null) return false
    show(id)
    return true
  }

  return (
    <div
      class="min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-3 py-2"
      data-testid={TESTID.chatTranscript}
      ref={pane}
      onScroll={() => {
        following = atBottom()
      }}
      onClick={(event) => {
        pressed(event.target)
      }}
      // The keyboard's half of the same control: a marked span is given
      // `role="button"` and a tab stop (`./refs.ts`), and those two promise
      // Enter and Space do what a click does. Space scrolls a pane it is
      // pressed in, which is exactly the pane this is — so the default is
      // prevented for the presses this took, and left alone for the rest.
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return
        if (pressed(event.target)) event.preventDefault()
      }}
    >
      {/* A wrapper with no styling of its own, purely so there is something
          whose HEIGHT can be observed: the pane's own size never changes, and
          it is the content inside it that grows. */}
      <div class="min-w-0" ref={content}>
        <For each={props.chat.rows()}>
          {(key, index) => {
            const entry = props.chat.entry(key)
            /** The row drawn directly ABOVE this one, and the only thing a
             *  lane needs that a row cannot see for itself — which is the
             *  whole reason the lane is decided out here rather than inside
             *  `Entry`. */
            const above = createMemo(() => {
              const previous = props.chat.rows()[index() - 1]
              return previous === undefined
                ? undefined
                : props.chat.entry(previous)()
            })
            const lane = createMemo(() => laneOf(entry(), above()))
            /** What to call the agent whose lane this is: the `Agent` frame's
             *  own title, which for this adapter is the description the call
             *  was made with — "find every call site", "review the diff". A
             *  frame we have not been sent is drawn as the bare fact, because
             *  "a subagent did this" is still the thing worth saying. */
            const named = () => {
              const parent = lane()?.parent
              return (parent === undefined
                ? undefined
                : props.chat.entry(parent)()?.text) ?? "a subagent"
            }
            return (
              <Show when={entry()}>
                {(row) => (
                  /* The lane is a WRAPPER rather than a branch, so a row that
                     learns whose it is on its second frame moves into the lane
                     without being drawn again from scratch — the same rule the
                     row list itself follows, one level down.

                     `-mt-2 pt-2` on a continuing row is the rail closing the
                     gap the row above left under itself: rows are spaced by a
                     margin, and a rail drawn per row would otherwise come out
                     as a column of dashes rather than as one line. A row that
                     OPENS a lane keeps the gap — there is a new lane starting,
                     and it is allowed to begin somewhere. */
                  <div
                    class={lane() === null
                      ? undefined
                      : `border-l-2 border-muted/70 pl-2 ${
                        lane()?.labelled === true ? "mt-1" : "-mt-2 pt-2"
                      }`}
                    data-testid={lane() === null ? undefined : TESTID.chatLane}
                    data-lane={lane()?.parent}
                  >
                    {/* Once per stretch of one agent's work, not once per call
                        it makes — see `./lanes.ts`. */}
                    <Show when={lane()?.labelled === true}>
                      <p
                        class="mb-1 flex min-w-0 items-center gap-1 font-mono text-[0.6875rem] text-muted"
                        data-testid={TESTID.chatLaneLabel}
                      >
                        <span aria-hidden="true">↳</span>
                        <span class="min-w-0 truncate">{named()}</span>
                      </p>
                    </Show>
                    <Entry entry={row()} chat={props.chat} />
                  </div>
                )}
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
