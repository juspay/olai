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

  /**
   * What is drawn above what, for the whole list at once.
   *
   * A lane needs the row above it and a row cannot see one, so this is the
   * list answering on its behalf — ONCE, rather than each row reaching back
   * into the list by position. That is the cheaper shape as well as the
   * honester one: `<For>` only keeps a signal per row for the index when the
   * mapper asks for one, and every conversation would pay for that whether or
   * not an agent was ever spawned. This rebuilds on exactly the ticks the sort
   * already runs on — a row arriving or leaving — and on none of the frames
   * that merely grow a row.
   */
  const previousOf = createMemo(() => {
    const order = props.chat.rows()
    const previous = new Map<string, string>()
    for (let at = 1; at < order.length; at++) {
      const key = order[at]
      const before = order[at - 1]
      if (key !== undefined && before !== undefined) previous.set(key, before)
    }
    return previous
  })

  /** What the transcript calls the row under a key — for a lane, the `Agent`
   *  frame's own title, which for this adapter is the description the call was
   *  made with ("find every call site", "review the diff"). One function for
   *  the whole list rather than one built per row per frame. */
  const titleOf = (key: string): string | undefined => props.chat.entry(key)()?.text

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
          {(key) => {
            const entry = props.chat.entry(key)
            /** The row drawn directly ABOVE this one, and the only thing a
             *  lane needs that a row cannot see for itself — which is the
             *  whole reason the lane is decided out here rather than inside
             *  `Entry`.
             *
             *  Its own memo rather than folded into the lane below, and that
             *  is a reactivity decision rather than a stylistic one: what
             *  comes out is an ENTRY, whose identity survives a frame (the
             *  collection reconciles in place), so a re-run here stops here.
             *  Reading the row list straight into the lane would tie every
             *  lane to the list instead — and a lane is a fresh object every
             *  time it is computed, so one row arriving would re-run the
             *  attribute effects of every row already on screen. */
            const above = createMemo(() => {
              const previous = previousOf().get(key)
              return previous === undefined
                ? undefined
                : props.chat.entry(previous)()
            })
            const lane = createMemo(() => laneOf(entry(), above(), titleOf))
            return (
              <Show when={entry()}>
                {(row) => (
                  /* The row's own box, and THE GAP UNDER IT — which is here
                     rather than on the row because a rail has to be able to
                     cross it. Padding, not a margin: a border is drawn around
                     padding and outside a margin, so a lane's rail reaches
                     from its row down through the space to the next one and
                     the run comes out as one line rather than a column of
                     dashes. It used to be a margin on the row and a matching
                     negative here, which was the same picture drawn by two
                     files agreeing about a number.

                     The lane is a WRAPPER rather than a branch, so a row that
                     learns whose it is on its second frame moves into the lane
                     without being drawn again from scratch — the same rule the
                     row list itself follows, one level down. */
                  <div
                    class={lane() === null
                      ? "pb-2"
                      : "border-l-2 border-muted/70 pb-2 pl-2"}
                    data-testid={lane() === null ? undefined : TESTID.chatLane}
                    data-lane={lane()?.parent}
                  >
                    {/* Once per stretch of one agent's work, not once per call
                        it makes — see `./lanes.ts`. */}
                    <Show when={lane()?.label}>
                      {(label) => (
                        <p
                          class="mb-1 flex min-w-0 items-center gap-1 font-mono text-[0.6875rem] text-muted"
                          data-testid={TESTID.chatLaneLabel}
                        >
                          <span aria-hidden="true">↳</span>
                          <span class="min-w-0 truncate">{label()}</span>
                        </p>
                      )}
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
