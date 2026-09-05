/**
 * THE AGENTS ROSTER AS THIS TAB HAS IT — one subscription, and a context over
 * the server's answer.
 *
 * `../pins/answered.tsx`'s arrangement, for its reasons, and they hold harder
 * here. The readers are scattered and none of them is near the other: the
 * sidebar's section draws the whole roster, EVERY ROW of a thousand-row outline
 * asks whether its node is on it (the door), and the panel's header asks what
 * the node it is bound to is called. Threading one accessor through all of that
 * would make every component's signature a function of what one descendant
 * needs.
 *
 * The DOOR is drawn for every node in the outline and answers nothing for
 * nearly all of them. Subscribing there would mean a thousand subscriptions on
 * a big board for three agents' worth of answer. Subscribe once here and hand
 * every leaf an accessor. Standing is already on each row: several node scopes
 * may be live, so the foreground chat cell cannot derive that answer.
 *
 * ## Two readings, because two questions are asked
 *
 * {@link Roster.rows} is the list, in the order the vault answers — what the
 * sidebar draws. {@link Roster.at} is one node's row — what a door and the
 * panel's header ask, both of which hold a node id and want nothing else. The
 * lookup is a MAP built with the list rather than a scan per asker, for the
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
 * (`olai-plugin-chat`'s `listings.ts` owns what that costs and how long an answer is
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
 * ({@link Roster.askChats}), which is the same bargain the list this replaced
 * made on every open. And there is a THIRD ask, because the second one can be
 * unreachable: the row the press refreshes draws only on a non-empty answer,
 * so in a fresh vault — or any tab that mounted before its first conversation
 * existed — OPENING can never fire. The event the empty answer cannot survive
 * is a SETTLED TURN: the conversation that just ran is a file the listing has
 * not seen, so when the last answer names neither it nor a node claiming it,
 * the ask goes out again there. ONCE per conversation, never per turn: a
 * listing that CAN name it has been asked, and one that cannot — an agent
 * without `sessionCapabilities.list`, or a `cwd` the directory rule rejects —
 * never will, so re-asking on every settle would pay the spawn bill this
 * file's ask-once rule exists to refuse, on a trigger nothing on screen ever
 * shows. The tab remembers instead (`probed` below), and anything surer than
 * one probe is the press. A conversation the answer already names pays
 * nothing per turn, which is the ordinary state of every directory this is
 * asked about — the same rule the cache keeps one layer down: nothing is
 * re-asked about what the answer already says.
 *
 * WHAT COULD NOT BE ASKED IS KEPT, in both of its sizes. One agent that could
 * not answer is a row of the answer ({@link Roster.unreachable}) and the whole
 * ask not landing is {@link Roster.chatsRefusal} — and neither empties the last
 * list this tab had. Both are drawn where the conversations are, because *we
 * did not get to look* and *there is nothing here* are different answers and
 * this list is now the only place either can be said. The sidebar's ROW is the
 * one reader that says less: it counts chats, and a count is not a sentence, so
 * it draws for an unreachable agent without pretending to number one.
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
  createEffect,
  createMemo,
  createSignal,
  type JSX,
  useContext,
} from "solid-js"

import {
  type AgentChoice,
  agentIn,
  type Listed,
  type Migration,
  NO_AGENT_ROSTER,
  type SessionInfo,
  type Unreachable,
} from "olai-plugin-chat/wire"
import { createChatState } from "../chat/state.ts"
import { run } from "@olai/web/client/run.ts"
import { olai } from "@olai/web/client/wire.ts"
import { type Chatting, chatKey, claimedIn, unassignedIn } from "../../lineage.ts"
import type { Row } from "./roster.ts"
import { chatWire } from "../wire.ts"

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
  /**
   * ... AND THE WHOLE ANSWER THE LISTING GAVE, for the readers that need more
   * of it than the difference: which agents COULD NOT BE ASKED and what they
   * said about it, and the links that make one conversation another's history.
   *
   * `null` until an answer has arrived, which is a list nobody can draw yet
   * rather than an empty one.
   */
  readonly chats: Accessor<Listed | null>
  /** WHICH AGENTS COULD NOT BE ASKED what they have stored, and why — that
   *  answer's own arm, read off it here rather than at each face, because two
   *  faces draw it: the row that says there is something to look at, and the
   *  list that names them. Empty before an answer and where every agent
   *  answered. */
  readonly unreachable: Accessor<ReadonlyArray<Unreachable>>
  /** ... and why the last ask did not land at all — a dropped socket, a server
   *  that went — as opposed to one agent that could not be asked, which is a
   *  row of the answer above. `null` when the last ask landed. */
  readonly chatsRefusal: Accessor<string | null>
  /** WHAT THIS VAULT IS OWED to get its node agents back, or `null` — which is
   *  what every board that has said the word answers, and every board that
   *  never used the old one ({ ../../wire/agents.ts}'s `Migration`). */
  readonly migration: Accessor<Migration | null>
  /** WHICH CONVERSATION THE PANEL IS IN, as the pair that names one — `null`
   *  when it is in none. Off the chat cell this provider already holds, so a
   *  list that marks the row a reader is already looking at costs no second
   *  subscription. */
  readonly openChat: Accessor<Chatting | null>
  /** Ask the agents again — what a person opening the list gets, because a
   *  conversation started in a terminal a moment ago should be in it. Called
   *  on the press, and by the provider itself when a settled turn lands the
   *  panel in a conversation the last answer does not name and no node claims
   *  — the ask a row that is not drawn yet can never take, once per such
   *  conversation (see the header); past that the press is the only ask. */
  readonly askChats: () => void
}

