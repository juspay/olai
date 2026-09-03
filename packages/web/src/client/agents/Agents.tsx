/**
 * THE AGENTS ROSTER: one row per node agent, in the directory column.
 *
 * THE ROSTER IS A QUERY and this is that query drawn — every node carrying an
 * `agent-session` property, answered where the set is (`@olai/format`'s `agents.ts`).
 * There is no list to maintain, nothing to register and nothing that can fall
 * out of step: put the property on a node and the row is here on the frame the
 * store publishes; take it off and the row is gone. A node RENAMED anywhere
 * says its new name on that same frame, for the shelf's reason — there was
 * never a second copy of it to go stale.
 *
 * ## Where it sits, and why it is up here
 *
 * Directly under Inbox, above the month — which is where the reader's OWN short
 * list deliberately does not sit (`../pins/Shelf.tsx`, and the 2026-08-19
 * ruling that put the shelf below the journal's two questions: a reader's
 * bookmarks must not come ahead of the news).
 *
 * This is the news. A row reading *needs you* is the same KIND of fact as the
 * agenda's alarm and the inbox's count — something that is waiting, that a
 * person has to act on, and that nobody will see if it is below a month of day
 * cells. So it goes with them, and the shelf keeps its place under them.
 *
 * ## AN EMPTY SECTION DRAWS NOTHING — not a box, not a heading, not a hint
 *
 * The shelf's rule, and it is load-bearing here for a second reason as well as
 * the first. The first is the shelf's own: a directory with no node agent is
 * the ordinary state of every directory olai has ever served, and a permanent
 * affordance for a feature nobody has used is chrome charged to everybody.
 *
 * The second is the COLUMN'S BUDGET (`../layout/entry.ts`, and the scenario
 * behind it): this column is one screen tall, the month is most of it, and
 * every line of chrome up here is a line the file tree loses below the fold. A
 * section that drew a heading on every serve would spend that budget on every
 * directory to say nothing about most of them.
 *
 * ## What a row says, and in which order
 *
 * The NODE'S TITLE, because that is the agent's name — a node agent is a node,
 * and its title is what it is called. Under it, the engine and how it stands,
 * in the register the column's other second lines use. At the end, what is
 * waiting on YOU, drawn only when there is any.
 *
 * The STANDING is a word and a dot, never a dot alone (`./roster.ts`'s `LOOK`
 * argues it): the colour is the fastest read for somebody who can use it and
 * the only read for nobody.
 *
 * ## ... AND THE SECTION ENDS WITH WHAT IS NOT ANYBODY'S
 *
 * The last row is **Unassigned**: every conversation in this directory that no
 * node agent claims ({@link ./lineage.ts}), with how many. It is the doorway to
 * migration and it is deliberately the LAST row — the agents are who you talk
 * to, and this is a pile of chats waiting to become one.
 *
 * It draws only where there IS one, which keeps the section's rule intact from
 * both ends: a directory with agents and nothing spare ends at its agents, and
 * a directory with neither draws no section at all. But a directory with chats
 * and NO agents draws the section for this row alone — which is exactly the
 * state a person migrating is in, and a doorway that appeared only after you
 * had already made your first node agent by hand would be a doorway nobody
 * finds.
 */

import { Key } from "@solid-primitives/keyed"
import { Show } from "solid-js"

import { CHIP_QUIET } from "../layout/chip.ts"
import { REGION, REGION_LABEL } from "../layout/entry.ts"
import { setChatOpen } from "../layout/prefs.ts"
import { DOT } from "../readout.ts"
import { SaidLine } from "../SaidLine.tsx"
import { TESTID } from "../testids.ts"
import { useAgents } from "./answered.tsx"
import { createFocus } from "./focus.ts"
import { LOOK, type Row } from "./roster.ts"
import { showUnassigned } from "./showing.ts"

export function Agents() {
  // THE ROSTER SUBSCRIPTION IS THE PROVIDER'S, once for the whole app
  // (`./answered.tsx`), so this column and every door read one answer.
  const { rows, unassigned, unreachable, askChats } = useAgents()
  /** Whether the last row has anything to say — chats waiting for a node, or
   *  an agent nobody could ask what it has. The second is why it is not simply
   *  a count: *we did not get to look* is news too, and a row that drew only on
   *  a number would swallow it. */
  const spare = () => unassigned().length > 0 || unreachable().length > 0
  /** *Take me to this agent* — its node, and its conversation — and whatever
   *  that press had to say ({@link ./focus.ts}, which argues why one press
   *  means both and owns the wording of a refusal). */
  const focus = createFocus()

  return (
    <Show when={rows().length > 0 || spare()}>
      <section class={REGION} data-testid={TESTID.agentRoster}>
        <h2 class={REGION_LABEL}>Agents</h2>
        <ul class="m-0 list-none p-0">
          {/* `<Key>` BY THE NODE'S ID for the shelf's reason: the cell mints a
              fresh row per frame — an agent's last line landing, a session
              opening, a node renamed in some other file — so drawn by
              reference the whole roster was rebuilt for something that
              happened to one row of it. The id is the NODE's, which is exactly
              what identity means here: the node is durable and the session is
              cattle, so a row whose session was swapped is the same row. */}
          <Key each={rows()} by="id">
            {(row) => <AgentRow row={row()} onPress={() => focus.press(row())} />}
          </Key>
          {/* ... and the chats that are nobody's yet, LAST. */}
          <Show when={spare()}>
            <UnassignedRow
              many={unassigned().length}
              unasked={unreachable().length}
              onPress={() => {
                // ASKED AGAIN ON THE PRESS, because the answer behind the count
                // is a question about somebody's disk and a `claude --resume`
                // in a terminal moves it. The count a person just read is the
                // one that was true when this tab started; the list they are
                // about to read should be truer than that.
                askChats()
                setChatOpen(true)
                showUnassigned()
              }}
            />
          </Show>
        </ul>
        {/* WHY NOTHING HAPPENED, where a press was refused — a property naming a
            conversation the agent no longer has is the case, and it is one a
            person can only fix by rewriting that property, so they have to be
            able to read it. On the SECTION rather than on the row, because the row
            it belongs to may have been replaced by the frame that answered. */}
        <Show when={focus.said()}>
          {(said) => (
            <SaidLine
              said={said()}
              testid={TESTID.agentRefused}
              class="mt-1 px-2.5 text-[0.75rem]"
            />
          )}
        </Show>
      </section>
    </Show>
  )
}

