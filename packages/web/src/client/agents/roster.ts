/**
 * WHAT A NODE AGENT'S ROW SAYS — the join, and the seven standings it decides
 * between.
 *
 * The roster arrives as two answers that are deliberately not one
 * (`@olai/surface`'s `agents.ts`): the `agents` cell carries the DURABLE row —
 * the node, its engine, its memory, and which conversation it is bound to — and
 * the `chat` cell carries what the ONE open conversation is doing. Neither says
 * how an agent stands, because that is a fact about the pair; this module is
 * where the pair is read, once, for both faces that draw it (the sidebar's
 * roster and the door on the outline row).
 *
 * A MODULE for `../chat/busy.ts`'s reason, which is this directory's whole
 * shape: it is a small precedence over two values that arrive on a wire, and
 * what it decides is what somebody is told about an agent they are about to
 * press. Reaching it through a browser is not how anybody should have to check
 * that a roster does not say *idle* about an agent whose process is not
 * running.
 *
 * ## Why seven, when the design named four
 *
 * The design's four — working, needs-you, idle, asleep — are the four a person
 * thinks in, and they are all here. The other three are states the panel can
 * demonstrably be in and cannot honestly draw as any of the four:
 *
 *   - **`unbound`** is a node agent nobody has bound a session to, which is
 *     what EVERY node agent is the moment somebody puts an `agent` property on
 *     a node. Drawing it as *asleep* would claim a conversation that does not
 *     exist and offer a door that opens nothing.
 *   - **`waking`** is the bound conversation's agent still starting — a
 *     subprocess, a handshake, a replay. *Idle* would say ready about a panel
 *     that cannot take a message yet, and the panel's own header has always had
 *     a word for this.
 *   - **`gone`** is the bound conversation's agent not running at all. That is
 *     the one standing on this list that needs a PERSON, and folding it into
 *     *asleep* would fold the state that resolves itself into the one that
 *     never will.
 *
 * The rule this list is built on is the one this repo keeps everywhere: a
 * capability that is silently absent cannot be told apart from one that is
 * broken. Four words over seven states is exactly that, on a row whose whole
 * job is to say which of your agents needs you.
 *
 * ## And why the LIVE one is decided by `bound` rather than by the ids
 *
 * `ChatState.bound` names the node the open conversation belongs to, decided by
 * the server off the same table the roster's `session` came from. Comparing the
 * session ids here instead would be this browser re-deriving an answer the
 * server has already given — and re-deriving it from a pair that can arrive on
 * two different frames, so a session swap would light two rows or none for as
 * long as the frames disagreed.
 */

import type { Agents, ChatState, NodeAgentRow } from "@olai/surface"

import { busyIn } from "../chat/busy.ts"

/**
 * HOW A NODE AGENT STANDS — see the header for why there are seven of them.
 *
 * Ordered here as a reader would rank them: what needs you, what is happening,
 * what is ready, and the three flavours of nothing going on.
 */
export type Standing =
  | "needs-you"
  | "working"
  | "waking"
  | "idle"
  | "gone"
  | "asleep"
  | "unbound"

/** One row as the sidebar and the door draw it: the vault's own facts, plus the
 *  one fact neither cell holds on its own. */
export interface Row extends NodeAgentRow {
  readonly standing: Standing
  /**
   * HOW MANY QUESTIONS ARE WAITING ON YOU in this agent's conversation — the
   * count the roster row wears, and zero for every agent but the open one.
   *
   * THIS IS THE "UNREAD COUNT", and the name it is given here is the honest
   * one. Olai runs a single conversation at a time, so an agent that is not the
   * open one cannot have said anything since you last looked — there was no
   * process to say it. What CAN accumulate unseen is a turn stopped on a
   * question while you were reading something else, and that is a count this
   * end can actually answer. A badge counting messages would be a badge that
   * read zero for ever until sessions outlive the panel's focus, which is a
   * later phase's.
   */
  readonly waiting: number
}

/** What each standing is CALLED and how it is painted — one table, read by the
 *  sidebar's row and by the door on the outline, so the two cannot come to say
 *  different things about one agent.
 *
 *  A WORD AND A DOT, never a colour alone: the word is what a screen reader
 *  gets, what survives a screenshot, and the only read for somebody who cannot
 *  tell `doing` from `alarm` (`../chat/standing.ts` argues the same line for
 *  the server roster's marks).
 *
 *  A RECORD OVER THE CLOSED UNION rather than a lookup with a fallback: an
 *  eighth standing fails to compile here. */
export const SAID: {
  readonly [K in Standing]: {
    /** What the row says it is doing. */
    readonly word: string
    /** The dot's paint — utility classes, so the two faces share one pip. */
    readonly dot: string
  }
} = {
  "needs-you": { word: "needs you", dot: "bg-doing" },
  working: { word: "working…", dot: "bg-done animate-pulse" },
  waking: { word: "starting…", dot: "bg-done animate-pulse" },
  idle: { word: "idle", dot: "bg-done" },
  gone: { word: "not running", dot: "bg-alarm" },
  asleep: { word: "asleep", dot: "bg-muted/50" },
  unbound: { word: "no session bound", dot: "border border-muted/60" },
}

/**
 * The rows, in the order the roster answers — which is corpus order, so the
 * sidebar lists node agents in the order the vault holds them.
 *
 * WHATEVER THE CELL SAYS IS A ROW, including a node agent whose engine this
 * machine has never heard of: the property is a fact about the board and
 * travels, and a roster that hid one would be hiding a node somebody wrote.
 */
export const rowsOf = (agents: Agents, chat: ChatState): ReadonlyArray<Row> =>
  agents.map((row) => {
    const live = chat.bound !== null && chat.bound === row.id
    return {
      ...row,
      standing: standingOf(row, chat, live),
      waiting: live ? chat.asking : 0,
    }
  })

/**
 * WHICH STANDING, and the order of the questions is the argument.
 *
 * NOT BOUND comes first because it is a fact about the ROW and not about any
 * conversation: nothing the panel is doing can make an unbound node agent
 * anything else.
 *
 * NOT THE OPEN ONE comes second, and it is where nearly every row lands: olai
 * runs one conversation, so at most one node agent has a process at all and
 * every other bound row is asleep. Asleep is not broken — the session is on
 * disk and pressing the row opens it — which is the kolu pill's own three-state
 * honesty read onto a roster.
 *
 * THE REST IS THE PANEL'S OWN PRECEDENCE, asked of `../chat/busy.ts` rather
 * than re-derived: which of *starting*, *working* and *waiting on you* the
 * panel is in is one decision with one home, and a roster working it out for
 * itself would be a second answer free to disagree with the header drawn beside
 * it — and the one that disagreed would be the one nobody was looking at.
 */
const standingOf = (row: NodeAgentRow, chat: ChatState, live: boolean): Standing => {
  if (row.session === null) return "unbound"
  if (!live) return "asleep"
  // `off` is a serve with no ACP agent at all and `gone` is one whose agent
  // died: two reasons, one thing a person can do about them, and the panel's
  // own header says them apart one click away.
  if (chat.status === "off" || chat.status === "gone") return "gone"
  const doing = busyIn(chat)
  if (doing === null) return "idle"
  return doing.kind === "starting" ? "waking" : doing.kind === "waiting" ? "needs-you" : "working"
}

/** How big a node agent's memory is, in words — the same count the standing
 *  instruction says in a sentence (`@olai/chat`'s `teaching.ts`), worded here
 *  for a chip. */
export const memoryOf = (row: Pick<NodeAgentRow, "memory">): string =>
  row.memory === 1 ? "1 row" : `${row.memory} rows`