const AgentsContext = createContext<Roster>()

export function AgentsProvider(props: { readonly children: JSX.Element }) {
  const cell = chatWire().cells.agents.use()
  // THE CHAT CELL AND NOT THE PANEL. `createChatState` subscribes the small
  // cell and deliberately not the transcript (`../chat/state.ts`) — a roster
  // that folded the conversation to paint three dots would be paying the
  // panel's whole cost for the panel's chrome.
  const chat = createChatState()
  const rows = createMemo(() => cell.value() ?? NO_AGENT_ROSTER)
  // WHAT THE BOARD IS OWED, on the same terms as the roster and beside it: it
  // is the sentence the EMPTY roster needs, so a reader that has one has both.
  // Its own cell, because it moves only when a declarations file does
  // (`../../wire/agents.ts`).
  const owed = chatWire().cells.migration.use()
  const migration = createMemo(() => owed.value() ?? null)
  const byNode = createMemo(() => new Map(rows().map((row) => [row.id, row])))
  // OFF THE SAME FRAME, and a memo rather than a read at each asker so that a
  // chat frame which moved a dot does not re-run the menu's catalog: the list
  // is replaced whole per frame and is the same array on nearly all of them.
  const engines = createMemo(() => chat().roster)
  /** ... and which conversation it is IN, as the pair — see {@link Roster.openChat}. */
  const openChat = createMemo((): Chatting | null => {
    const state = chat()
    const agent = agentIn(state)
    const session = state.session
    return agent === null || session === null ? null : { agent: agent.id, session: session.id }
  })

  /**
   * WHAT EVERY INSTALLED AGENT HAS STORED HERE, as this tab last heard it.
   *
   * `null` until the FIRST answer arrives, and never emptied afterwards: an ask
   * that did not land leaves the last list standing and puts its own sentence
   * beside it ({@link chatsRefusal}), because *we did not get to look* and
   * *there is nothing here* are different answers and this list is the only
   * place either is said.
   */
  const [chats, setChats] = createSignal<Listed | null>(null)
  const [chatsRefusal, setChatsRefusal] = createSignal<string | null>(null)
  /** An ask in flight right now, and whether an event queued one behind it.
   *  Not signals: which frame an ask settles on is bookkeeping, and painting
   *  it would redraw the page for a wire a reader never sees. */
  let asking = false
  let held = false
  const settleAsk = (apply: () => void): void => {
    // THE FLAGS GO DOWN BEFORE THE ANSWER IS APPLIED, and the queue drains
    // after: `run` rethrows a defect and a signal's subscribers run inside
    // `apply`, so either arm throwing would otherwise pass the release by and
    // wedge `asking` forever — taking the press with it, invisibly. A defect
    // may now cost the drain; it may never lock the door.
    const refire = held
    asking = false
    held = false
    apply()
    if (refire) askChats()
  }
  const askChats = (): void => {
    // COALESCED, not stacked: while one ask is in flight a second says nothing
    // the settle will not say fresher — and the settle RE-FIRES when anything
    // queued, because the queue is how an event that raced an in-flight ask
    // (the first turn ending inside the mount ask's round trip, say) still
    // gets its answer rather than a window nobody re-opens.
    if (asking) {
      held = true
      return
    }
    asking = true
    run(
      chatWire().procedures.conversation.sessions(),
      // A REFUSAL LEAVES THE LAST ANSWER STANDING rather than emptying the
      // list — a socket that dropped is not a directory whose chats were all
      // assigned — and it is KEPT, because the list is the one place those
      // conversations are now and a stale one with nothing said over it would
      // be the same lie the picker's own refusal arm exists to prevent.
      (failure) =>
        settleAsk(() => {
          setChatsRefusal(failure.message)
        }),
      (listed) =>
        settleAsk(() => {
          setChatsRefusal(null)
          setChats(listed)
        }),
    )
  }
  // On the frame this provider mounts: what it buys is the count on a
  // row nobody has pressed yet — see the header.
  askChats()

  // A sibling tab can replace a node session without running a turn. Wait
  // for the server's completed history write, not the earlier roster update.
  const sessionsRevision = chatWire().cells.sessionsRevision.use()
  let lastSessionsRevision: number | undefined
  createEffect(() => {
    const revision = sessionsRevision.value()
    if (revision === undefined) return
    const previous = lastSessionsRevision
    lastSessionsRevision = revision
    if (previous !== undefined && previous !== revision) askChats()
  })

  // ... AND THE OTHER EVENT THAT CAN MAKE THAT ANSWER STALE. A conversation
  // this tab (or a sibling — the cell is the server's, so every tab sees the
  // turn) just worked in is a file the listing has not seen, and a SETTLED
  // TURN is when that is true: not the mount ask, which can land before the
  // first transcript exists, and never a clock, which the header rules out.
  //
  // The previous status is a LOCAL and not `on`'s: a deferred `on` never
  // recalls the first transition's before-value, and a tab that MOUNTED
  // mid-turn — somebody worked in a sibling — is exactly the tab standing on
  // the settle it would have dropped.
  let wasThinking = chat().status === "thinking"
  // THE SETTLED-TURN PROBES THIS TAB HAS PAID, by conversation key. That is
  // the bound on the trigger: one probe is as much as a listing that CAN name
  // the conversation needs, and as much as one that cannot will ever get —
  // its answer is asked for again on the press and nowhere else. Never
  // cleared: a conversation the answer names fails the named-check before it
  // reaches the set, so what remains in it is precisely the conversations the
  // answer can never name — the ones that must not probe twice.
  const probed = new Set<string>()
  //
  // The GATE, and not the turn, is the frugality: re-ask only when the last
  // answer names neither the conversation nor a node claiming it — which is
  // true of a conversation nobody has listed yet and of nothing else. A
  // conversation the answer already names pays nothing per turn, and that is
  // every directory once its listing has landed. NO ANSWER YET — the mount ask
  // still out, or refused — reads as NOT NAMED, and the ask below coalesces
  // behind the one in flight if there is one: that settle is queued, never
  // dropped.
  createEffect(() => {
    const now = chat().status === "thinking"
    const settledTurn = wasThinking && !now
    wasThinking = now
    if (!settledTurn) return
    const pair = openChat()
    if (pair === null) return
    const listed = chats()
    if (listed !== null) {
      // NAMED before CLAIMED: the answer naming the conversation is the
      // ordinary case, and the claim walk pays a chain per roster agent over
      // the whole listing to reach the same stop.
      if (
        listed.sessions.some((row) => row.agent === pair.agent && row.id === pair.session)
      ) {
        return
      }
      if (
        claimedIn(listed.sessions, cell.value() ?? NO_AGENT_ROSTER).has(
          chatKey(pair.agent, pair.session),
        )
      ) {
        return
      }
    }
    const key = chatKey(pair.agent, pair.session)
    if (probed.has(key)) return
    probed.add(key)
    askChats()
  })

  /** The answer's own arm, read once here — see {@link Roster.unreachable}. */
  const unreachable = createMemo((): ReadonlyArray<Unreachable> => chats()?.unreachable ?? [])

  /** ... minus what the roster claims ({@link ./lineage.ts}), which is a
   *  reading of the CELL and so is live: the frame an assignment lands on is
   *  the frame that row leaves this list. */
  const unassigned = createMemo(() => {
    const listed = chats()
    return listed === null ? [] : unassignedIn(listed.sessions, cell.value() ?? NO_AGENT_ROSTER)
  })

  return (
    <AgentsContext.Provider
      value={{
        rows,
        at: (node) => byNode().get(node),
        engines,
        unassigned,
        chats,
        unreachable,
        openChat,
        chatsRefusal,
        migration,
        askChats,
      }}
    >
      {props.children}
    </AgentsContext.Provider>
  )
}

/** The roster as the server last answered it — or a throw when a consumer is
 * drawn outside the provider, which is a bug rather than a reachable state. */
export const useAgents = (): Roster => {
  const roster = useContext(AgentsContext)
  if (roster === undefined) throw new Error("an agents lookup outside <AgentsProvider>")
  return roster
}