/** One node agent. A BUTTON and not a link, even though half of what it does is
 *  navigate: the other half is a verb on the panel, and an anchor whose
 *  activation is also a procedure call is an anchor a middle-click opens
 *  without doing half of what it says. */
function AgentRow(props: { readonly row: Row; readonly onPress: () => void }) {
  const look = () => LOOK[props.row.standing]
  return (
    <li class="mb-0.5">
      <button
        type="button"
        class="flex w-full min-w-0 items-center gap-2 rounded-xl px-2.5 py-1 text-left hover:bg-paper/10"
        data-testid={TESTID.agentRow}
        data-agent={props.row.id}
        // The STANDING as data, so a scenario can assert the state without
        // asserting the paint: which colour says "working" is a decision about
        // pixels, and a test that pinned it would fail the next time somebody
        // improved it. Tests assert behaviour, not styling.
        data-standing={props.row.standing}
        // THE SENTENCE THE TABLE ALREADY CARRIES, rather than a phrase composed
        // here: `Look.detail` is what a state MEANS and is the half a hover and
        // a screen reader get everywhere else in this app's chrome.
        title={`${props.row.title} — ${props.row.engine}: ${look().detail}`}
        onClick={() => props.onPress()}
      >
        <span class="min-w-0 flex-1">
          <span class="block truncate text-[0.875rem] leading-snug">{props.row.title}</span>
          <span class="flex min-w-0 items-center gap-1 text-[0.75rem] leading-snug text-paper/55">
            <span class={`${DOT} ${look().dot}`} aria-hidden="true" />
            {/* THE ENGINE GIVES WAY AND THE STANDING DOES NOT, which is what
                the column is narrow enough to make a decision: written as one
                span the two shrank together and `grok — the kimi implementor ·
                asleep` clipped to `…· a…`, losing the one word the row is read
                for. The engine is a name somebody wrote and can be read in
                full on the node itself. */}
            <span class="min-w-0 truncate">{props.row.engine}</span>
            <span class="shrink-0">· {look().label}</span>
          </span>
        </span>
        <Show when={props.row.waiting > 0}>
          <span
            class={`${CHIP_QUIET} shrink-0`}
            data-testid={TESTID.agentWaiting}
            title="questions this agent is waiting on you to answer"
          >
            {props.row.waiting}
          </span>
        </Show>
      </button>
    </li>
  )
}

/**
 * THE CHATS NOBODY HAS GIVEN A NODE — the section's last row.
 *
 * It is the same shape as an agent's row and deliberately not the same voice:
 * no dot, because nothing here has a standing — these are conversations, not
 * agents, and a dot would be claiming one of the seven words about a pile. What
 * it says under the label is what a person does about it.
 *
 * The COUNT is a chip on the right, in the slot an agent's waiting questions
 * take, because it is the same kind of fact in that column: how many things are
 * sitting there. Its own testid, since "there is a row" and "it counts twelve"
 * are two claims and a scenario about migration is about the second.
 */
function UnassignedRow(props: {
  readonly many: number
  /** How many agents could not be asked what they have stored. The row draws
   *  for these too, with nothing else on it: *we did not get to look* is the
   *  one thing a count cannot say, and the list is where it is said in full
   *  ({@link ./Unassigned.tsx}). */
  readonly unasked: number
  readonly onPress: () => void
}) {
  return (
    <li class="mb-0.5">
      <button
        type="button"
        class="flex w-full min-w-0 items-center gap-2 rounded-xl px-2.5 py-1 text-left hover:bg-paper/10"
        data-testid={TESTID.agentUnassigned}
        title="conversations in this directory that no node agent claims — open to give one a node"
        onClick={() => props.onPress()}
      >
        <span class="min-w-0 flex-1">
          <span class="block truncate text-[0.875rem] leading-snug text-paper/70">Unassigned</span>
          <span class="block truncate text-[0.75rem] leading-snug text-paper/55">
            {props.many > 0
              ? `${props.many === 1 ? "1 chat" : `${props.many} chats`} · assign each to a node`
              : `${props.unasked === 1 ? "1 agent" : `${props.unasked} agents`} could not be asked`}
          </span>
        </span>
        {/* THE COUNT IS OF CHATS, so it is absent where there are none — a `0`
            beside a row that is there because something could not be asked
            would be the answer nobody has. */}
        <Show when={props.many > 0}>
          <span class={`${CHIP_QUIET} shrink-0`} data-testid={TESTID.agentUnassignedCount}>
            {props.many}
          </span>
        </Show>
      </button>
    </li>
  )
}
