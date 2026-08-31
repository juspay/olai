/**
 * ONE SPAWNED AGENT'S OWN WORK — the shelf between the strip above the scroll
 * and the conversation, and what is behind both of the doors onto a subagent.
 *
 * The ruling this exists for (the human, with a screenshot of the panel
 * drowning): *when subagents run, their outputs go to chat interleaved. I don't
 * think this should be the case. Only main agent output comes in chat. But the
 * subagents are pinned at the top, and if the user clicks on them we can
 * perhaps preview their output somehow.* Five agents out is five agents' `cd …
 * && grep …` in one column, in one voice, and the main agent's own words off
 * the top of the screen. So the column is the main agent's ({@link
 * ./lanes.ts}'s `filedUnder`) and this is where the rest went.
 *
 * WHERE IT LIVES, and the three tests it was chosen against:
 *
 *   - **the conversation goes on underneath it.** It is a SIBLING of the
 *     transcript in the panel's own column, never over it: the transcript keeps
 *     its scroll, its follow-the-bottom, and the reveal that scrolls a blocked
 *     form into the middle of the pane ({@link ./attention/reveal.ts}) — all of
 *     which an overlay would have broken silently, since a form centred inside
 *     a pane that is underneath a sheet is a form nobody sees. It also SHRINKS
 *     rather than shoving: it takes a cap of the panel's height and gives the
 *     rest back, and the transcript keeps a floor, so opening a shelf can never
 *     be the thing that leaves a question with nowhere to be drawn.
 *   - **it does not steal the composer.** It is at the top of the panel, and
 *     the room between the last row and the box is spoken for — that is where
 *     the line saying the agent is working goes ({@link ./Busy.tsx}), because
 *     the reader's eye is at the bottom of the transcript where their own
 *     message just landed. A sheet growing from the bottom would cover the one
 *     and push away the other.
 *   - **it survives five agents at once.** The strip is the tab bar: it already
 *     wraps, it already says who is out and for how long, and it is the thing a
 *     person picks FROM. One shelf is open at a time, on purpose — five stacked
 *     shelves would be the transcript's own problem moved up the panel, which
 *     is the problem this feature exists to end.
 *
 * IT IS THE SAME DRAWING, not a second one. Every row in here is rendered by
 * {@link ./Row.tsx}, behind the same rail, with the same fold, the same diff and
 * the same clock as it would have had in the column — which is the whole point
 * of moving it rather than summarising it. What differs is one thing and it is
 * subtraction: the lane does not say its name over and over, because the shelf's
 * own head says it once.
 *
 * WHAT IS NOT IN HERE is that agent's QUESTIONS. A permission form or an
 * elicitation stayed in the transcript ({@link ./lanes.ts} argues why), and it
 * is not copied in here either: one decision drawn as two forms is one of them
 * pressed by somebody who cannot see the other. So a run with a question in it
 * reads as a gap in the calls, and the form is where a form belongs — in the
 * conversation, with the composer, the header and the app's own alerts all
 * pointing at it.
 *
 * ... WHICH IS WHY THIS SURFACE POINTS AT ONE TOO, and the reason is a promise
 * made one document over. `docs/chat.md` says that when the conversation is in
 * front of you, a form ARRIVING IS THE WHOLE OF IT — it lands where you are
 * already looking, the composer says so, and nothing rings, because a
 * notification about something already on your screen is nagging. This shelf
 * put a hole in that: a reader watching an agent work here has their eye on a
 * box that is deliberately not where forms are drawn, the panel counts as open
 * so nothing chimes, and the form lands in a transcript that has just been made
 * smaller. Everything still SAYS a question is waiting — the composer, Busy,
 * the header, the badge — but "where you are already looking" had stopped being
 * true, and that promise is exactly what the brief's own constraint is: the
 * losing case must be impossible rather than unlikely.
 *
 * So the shelf joins the surfaces that point. It draws the notice itself and
 * presses through to the SAME ask the attention banner raises
 * ({@link ./attention/reveal.ts}), which closes this and scrolls the waiting
 * form into the middle of the pane — one gesture, one piece of machinery, and
 * no second copy of the form anywhere.
 */

