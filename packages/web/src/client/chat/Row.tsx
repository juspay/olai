/**
 * ONE ROW, WHEREVER IT IS DRAWN — the transcript's column, or the shelf that
 * previews one agent's work.
 *
 * It is a component rather than markup inside {@link ./Transcript.tsx} because
 * there are two lists now and the whole claim of the second is that it is THE
 * SAME DRAWING. A subagent's calls left the column ({@link ./lanes.ts}'s
 * `filedUnder`) and are read through a door instead; what is behind that door
 * has to be the rows a person already knows how to read — the same mark, the
 * same fold, the same diff, behind the same rail — and not a second, thinner
 * rendering of a tool call that drifts from this one the first time either is
 * touched. Spelled twice they would agree by coincidence.
 *
 * WHAT IT DOES NOT DECIDE is which lane a row is in, whether the lane says its
 * name, WHOSE FACE goes over it, or what the live rail underneath says. Those
 * are rules ({@link ./lanes.ts}, {@link ./speakers.ts}, {@link ./rail.ts}) and
 * their INPUTS are facts about a LIST — the row above, the frame that spawned
 * this one, which agent the session is with — which is exactly what a row
 * cannot see. So they are computed by whichever list is drawing and handed in.
 * That is also what lets the shelf differ where it should: every row in it
 * belongs to the one agent the shelf is already named after, so it hands in a
 * lane with no label — and no face at all — rather than repeating that name
 * down its own length.
 *
 * THE GAP UNDER THE ROW is here for the reason it left `./Entry.tsx`: a rail
 * has to be able to cross it. Padding, not a margin — a border is drawn around
 * padding and outside a margin, so a lane's rail reaches from its row down
 * through the space to the next one and a run comes out as one line rather than
 * a column of dashes.
 */

import { Show } from "solid-js"

import type { ChatEntry } from "@olai/surface"

import { TESTID } from "../testids.ts"
import { Entry } from "./Entry.tsx"
import type { Lane } from "./lanes.ts"
import { RAIL } from "./lanes.ts"
import { LIVE_DOT } from "./live.ts"
import type { Rail } from "./rail.ts"
import { type Faced, Speaker } from "./Speaker.tsx"
import type { Chat } from "./state.ts"

export function Row(props: {
  readonly entry: ChatEntry
  readonly chat: Chat
  /** Whose row this is, or `null` for one the reader's own column owns. */
  readonly lane: Lane | null
  /** What is still going on under it, or `null` — see {@link ./rail.ts}. */
  readonly rail: Rail | null
  /** The door onto a spawned agent's own calls, drawn under the row in the
   *  rail's place, or `null` for every row that sent nobody. Handed in for the
   *  lane's reason: how many calls an agent has made is a fact about the LIST.
   */
  readonly door: (() => unknown) | null
  /** ... and what that door says right now. */
  readonly says: string | null
  /** Whether the door leads to the shelf that is ALREADY open, which is the
   *  one thing a door has to say about itself: pressing it again puts it away.
   */
  readonly open: boolean
  /** WHOSE RUN STARTS HERE, or `null` for a row inside one — which is most
   *  rows ({@link ./Speaker.tsx}, over {@link ./speakers.ts}'s rule).
   *
   *  Handed in for the lane's reason and it is the same reason: whether this
   *  row is the FIRST of its speaker's is a fact about the row above it, which
   *  is a fact about the LIST, and a row cannot see one. */
  readonly speaker: Faced | null
}) {
  return (
    <div
      classList={{
        [RAIL]: props.lane !== null,
        // ... unless the rail below is carrying it instead, so that one line
        // crosses the gap rather than stopping at the edge of this box and
        // starting again inside it.
        "pb-2": props.rail === null && props.door === null,
      }}
      data-testid={props.lane === null ? undefined : TESTID.chatLane}
      data-lane={props.lane?.parent}
    >
      {/* WHO IS TALKING, once where their run begins — above the words rather
          than beside them, and above the LANE's own label rather than under it,
          because the two say different things and the outer one goes first. A
          face names the PARTY (a person, the agent, a plugin); a lane label
          names which agent inside a fan-out a question came from, which is a
          division of the agent's own side and reads as one under the agent's
          face. */}
      <Show when={props.speaker}>
        {(faced) => <Speaker party={faced().party} agent={faced().agent} />}
      </Show>
      {/* Once per stretch of one agent's work, not once per call it makes —
          see `./lanes.ts`. In the column that is now only ever a question,
          which is the one row that always names its lane; in the shelf it is
          never drawn at all, because the shelf's own head is the name. */}
      <Show when={props.lane?.label}>
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
      <Entry entry={props.entry} chat={props.chat} />
      {/* THE LIVE RAIL, dropping out of the row the moment an agent is sent out
          or a task is armed, rather than one that appears whenever something
          eventually happens down there. It carries the gap to the next row
          (`pb-2`, taken off the wrapper above) so the rail runs down through
          it, and it is the same `RAIL` the module that owns what a lane looks
          like exports — so "one line" is held by one spelling rather than by
          two that happen to agree.

          The pulsing dot is the header's, by import: a turn in flight and an
          agent in flight are the same kind of fact, and a panel with two
          spellings of "this is happening" is a panel with one of them to
          learn. */}
      <Show when={props.rail}>
        {(rail) => (
          <div class={`${RAIL} ${props.door === null ? "pb-2" : ""} pt-1`}>
            {/* The NAME is on the words rather than on the rail around them, so
                that what a scenario measures is what a reader sees inset — the
                rail's own box starts at the row's left edge, and asserting on
                that would pass on a build that had lost the indent entirely. */}
            <p
              class="flex items-center gap-1 font-mono text-[0.6875rem] text-doing"
              data-testid={rail().name}
              data-lane={props.entry.id}
              aria-live="polite"
            >
              <span class={LIVE_DOT} aria-hidden="true" />
              {rail().said}
            </p>
          </div>
        )}
      </Show>
      {/* THE DOOR, on the same rail and directly under whatever the live one
          said, because they are two halves of one sentence about the same
          agent: *it is working*, and *here is what it has done*. It is drawn
          for as long as the row is — a strip entry goes out when the agent
          reports back, and a record that went with it would be a fan-out you
          could only read while you were too busy to. */}
      <Show when={props.door !== null && props.says !== null}>
        <div class={`${RAIL} pb-2 pt-1`}>
          <button
            type="button"
            class="flex items-center gap-1 rounded-sm font-mono text-[0.6875rem] text-muted hover:text-ink focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-accent"
            data-testid={TESTID.chatLaneDoor}
            data-lane={props.entry.id}
            aria-expanded={props.open}
            onClick={() => props.door?.()}
          >
            <span aria-hidden="true">↳</span>
            <span class="min-w-0 truncate">{props.says}</span>
          </button>
        </div>
      </Show>
    </div>
  )
}
