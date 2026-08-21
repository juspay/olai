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
 * delegating. A row a spawned agent produced carries the `Agent` frame it
 * belongs to ({@link ../../../../surface/src/chat.ts}'s `ChatEntry.parent`) —
 * a tool call it made, or a question it stopped to ask — and it is drawn
 * indented behind a rail under that frame. Whether the lane has to NAME itself
 * is {@link ./lanes.ts}'s rule; this file is where the only reader of it
 * lives, and the lane is a WRAPPER around whatever the row turns out to be, so
 * a kind of row learning it belongs to a subagent needs nothing here.
 *
 * A LANE ALSO OPENS WITH NOTHING IN IT, and that is the same drawing decided
 * from the other end. Every rail above is hung off work a subagent has already
 * done, so an agent that has been sent out and has not called anything yet had
 * no rail, no name and no dot — nothing but the spawning call's own pending
 * row, which reads as an ordinary tool being slow. The row that SPAWNED an
 * agent carries what is known about it ({@link ./spawn.ts}), so the rail can
 * drop out of that row immediately and say what the agent is doing; when the
 * calls arrive they land in the lane already open under it.
 *
 * WHETHER ANYTHING IS RUNNING is the other thing decided out here, and it is
 * decided ONCE for the whole list. Two faces need it and neither row can see
 * it: the rail under a spawn ({@link ./spawn.ts}) and the elapsed readout on a
 * running call's own line ({@link ./elapsed.ts}). It is a fact about the
 * CONVERSATION — a status is sticky and a dead agent's last call says `pending`
 * forever — so a row asked on its own would keep both of those alive under a
 * process that no longer exists. The clock the readouts tick against hangs off
 * the same answer, and runs only while it is true.
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
 *
 * OPENING A CONVERSATION is not that question. The session id is the
 * conversation's identity; when it changes (or first appears) the reader has
 * just opened this chat, and the newest line is where they start. following is
 * reset so a scroll-away in the previous conversation cannot leave this one
 * stuck at the top. The jump is instant — assigning `scrollTop`, no animation
 * — because an open is a place, not a motion.
 *
 * The jump is not a reader scroll, but the event it schedules cannot be
 * ignored with a flag around the assignment: Chromium (149, and the suite's
 * Playwright) dispatches `scroll` asynchronously, at a rendering update, so
 * a boolean held across the write is already false when the handler runs.
 * What we remember instead is the `scrollTop` we assigned. An event that
 * lands on that value is our jump — or growth that did not move the top —
 * and if a follow is still owed and we are no longer at the bottom, the
 * handler re-jumps rather than stamping following false. An event that
 * lands somewhere else is the reader.
 */

import { createEffect, createMemo, For, on, onCleanup, onMount, Show } from "solid-js"

import { SaidLine } from "../SaidLine.tsx"
import { useShowNode } from "../focus.ts"
import { useFollow } from "../router.tsx"
import { TESTID } from "../testids.ts"
import { declaringFailure } from "./declared.ts"
import { createTicking, elapsedOf } from "./elapsed.ts"
import { Entry } from "./Entry.tsx"

import { laneOf, RAIL } from "./lanes.ts"
import { LIVE_DOT } from "./live.ts"
import { NEAR } from "./near.ts"
import { nodeRefIn } from "./refs.ts"
import { Refusal } from "./Refusal.tsx"
import { doingOf } from "./spawn.ts"
import type { Chat } from "./state.ts"

export function Transcript(props: { readonly chat: Chat }) {
  const show = useShowNode()
  const follow = useFollow()
  let pane: HTMLDivElement | undefined
  let content: HTMLDivElement | undefined
  /** Should new text pull the view down with it? True until the reader scrolls
   *  away from the bottom, and true again the moment they come back. */
  let following = true
  /** The `scrollTop` we last assigned. A later `scroll` event that still sits
   *  here is our jump, not the reader — the event is dispatched after the
   *  assignment returns, so a boolean around the write cannot see it. */
  let assignedTop = Number.NaN

  const atBottom = (): boolean =>
    pane !== undefined &&
    pane.scrollHeight - pane.scrollTop - pane.clientHeight < NEAR

  const jump = (): void => {
    if (pane === undefined) return
    pane.scrollTop = pane.scrollHeight
    assignedTop = pane.scrollTop
  }

  onMount(() => {
    if (content === undefined) return
    // Content growing does NOT move `scrollTop`, so the browser fires no scroll
    // event for it. New text is followed from here. The jump's own `scroll`
    // arrives later and is recognised by `assignedTop`, not by a flag.
    const grown = new ResizeObserver(() => {
      if (following) jump()
    })
    grown.observe(content)
    onCleanup(() => grown.disconnect())
  })

  // Opening a conversation is not "new text arrived while reading". The
  // session id is the conversation's identity; when it changes, the newest
  // line is where the reader starts — even if they had scrolled away in the
  // conversation they just left.
  createEffect(
    on(
      () => props.chat.state().session?.id,
      () => {
        following = true
        jump()
      },
    ),
  )

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
   * not an agent was ever spawned. This rebuilds on exactly the ticks the
   * ORDER moves on — a row arriving or leaving — and on none of the frames
   * that merely grow a row, which is a fact about {@link ./order.ts}'s fold
   * rather than a hope about this memo: the list it hands back on a frame that
   * moved nothing is the very array it handed back last time, so nothing here
   * wakes.
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

  /**
   * Whether anything is running in this conversation at all — the half of "is
   * that agent still going" that a ROW cannot answer ({@link ./spawn.ts}).
   *
   * ONE memo for the whole list rather than one per row, and a BOOLEAN rather
   * than the state: every row's rail would otherwise subscribe to the chat
   * cell, which moves several times a turn as the context usage is revised, and
   * re-run for each of them. A boolean propagates only when it flips.
   */
  const live = createMemo(() => props.chat.state().status === "thinking")

  /** The clock the elapsed readouts are drawn against — ONE for the panel, and
   *  it runs only while `live` says there is something to time
   *  ({@link ./elapsed.ts}). A ticker per row would be one timer per tool call
   *  of a long conversation, all of them saying the same thing a beat apart. */
  const now = createTicking(live)

  return (
    <div
      class="olai-scroll min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-3 py-2 text-ink"
      data-testid={TESTID.chatTranscript}
      ref={pane}
      onScroll={() => {
        if (pane === undefined) return
        // Same top we assigned: our jump's late event, or growth that left
        // the top alone. If a follow is still owed and we are no longer at
        // the bottom, more content landed after the assignment — re-jump
        // rather than decide the reader left.
        if (Number.isFinite(assignedTop) && Math.abs(pane.scrollTop - assignedTop) < 1) {
          if (following && !atBottom()) jump()
          return
        }
        following = atBottom()
      }}
      // A press the chips decline is still a press on the agent's markdown, and
      // an anchor in there is an address in this vault: a `.md` link the
      // renderer resolved (`../markdown/rewrite.ts`) or an app path the agent
      // wrote. This panel is mounted BESIDE the panes, so nothing above it was
      // ever going to catch one — they fell to the browser and reloaded the app
      // cold. `useFollow` is the pane's own tail, and it lands in the focused
      // pane, which is where a link pressed in a drawer belongs.
      onClick={(event) => {
        if (pressed(event.target)) return
        follow(event)
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
            /** The live rail under a spawn — what a running subagent looks
             *  like before it has made a call to draw a lane out of.
             *
             *  `null` for every row that spawned nobody, for a spawn that has
             *  stopped, and for one whose CONVERSATION has, so the same memo
             *  answers both "is there anything to draw" and "what does it say"
             *  ({@link ./spawn.ts}). */
            const working = createMemo(() => doingOf(entry(), live()))
            /** How long this call has been going, or `null` for a row with
             *  nothing to time — which is every row of an idle conversation,
             *  every row that is not a running call, and every call younger
             *  than the panel's quiet threshold ({@link ./elapsed.ts}).
             *
             *  The clock is passed UNREAD, as the accessor: a memo that read it
             *  here would make every row of the transcript a subscriber to a
             *  once-a-second tick, to answer `null` for all but one of them. */
            const elapsed = createMemo(() => elapsedOf(entry(), live(), now))
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
                    classList={{
                      [RAIL]: lane() !== null,
                      // ... unless the rail below is carrying it instead, so
                      // that one line crosses the gap rather than stopping at
                      // the edge of this box and starting again inside it.
                      "pb-2": working() === null,
                    }}
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
                    <Entry entry={row()} chat={props.chat} elapsed={elapsed()} />
                    {/* THE LANE, OPENED BY THE SPAWN ITSELF — a rail dropping
                        out of the frame the moment an agent is sent out,
                        rather than one that appears whenever the agent
                        eventually greps something. It carries the gap to the
                        next row (`pb-2`, taken off the wrapper above) so the
                        rail runs down through it and meets the first call's
                        own rail as one line, which is the same reason that
                        gap is padding rather than a margin — and it is the
                        same `RAIL`, from the module that owns what a lane
                        looks like, so "meets as one line" is held by one
                        spelling rather than by two that happen to agree.

                        The pulsing dot is the header's, by import: a turn in
                        flight and an agent in flight are the same kind of
                        fact, and a panel with two spellings of "this is
                        happening" is a panel with one of them to learn. */}
                    <Show when={working()}>
                      {(doing) => (
                        <div class={`${RAIL} pb-2 pt-1`}>
                          {/* The NAME is on the words rather than on the rail
                              around them, so that what a scenario measures is
                              what a reader sees inset — the rail's own box
                              starts at the row's left edge, and asserting on
                              that would pass on a build that had lost the
                              indent entirely. */}
                          <p
                            class="flex items-center gap-1 font-mono text-[0.6875rem] text-doing"
                            data-testid={TESTID.chatSpawnWorking}
                            data-lane={row().id}
                            aria-live="polite"
                          >
                            <span class={LIVE_DOT} aria-hidden="true" />
                            {doing()}
                          </p>
                        </div>
                      )}
                    </Show>
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

        {/* THE ID LOOKUP'S OWN BAD NEWS, once for the pane. Which of the
            agent's backticks are nodes is a call now ({@link ./declared.ts}),
            and a call that did not arrive must not read as prose that named
            none of them (HACKING.md — an error reaches somebody). The words are
            untouched and every span still says what the agent wrote; what is
            missing is which of them can be pressed.

            HERE rather than under the message, because the CALL is the pane's:
            one question carries the ids of every message on screen, so a line
            per message would put the same sentence under eighty paragraphs of a
            conversation that had just opened. It is not the refusal row above
            either — a refused WRITE is something that did not happen, and this
            is a question about something that did. */}
        <Show when={declaringFailure()}>
          {(why) => (
            <SaidLine
              said={{ tone: "alarm", text: `some ids could not be looked up — ${why()}` }}
              class="m-0 mt-2 font-mono text-xs"
              testid={TESTID.chatRefsFailure}
            />
          )}
        </Show>

      </div>
    </div>
  )
}
