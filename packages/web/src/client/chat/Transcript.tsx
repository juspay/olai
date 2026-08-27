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
 * THIS COLUMN IS THE MAIN AGENT'S, and that is the one thing about membership
 * this file no longer decides — because it can no longer be decided per row.
 * A tool call a spawned agent made is filed under the agent that made it
 * ({@link ./lanes.ts}'s `filedUnder`) and is drawn where that agent is drawn,
 * which is a shelf above this pane ({@link ./Preview.tsx}). What reaches
 * `props.chat.rows()` is already the column: the fold that puts the
 * conversation in order is where the two lists are cut ({@link ./order.ts}),
 * once, because a `.filter()` here would be a fresh array on every token an
 * agent streams.
 *
 * WHAT IS STILL DRAWN IN A LANE HERE is a QUESTION a subagent asked. It is not
 * that agent's chatter — it is a question to the reader, it blocks the turn,
 * and a form behind a click is a turn that hangs forever — so it stays in the
 * column with the rail and the name that say who is asking. Whether a lane has
 * to NAME itself is still {@link ./lanes.ts}'s rule; this file is still where
 * its only reader lives; and the lane is still a WRAPPER around whatever the
 * row turns out to be ({@link ./Row.tsx}), which is what lets the shelf draw
 * the very same rows behind the very same rail.
 *
 * A LANE ALSO OPENS WITH NOTHING IN IT, and that is the same drawing decided
 * from the other end. Every rail here is hung off the SPAWNING row rather than
 * off work a subagent has already done, so an agent that has been sent out and
 * has not called anything yet still has a rail, a name and a dot — where before
 * it had nothing but a pending row that read as an ordinary tool being slow.
 * The row that SPAWNED an agent carries what is known about it
 * ({@link ./spawn.ts}); under that, once there is anything to read, is that
 * agent's DOOR ({@link ./door.ts}) — which is the half the fan-out change owes,
 * since the record it opens is no longer under the rail where it used to be.
 *
 * WHETHER A TURN IS IN FLIGHT is no longer decided here, and the move is what
 * this feature forced. The shelf draws tool rows too; every tool row asks for
 * the elapsed reading in its own body; and that lookup THROWS outside the
 * provider. So the provider went up, to the panel that mounts the strip, the
 * shelf and this pane ({@link ./Panel.tsx}) — which is also what
 * {@link ./elapsing.tsx} always claimed it was: ONE clock for the panel. Two
 * providers would be two timers and two subscriptions to a chat cell that moves
 * several times a turn.
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
import { selector, TESTID } from "../testids.ts"
import { revealed, revealing, wholeYet } from "./attention/reveal.ts"
import { declaringFailure } from "./declared.ts"
import { doorOf } from "./door.ts"
import { laneOf } from "./lanes.ts"
import { NEAR } from "./near.ts"
import { isPreviewing, togglePreview } from "./previewing.ts"
import { railOf, sameRail } from "./rail.ts"
import { nodeRefIn } from "./refs.ts"
import { Refusal } from "./Refusal.tsx"
import { Row } from "./Row.tsx"
import { whoOf } from "./spawn.ts"
import type { Chat } from "./state.ts"

/** A question still waiting on somebody — `./AskForm.tsx`'s row with its own
 *  flag still on. The one thing a press of the attention banner is looking
 *  for, spelled off the panel's own declared handles rather than off a class. */
const WAITING_ASK = `${selector(TESTID.chatAsk)}[data-asking="true"]`

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
    if (content === undefined || pane === undefined) return
    // Content growing does NOT move `scrollTop`, so the browser fires no scroll
    // event for it. New text is followed from here. The jump's own `scroll`
    // arrives later and is recognised by `assignedTop`, not by a flag.
    const grown = new ResizeObserver(() => {
      if (following) jump()
    })
    grown.observe(content)
    // ... AND THE PANE ITSELF, which is the same fact from the other end and was
    // missing. Something above the transcript can take room away from it —
    // a shelf opening onto a subagent's calls ({@link ./Preview.tsx}), the
    // strip wrapping to a third line as a fan-out grows, the phone's sheet
    // moving between its snaps — and a SHORTER pane leaves `scrollTop` exactly
    // where it was while the bottom moves away from it. No scroll event (the
    // top did not move, and shrinking a scroller only raises its maximum) and
    // no content event (the content's own box is unchanged), so a reader who
    // was at the bottom silently is not any more, with their own last message
    // under the fold. The rule is the one this file already keeps — a follow
    // that is owed is honoured whenever the geometry moves — and it was only
    // ever watching half the geometry.
    grown.observe(pane)
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

  /**
   * SOMEBODY PRESSED THE BANNER, and this is the half of that press the
   * service worker cannot do: it focuses the window and `./attention/reveal.ts`
   * opens the panel, and what is left is putting the question on screen.
   *
   * It cannot be done at the press. The panel was shut, so opening it is what
   * MOUNTS this component, and the rows land later still on a subscription
   * that has only just opened — so the request outlives the press and is taken
   * up here, when there is a conversation to take it up with. The effect reads
   * the row list, which is what wakes it again as the transcript arrives.
   *
   * A conversation with no waiting form in it is an ordinary outcome, not an
   * error: the question was answered in another tab between the banner and the
   * press. The foot of the conversation is the answer to that, which is where
   * an open lands anyway.
   *
   * BUT NOT YET IS NOT THE SAME AS THERE IS NONE, and the two look identical
   * from here: rows are KEYS, and a key is in the list before its value is, so
   * a form that has not been drawn yet and a form that was answered elsewhere
   * both querySelect to nothing. Spent on the first, the press becomes a jump
   * to the foot of a conversation whose question is further up. So the request
   * only lets go once the form is FOUND or the conversation has arrived whole
   * ({@link ./attention/reveal.ts}'s `wholeYet`) — and reading the values is
   * what wakes this again as they land.
   *
   * Cleared once one of those two is true, so a request nobody could answer
   * cannot sit there and hijack a row that lands ten minutes later. Following
   * is restored either way — a press is a person arriving at the conversation,
   * like opening it.
   */
  createEffect(() => {
    if (!revealing()) return
    const waiting = pane?.querySelector(WAITING_ASK) ?? null
    // Nothing to show and the conversation is still arriving: stay asked. The
    // `wholeYet` read subscribes this to the first row it is waiting on, so
    // that row landing is what brings it back.
    if (waiting === null && !wholeYet(props.chat.rows(), (key) => props.chat.entry(key)())) {
      return
    }
    following = true
    if (waiting === null) jump()
    else waiting.scrollIntoView({ block: "center" })
    revealed()
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

  return (
    <div
      // A FLOOR, and it is about a shelf rather than about this pane. What can
      // take room away from the conversation is above it — the strip wrapping
      // as a fan-out grows, a preview of one agent’s calls opening — and every
      // one of those is a strip that yields before this does. This is the other
      // half of that promise, spelled where it is load-bearing: a question a
      // subagent asked is drawn HERE, in the column, because a form behind a
      // click is a turn that hangs forever — and a pane squeezed to nothing is
      // a click of a different kind.
      class="olai-scroll min-h-[7rem] min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-3 py-2 text-ink"
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
            /** ... and the live RAIL under this row, whichever of the two it
             *  is: a spawned agent still out, or a background task still
             *  running ({@link ./rail.ts}, which owns the precedence and
             *  carries the words together with the face they belong to).
             *
             *  Its own equality, because the answer is an OBJECT now and a
             *  memo over one stops nothing by default: a row that recomputes
             *  an identical rail would notify the attributes and the words
             *  under it on every frame of that row. */
            const working = createMemo(() => railOf(entry()), null, { equals: sameRail })
            /**
             * HOW MUCH IS BEHIND THIS ROW'S DOOR — the number of calls the
             * agent it sent has made, and `0` for every row that sent nobody.
             *
             * THE ROW IS READ BEFORE THE LIST IS, and the order is the whole
             * of why this is cheap. `whoOf` is a fact about this row alone; a
             * memo that answers on it and returns never touches `lanes()`, so
             * it never subscribes to it — and a conversation's three hundred
             * and ninety-seven non-spawn rows go on waking only when they
             * themselves change, which is the property `./spawn.ts` records
             * having deliberately bought. Only the three rows that sent
             * somebody join the list-wide signal, and what leaves this memo is
             * a NUMBER, so a re-run stops here the way `above`'s does.
             */
            const calls = createMemo(() => {
              if (whoOf(entry()) === null) return 0
              return props.chat.lanes().get(key)?.length ?? 0
            })
            return (
              <Show when={entry()}>
                {(row) => (
                  <Row
                    entry={row()}
                    chat={props.chat}
                    lane={lane()}
                    rail={working()}
                    door={calls() > 0 ? () => togglePreview(key) : null}
                    says={doorOf(entry(), calls())}
                    open={isPreviewing(key)}
                  />
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
