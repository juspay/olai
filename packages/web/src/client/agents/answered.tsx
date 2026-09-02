/**
 * THE AGENTS ROSTER AS THIS TAB HAS IT — the two cells joined ONCE, and a
 * context over the answer.
 *
 * `../pins/answered.tsx`'s arrangement, for its reasons, and they hold harder
 * here. The readers are scattered and none of them is near the other: the
 * sidebar's section draws the whole roster, EVERY ROW of a thousand-row outline
 * asks whether its node is on it (the door), and the panel's header asks what
 * the node it is bound to is called. Threading one accessor through all of that
 * would make every component's signature a function of what one descendant
 * needs.
 *
 * ## What is joined here rather than at each face
 *
 * How an agent STANDS is a fact about a pair — the `agents` cell and the `chat`
 * cell (`./roster.ts`) — and this is where the pair is read. It has to be one
 * place rather than one per face, and the reason is a measurement rather than a
 * preference: the DOOR is drawn for every node in the outline (it answers
 * nothing on the rows that carry no `agent-session` property, which is nearly all of
 * them). A door that joined for itself meant a chat-cell SUBSCRIPTION per row
 * and a whole-roster join per row per frame — a thousand subscriptions and a
 * thousand joins on a big board, for three agents' worth of answer, on a cell
 * that moves several times a turn. That is precisely the cost `../plugins/`
 * exists to refuse for a property chip: subscribe ONCE, here, and hand every
 * leaf an accessor.
 *
 * ## Two readings, because two questions are asked
 *
 * {@link Roster.rows} is the list, in the order the vault answers — what the
 * sidebar draws. {@link Roster.at} is one node's row — what a door and the
 * panel's header ask, both of which hold a node id and want nothing else. The
 * lookup is a MAP built with the join rather than a scan per asker, for the
 * reason `../doors.ts` builds one: the askers are per drawn row and the answer
 * is per frame.
 *
 * BEFORE THE FIRST FRAME the roster is empty, which is the same thing a
 * directory with no `agent-session` property anywhere says and the same thing it draws:
 * nothing. There is no third state to give anybody — an empty sidebar and a
 * sidebar that has not heard look identical.
 *
 * WHAT A DEAD WIRE DRAWS is the last answer that arrived, which is what the
 * connection pill already promises for everything else on screen, and the
 * reader is looking at it through the offline overlay.
 */

import { type Accessor, createContext, createMemo, type JSX, useContext } from "solid-js"

import { NO_AGENT_ROSTER } from "@olai/surface"

import { createChatState } from "../chat/state.ts"
import { olai } from "../wire.ts"
import { type Row, rowsOf } from "./roster.ts"

/** The roster as this tab has it: the list, and one node's row. */
export interface Roster {
  readonly rows: Accessor<ReadonlyArray<Row>>
  /** This node's row, or `undefined` for a node that is not a node agent —
   *  which is every other row of every outline. */
  readonly at: (node: string) => Row | undefined
}

const AgentsContext = createContext<Roster>()

export function AgentsProvider(props: { readonly children: JSX.Element }) {
  const cell = olai.cells.agents.use()
  // THE CHAT CELL AND NOT THE PANEL. `createChatState` subscribes the small
  // cell and deliberately not the transcript (`../chat/state.ts`) — a roster
  // that folded the conversation to paint three dots would be paying the
  // panel's whole cost for the panel's chrome.
  const chat = createChatState()
  const rows = createMemo(() => rowsOf(cell.value() ?? NO_AGENT_ROSTER, chat()))
  const byNode = createMemo(() => new Map(rows().map((row) => [row.id, row])))

  return (
    <AgentsContext.Provider value={{ rows, at: (node) => byNode().get(node) }}>
      {props.children}
    </AgentsContext.Provider>
  )
}

/** The roster as the server last answered it, joined with what the open
 *  conversation is doing — or a throw when a consumer is drawn outside the
 *  provider, which is a bug in this app rather than a state a reader can
 *  reach. */
export const useAgents = (): Roster => {
  const roster = useContext(AgentsContext)
  if (roster === undefined) throw new Error("an agents lookup outside <AgentsProvider>")
  return roster
}
