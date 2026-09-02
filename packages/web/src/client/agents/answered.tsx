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
 * ## And a third that is not a reading of the roster at all
 *
 * {@link Roster.engines} is WHICH AGENTS THIS MACHINE HAS, which is a different
 * question from which nodes are node agents — and it is here for a reason that
 * is entirely about where the subscription is. It is a field of the chat cell
 * this provider is already holding, and its one reader is the `•••` menu's
 * *start an agent session* on a BARE node, which has to pick an engine because
 * the node names none (`../menu/verbs.ts`). A second `createChatState` behind
 * the menu would be the per-row subscription this whole module exists to
 * refuse, arriving from the other side.
 *
 * ## ... and a fourth: THE CHATS NO NODE CLAIMS
 *
 * Migration needs the OTHER list — what every installed agent has stored here
 * — and that one is not a cell at all. It is a question, asked of the agents
 * themselves, which can mean starting one that is not running
 * (`@olai/chat`'s `listings.ts` owns what that costs and how long an answer is
 * worth keeping). So it is asked ONCE when this provider mounts, and the
 * difference is derived live: **what is unassigned is the listing minus what
 * the roster claims** ({@link ./lineage.ts}), and the roster is a cell. That
 * arrangement is what makes the count on the sidebar honest without a second
 * round trip — assign a chat and the property lands, the cell moves, and the
 * row it left drops out of the list on that frame.
 *
 * ASKED ONCE PER TAB rather than per frame, and never on a clock: the answer
 * changes when somebody works in this directory — a `claude --resume` in a
 * terminal — so the list is re-asked when a person OPENS it
 * ({@link Roster.askChats}), which is the same bargain the session picker
 * already makes on every open.
 *
 * A REFUSAL IS NO LIST. A serve with no ACP agent refuses this call, and what
 * it draws is what a directory with nothing stored draws: no Unassigned row.
 * That is the one place this differs from the picker, which must say *we did
 * not get to look* rather than *there is nothing* — the picker is a list
 * somebody opened, and this is a row nobody asked for. A row that could not be
 * counted is a row with nothing to say.
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

import {
  type Accessor,
  createContext,
  createMemo,
  createSignal,
  type JSX,
  useContext,
} from "solid-js"

import { type AgentChoice, type Listed, NO_AGENT_ROSTER, type SessionInfo } from "@olai/surface"

import { createChatState } from "../chat/state.ts"
import { run } from "../run.ts"
import { olai } from "../wire.ts"
import { unassignedIn } from "./lineage.ts"
import { type Row, rowsOf } from "./roster.ts"

/** The roster as this tab has it: the list, one node's row, and the chats
 *  nobody has given a node yet. */
export interface Roster {
  readonly rows: Accessor<ReadonlyArray<Row>>
  /** This node's row, or `undefined` for a node that is not a node agent —
   *  which is every other row of every outline. */
  readonly at: (node: string) => Row | undefined
  /** WHICH AGENTS THIS MACHINE HAS, in the order the panel's picker draws them
   *  — see the header for why this rides here. Empty before the first frame,
   *  and on a serve with no ACP agent at all, which are the same two cases
   *  every other reading here has. */
  readonly engines: Accessor<ReadonlyArray<AgentChoice>>
  /**
   * THE CONVERSATIONS NO NODE CLAIMS, newest first across every installed
   * agent — what **Unassigned** holds and counts.
   *
   * Empty before the listing has answered, on a serve that refused it, and on
   * a directory whose chats are all assigned. Those are three ways to draw the
   * same nothing, which is what the row does with them.
   */
  readonly unassigned: Accessor<ReadonlyArray<SessionInfo>>
  /** Ask the agents again — what a person opening the list gets, because a
   *  conversation started in a terminal a moment ago should be in it. */
  readonly askChats: () => void
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
  // OFF THE SAME FRAME, and a memo rather than a read at each asker so that a
  // chat frame which moved a dot does not re-run the menu's catalog: the list
  // is replaced whole per frame and is the same array on nearly all of them.
  const engines = createMemo(() => chat().roster)

  /**
   * WHAT EVERY INSTALLED AGENT HAS STORED HERE, as this tab last heard it.
   *
   * `null` until an answer arrives and after one that was refused, which are
   * the same thing to every reader: there is no list, so there is nothing to
   * say a chat is unclaimed by. A refusal is deliberately NOT kept as a
   * sentence — see the header on why this row differs from the picker.
   */
  const [chats, setChats] = createSignal<Listed | null>(null)
  const askChats = (): void => {
    run(
      olai.procedures.chat.sessions(),
      // A REFUSAL LEAVES THE LAST ANSWER STANDING rather than emptying the
      // row: a socket that dropped is not a directory whose chats were all
      // assigned, and `run` has no overload that swallows one silently.
      () => {},
      (listed) => setChats(listed),
    )
  }
  // ONCE, on the frame this provider mounts. It is the only unprompted round
  // trip in this module, and what it buys is the count on a row nobody has
  // pressed yet — see the header.
  askChats()

  /** ... minus what the roster claims ({@link ./lineage.ts}), which is a
   *  reading of the CELL and so is live: the frame an assignment lands on is
   *  the frame that row leaves this list. */
  const unassigned = createMemo(() => {
    const listed = chats()
    return listed === null ? [] : unassignedIn(listed.sessions, cell.value() ?? NO_AGENT_ROSTER)
  })

  return (
    <AgentsContext.Provider
      value={{ rows, at: (node) => byNode().get(node), engines, unassigned, askChats }}
    >
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