import { For, Show } from "solid-js"

import type { ChatEntry } from "@olai/surface"

import { TESTID } from "../testids.ts"
import type { Lane } from "./lanes.ts"
import { reveal } from "./attention/reveal.ts"
import { closePreview, previewing } from "./previewing.ts"
import { railOf } from "./rail.ts"
import { Row } from "./Row.tsx"
import { sentOf, whoOf } from "./spawn.ts"
import type { Chat } from "./state.ts"

export function Preview(props: { readonly chat: Chat }) {
  /** WHICH agent, and whether it is one this conversation still has. A key that
   *  named a row of the last conversation — or of a turn that has been cleared
   *  — reads as nothing here rather than as an empty shelf, which is the same
   *  answer as "not open" and needs no second rule to say so. */
  const of = () => {
    const row = previewing()
    if (row === null) return null
    const entry = props.chat.entry(row)()
    return entry === undefined || whoOf(entry) === null ? null : { row, entry }
  }
  return (
    <Show when={of()}>{(open) => <Shelf chat={props.chat} open={open()} />}</Show>
  )
}

function Shelf(props: {
  readonly chat: Chat
  readonly open: { readonly row: string; readonly entry: ChatEntry }
}) {
  const calls = () => props.chat.lanes().get(props.open.row) ?? EMPTY
  /** The lane every row in here is in — MINTED ONCE for the whole shelf rather
   *  than asked of {@link ./lanes.ts} per row, and with no label at all.
   *
   *  That rule answers a question this list does not have. It decides whether
   *  the row ABOVE has already put the reader in this lane, which is what keeps
   *  two interleaved agents apart in one column — and there is one agent here,
   *  named at the top, so every answer it could give is either wrong (the first
   *  row would repeat the head) or the one already known. What the lane is still
   *  FOR is the rail, which is the same rail, from the same module, so a
   *  subagent's calls look the way they have always looked. */
  const lane = (): Lane => ({ parent: props.open.row, label: null })
  /** Whether the turn is blocked on a question — the SERVER's count off the
   *  rows (`ChatState.asking`), which is the same number the composer, the
   *  header and the badge are drawn from. Never this shelf's own reading of the
   *  transcript: a second answer to "is somebody being waited on" is a second
   *  thing free to disagree with the row a person has to press. */
  const asked = () => props.chat.state().asking > 0
  return (
    <section
      // SHRINKABLE, and that is the load-bearing half of the geometry. Every
      // other strip above the scroll is `shrink-0`, which is right for a line
      // or two of standing fact; a shelf that took its cap unconditionally
      // would, on a phone's half-height sheet, resolve the transcript to
      // nothing — and the transcript is where every question a subagent asks
      // is drawn. So the cap is a MAXIMUM, this box yields before the
      // conversation does, and the pane below it keeps a floor of its own.
      class="flex max-h-[45%] min-h-0 shrink flex-col border-b border-rule/70 bg-panel"
      data-testid={TESTID.chatPreview}
      data-row={props.open.row}
      aria-label="what one agent is doing"
    >
      {/* ABOVE EVERYTHING THIS BOX HAS TO SAY, because it is the one thing in
          it that is not about the agent: the turn is stopped, and it is stopped
          on the reader. It is drawn in the panel's alarm tone rather than its
          quiet one — the rest of this shelf is *something is happening*, and
          this is *nothing will happen until you look*. */}
      <Show when={asked()}>
        <button
          type="button"
          class="flex w-full shrink-0 items-center gap-1.5 border-b border-rule/70 bg-alarm/10 px-3 py-1.5 text-left font-mono text-[0.6875rem] leading-snug text-alarm hover:bg-alarm/20 focus-visible:outline focus-visible:outline-1 focus-visible:-outline-offset-2 focus-visible:outline-accent"
          data-testid={TESTID.chatPreviewAsked}
          onClick={() => {
            // BOTH, and in this order: the shelf is what is in the way, and the
            // ask is what the banner's own press raises — so the form is
            // scrolled into the middle of a pane that has already got its room
            // back. Pressing through to the same ask rather than scrolling from
            // here is what keeps one answer to "show me what is waiting".
            closePreview()
            reveal()
          }}
        >
          <span aria-hidden="true">◆</span>
          <span class="min-w-0 flex-1 truncate">a question is waiting on you</span>
          <span class="shrink-0 opacity-70">show me</span>
        </button>
      </Show>
      {/* THE HEAD IS ONE LINE AND NOTHING ELSE — no control beside it, and the
          ruling is the human's (2026-08-28, after a resumed agent went missing
          from the strip): get rid of the ×.

          It was a second way to close one thing — the door that opened this
          shelf closes it, both of them, because pressing the agent you are
          already reading means *put it away* ({@link ./previewing.ts}) — and a
          × on a box about an AGENT reads as a control over the agent rather
          than over the box. The person who pressed it read it that way: they
          took it for a dismissal, and when the same agent was resumed and no
          face came back, the × was the thing they had done. It is the row's own
          door and the strip's entry that open and shut this, and neither of
          them can ever mean anything about the agent. `Header.tsx`'s own rule,
          arriving here from the other side.

          Which is why this line is not wrapped in anything: a flex row with a
          gap and a `flex-1` child is a box laid out for a SECOND thing, and
          there is no second thing. */}
      <p
        class="flex min-w-0 shrink-0 items-baseline gap-1 px-3 py-1.5 font-mono text-[0.6875rem] leading-snug text-ink"
        data-testid={TESTID.chatPreviewOf}
        data-spawn-kind={whoOf(props.open.entry) ?? undefined}
      >
        {/* The lane's own glyph, so that the head of the shelf and the label
            a lane draws in the column are visibly the same fact: somebody
            else is doing this. */}
        <span aria-hidden="true">↳</span>
        <span class="sr-only">the work of&#32;</span>
        {/* WHAT IT WAS SENT TO DO ({@link ./spawn.ts}'s `sentOf`), which is
            not the row's title: the title is the tool's name, so four agents
            of one fan-out would give four shelves with one heading. */}
        <span class="min-w-0 truncate">{sentOf(props.open.entry)}</span>
      </p>
      {/* ITS OWN SCROLL, so a long-running agent's fortieth call is reachable
          without the shelf growing past its cap and without the conversation
          under it moving. */}
      <div class="olai-scroll min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-3 pb-2 text-ink">
        <Show
          when={calls().length > 0}
          fallback={
            // AN AGENT THAT HAS NOT CALLED ANYTHING YET is the whole of the
            // stretch a fan-out is watched through — its first act is to read
            // its instructions, which produces nothing to draw. An empty box
            // would read as a shelf that had failed to load; this is the true
            // sentence, and the row's own rail in the transcript is already
            // saying the other half.
            <p class="py-1 font-mono text-[0.6875rem] text-muted" data-testid={TESTID.chatPreviewNothing}>
              nothing yet
            </p>
          }
        >
          <For each={calls()}>
            {(key) => {
              const entry = props.chat.entry(key)
              return (
                <Show when={entry()}>
                  {(row) => (
                    <Row
                      entry={row()}
                      chat={props.chat}
                      lane={lane()}
                      rail={railOf(entry())}
                      // NO DOOR IN HERE, and it is a real decision rather than
                      // an omission: nothing in the harness olai talks to lets
                      // a subagent send an agent of its own, and a shelf that
                      // opened another shelf on top of itself is a shape
                      // nobody has ever seen arrive. If one does, its calls are
                      // filed under it like everything else and the row is
                      // still here — with no way in yet, which is the direction
                      // to be wrong in.
                      door={null}
                      says={null}
                      open={false}
                      // AND NO FACE EITHER, for the reason the lane above it
                      // carries no label: every row in this shelf is the one
                      // agent's, and that agent is named once in the shelf's
                      // own head. A face per run in here would repeat it down
                      // the shelf's whole length — which is the same repetition
                      // the lane already declines, one drawing over.
                      speaker={null}
                    />
                  )}
                </Show>
              )
            }}
          </For>
        </Show>
      </div>
    </section>
  )
}

/** No calls, minted once, so the `<Show>` above settles rather than seeing a
 *  fresh empty array every frame of the turn running underneath it. */
const EMPTY: ReadonlyArray<string> = []
