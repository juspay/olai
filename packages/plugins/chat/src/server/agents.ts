/**
 * THE AGENTS ROSTER, ASSEMBLED — the vault's `prop:agent-session` reading with
 * each session's live state and the last line this machine overheard.
 *
 * The roster is the one answer on this wire whose two halves are kept in two
 * different packages, deliberately and for a reason each of them argues at
 * length:
 *
 *   - `@olai/format`'s `agentsIn` is the DURABLE half, and since the human's
 *     2026-09-02 ruling it is nearly the whole thing. Which nodes carry a
 *     binding property, what they are called, which engine and which session
 *     the property names, how big their subtrees are — a reading of the set,
 *     moving on every published revision.
 *   - `olai-plugin-chat` supplies the MACHINE-LOCAL half: `sessions.ts` keeps the last
 *     line olai heard, and the scheduler reports every acquired node scope's
 *     status and questions. Both are runtime facts, not vault configuration.
 *
 * Neither package may hold the other's: the format has never seen a session and
 * the chat has never seen an outline. So the join is HERE, at the composition
 * root, which is the only place both are in hand — the same arrangement the
 * doorbells already live under, where core holds the served set and the plugin
 * holds the pick.
 *
 * ## Why this is a module and not four lines in the connector
 *
 * Because the carrier is shared by two readers that run at different times.
 * The CELL wants the join, per revision and per chat frame. The TEACHING wants
 * one row of the vault half, synchronously, in the middle of somebody's send
 * (`olai-plugin-chat`'s `Options.agentAt`) — and the chat is built BEFORE the runtime
 * that would otherwise own the reading, so a thunk over a carrier is what lets
 * the earlier of the two ask the later one's question. One carrier, written
 * once per revision, read by both.
 *
 * ## The readings point in OPPOSITE directions, which is the shape here
 *
 * The cell asks "for this node, what is its session?"; the teaching asks "for
 * this conversation, whose node agent is it?"; and the assign gesture asks "is
 * this node already talking through one?" — the same property read from either
 * end. All three are a scan over a list that is a handful of rows on any real
 * vault and is re-read per revision anyway; an index keyed the other way would
 * be a second copy of the property to keep in step.
 *
 * ## The join itself is PURE and is the interesting part
 *
 * {@link joined} takes the durable list, overheard rows and live scopes and
 * answers the wire's rows, so what an agent
 * nobody has started a session for says, and what happens to a line olai heard
 * in a session the property no longer names, are decided in a unit test rather
 * than by serving a directory.
 *
 * ## WHERE THE KEY COMES FROM, which is this carrier and nowhere else
 *
 * `@olai/format` spells no plugin's word ({@link ./kinds.ts}, and that module's
 * header argues why), so the reading takes the vault's DECLARATIONS and this
 * kind's composed word as arguments. Both are resolved here, once per revision,
 * off the same derivation the rows are read from — which is what makes
 * {@link Roster.keys} possible at all: the WRITE side of this plugin needs the
 * key as much as the reading does, and a second place that decided it would be a
 * second answer to which column a board keeps its bindings in.
 */

import type { Conversing, LiveSession, Overheard } from "olai-plugin-chat"
import {
  customText,
  declarationsOf,
  type Derived,
  isPutAway,
  isRegular,
  declaredFor,
  keysDeclaredAs,
  mintedInto,
  nearestAtOrAbove,
  NO_AGENTS,
  type NodeAgent,
  type NodeAgents,
  PROPERTIES,
  type PropDeclarations,
  propertiesIn,
  seatableIn,
} from "@olai/format"
import {
  type Agents,
  type Migration,
  NAMED_AT_MOST,
  NO_AGENT_ROSTER,
} from "olai-plugin-chat/wire"

import { seatingIn } from "../seating.ts"
import { ownKinds, SESSION_KIND, SESSION_TYPE } from "../kinds.ts"


/**
 * WHAT THIS VAULT IS OWED to get its node agents back, or `null`.
 *
 * ## The reading, in one line
 *
 * A board is owed this when it holds bindings under the RETIRED spelling and
 * nothing declares that key. Both halves matter and both are cheap: the
 * declarations are the same fold the rows come off, and the walk is guarded by
 * it — a vault that has declared the key (which is every vault after the row is
 * pasted, and every vault that never used the old word) pays one map read.
 *
 * ## Why this lives here rather than in the validator
 *
 * `@olai/format` used to file this as a `legacy-key` finding, and the cost was
 * the objection: a finding BREAKS the file it sits on, the only honest file for
 * this one is the declarations page, so the notice put that page into
 * errors-only and refused every other write to it until somebody pasted the
 * row. The one file every declared kind depends on, darkened to deliver a
 * notice about one plugin's key.
 *
 * Nothing about it was ever general either. `ContributedKind.wasCalled` had one
 * writer and one reader in the whole tree, both of them about this key — so the
 * mechanism was a plugin's migration wearing core's clothes. The kind is ours,
 * the retired spelling is ours, and the composed word to paste is ours; the
 * sentence is ours as well, and saying it costs the vault nothing.
 *
 * ## FIRST SPELLING WINS, and the count is of RECORDS
 *
 * A hand-edited node carrying two cases of one key is one thing to fix, and the
 * number in the sentence is a number a person counts against their own board.
 * `customText` is asked under the exact retired spelling rather than folded,
 * because what a person greps for is what is written down.
 */
const migrationOwed = (
  derived: Derived,
  declarations: PropDeclarations,
): Migration | null => {
  // ASKED OF THE DECLARATIONS FIRST, which is what makes this free for every
  // board that owes nothing — nearly every board, and one map read for the rest.
  //
  // ANY DECLARATION ENDS IT, not only one naming this kind, and that is the
  // rule rather than a looseness: a row declaring the key `text` is a board
  // saying the column is prose, which is a whole answer to the question, and a
  // reading that went on nagging past it would be arguing with the person. The
  // fold is the shared one (`/format`'s `withClaims`, the one place
  // precedence lives), so a vault's own row wins here exactly as it does
  // everywhere else.
  if (declaredFor(declarations, SESSION_KIND) !== undefined) return null
  const holding: Array<string> = []
  let more = 0
  for (const located of derived.nodes) {
    if (isPutAway(located.file)) continue
    if (!isRegular(located)) continue
    if (customText(located.node, SESSION_KIND)?.trim() === undefined) continue
    if (holding.length < NAMED_AT_MOST) holding.push(located.node.id)
    else more += 1
  }
  if (holding.length === 0) return null
  return {
    key: SESSION_KIND,
    kind: SESSION_TYPE,
    // THE FILE THE ROW GOES IN: the one this vault already declares in, or the
    // one it would mint. Found by name like every other convention, so a
    // directory keeping its declarations somewhere of its own is told to edit
    // the file it has.
    at: propertiesIn(derived.byFile.keys()) ?? mintedInto(PROPERTIES),
    holding,
    more,
  }
}
export interface Roster {
  /**
   * A published revision arrived — re-read the vault's half.
   *
   * `null` is a store that has never loaded, and the answer is NO NODE AGENTS
   * rather than an unknown number of them: an empty roster draws nothing, which
   * is what a directory with no `agent-session` property anywhere draws and
   * what the sidebar showed while the first frame was arriving.
   */
  readonly seen: (derived: Derived | null) => void
  /**
   * WHOSE NODE AGENT THIS CONVERSATION IS, or `null` for one no node claims —
   * which is nearly every conversation, and also a property still naming a
   * session in a record somebody has since trashed.
   *
   * THE FIRST NODE WINS where two properties name one session, which is the
   * same first-claim-wins rule the set's own id index keeps: a session belongs
   * to one node agent, so a second node naming it is somebody's copied
   * property rather than a second answer.
   */
  readonly agentAt: (to: Conversing) => NodeAgent | null
  /**
   * ... AND THE SAME READING FROM THE NODE'S END: this node's row, or `null`
   * for a node that is not a node agent — which is every other row of every
   * outline.
   *
   * The one caller is the gesture that ASSIGNS a conversation to a node
   * (`./runtime.ts`), and what it needs is the half of the property a browser
   * must not judge for itself: whether this node is already talking through a
   * conversation. A tab decides that against the frame it was drawn on, which
   * is the right answer for a dimmed row and the wrong one for a write — two
   * tabs, or one left open while a `•••` verb ran, and the check would pass
   * against a roster that has moved.
   *
   * A SCAN, for {@link agentAt}'s reason word for word: a handful of rows,
   * re-read per revision, asked once per gesture.
   */
  readonly nodeAt: (node: string) => NodeAgent | null
  /**
   * ...AND WHETHER A NODE COULD BE ONE, which is a different question that used
   * to be answered with that one.
   *
   * {@link nodeAt} is the query over the BINDING, so it says `null` about every
   * node that has not got one — and the gesture that WRITES a binding is
   * precisely a gesture about such a node. What that gesture needs to know is
   * only that there is a record there to seat an agent at
   * (`@olai/format`'s `seatableIn`, which argues the three tests).
   */
  readonly seatableAt: (node: string) => boolean
  /** WHAT THIS VAULT IS OWED to get its node agents back, or `null` — the
   *  reading above ({@link migrationOwed}), off the same fold the rows and the
   *  keys come from, so a revision cannot answer the three from two readings. */
  readonly migration: () => Migration | null
  /** Every durable row, including sleeping agents with no acquired scope. */
  readonly nodes: () => NodeAgents
  /**
   * WHICH KEY A BINDING IS WRITTEN UNDER — the vault's own row where it has
   * one, and the word this kind claims where it has not.
   *
   * The first of {@link Roster.keys}, named on its own because the two readers
   * want the two ends of one list and a writer that reached for `[0]` would be
   * spelling that precedence a second time. It is `@olai/format`'s
   * `keysDeclaredAs` order: a board carrying the migration row means
   * `agent-session`, a board that has said nothing means `chat-agent-session`.
   */
  readonly key: () => string
  /**
   * ...AND EVERY KEY IT COULD BE READ FROM, which is what the FENCE forbids.
   *
   * ALL OF THEM, and that is not belt-and-braces: a vault mid-migration
   * declares two keys of this kind, and this package's own roster reads a
   * binding off either — so a fence naming only the key it WRITES would leave
   * the other as a door a seated agent could re-seat itself through.
   *
   * NEVER EMPTY. This plugin's kind is enabled by construction wherever this
   * carrier exists, so the claim is always in the fold; a store that has never
   * loaded has no declarations at all and answers with the claimed word, which
   * is what an empty vault's fold produces anyway — so nothing downstream has a
   * second state to hold. The one board that can empty the fold is one that has
   * declared the claimed key something ELSE, which is a board saying it keeps no
   * bindings; the claimed word is still the honest thing to fence, because it is
   * the key a write with nothing declared would land on.
   */
  readonly keys: () => ReadonlyArray<string>
  /** The nearest candidate node at or above an arbitrary node. */
  readonly nearestAt: (node: string, candidates: ReadonlySet<string>) => string | null
  /** The nearest node agent strictly above this one, named for a refusal. */
  readonly above: (node: string) => string | null
  /** The rows the cell carries: the vault's half, wearing what olai overheard
   *  the sessions it names say. */
  readonly rowsWith: (
    overheard: ReadonlyArray<Overheard>,
    live?: ReadonlyMap<string, LiveSession>,
  ) => Agents
}

/** The carrier and the two readings over it — one per served directory, built
 *  at the composition root. */
export const roster = (): Roster => {
  // The vault's half, replaced whole per revision. A `let` and not a
  // `SubscriptionRef`: both readers are synchronous and neither wants to be
  // woken — the cell's connector is already running on the revision that moved
  // this, and the teaching asks in the middle of a send.
  let held: NodeAgents = NO_AGENTS
  let reading: Derived | null = null
  // ...and the keys that revision declares this kind on, resolved in the same
  // breath as the rows and off the same fold. The claimed word is what a store
  // that has never loaded answers with — see {@link Roster.keys}.
  let keys: ReadonlyArray<string> = [SESSION_TYPE]
  // ...and what this board is owed, off the same fold. `null` for a store that
  // has never loaded, which is what it is for every board that owes nothing.
  let owed: Migration | null = null
  const nearest = (node: string, candidates: ReadonlySet<string>): string | null =>
    reading === null ? null : nearestAtOrAbove(reading, node, candidates)
  return {
    seen: (derived) => {
      reading = derived
      if (derived === null) {
        held = NO_AGENTS
        keys = [SESSION_TYPE]
        owed = null
        return
      }
      // ONE FOLD, read twice. `declarationsOf` is a memo on the derivation, so
      // asking it here costs the walk the validator has already paid for — and
      // the rows and the keys cannot come from two different readings of one
      // revision, which is the whole reason they are assigned together.
      const declarations = declarationsOf(derived, ownKinds)
      held = seatingIn(derived)
      const declared = keysDeclaredAs(declarations, SESSION_TYPE)
      keys = declared.length === 0 ? [SESSION_TYPE] : declared
      owed = migrationOwed(derived, declarations)
    },
    agentAt: (to) =>
      held.find((one) => one.engine === to.agent && one.session === to.session) ?? null,
    nodeAt: (node) => held.find((one) => one.id === node) ?? null,
    seatableAt: (node) => reading !== null && seatableIn(reading, node),
    migration: () => owed,
    nodes: () => held,
    key: () => keys[0] ?? SESSION_TYPE,
    keys: () => keys,
    nearestAt: nearest,
    above: (node) => {
      if (reading === null) return null
      const agents = new Set(held.map((one) => one.id))
      agents.delete(node)
      const parent = nearest(node, agents)
      if (parent === null) return null
      const agent = held.find((one) => one.id === parent)
      return agent === undefined ? null : `“${agent.title}” (\`${parent}\`)`
    },
    rowsWith: (overheard, live) => joined(held, overheard, live),
  }
}

/**
 * THE ROWS, JOINED — one per node agent the VAULT knows about, in the order the
 * vault answers.
 *
 * THE VAULT LEADS, and that is the whole shape of it: the roster IS the query
 * `prop:` over whatever key this vault declares the kind on, so a node with the
 * property is a row whether or not
 * anybody has started a session for it, and a line olai overheard in a session
 * no property names is not a row at all — it is a conversation the panel is
 * simply in, and the record ages it out ({@link olai-plugin-chat}'s `sessions.ts`).
 *
 * A NODE AGENT WITH NO SESSION carries `session: null`, which is a state the
 * sidebar draws in its own words rather than folding into *asleep*: nothing is
 * asleep there, there is no conversation at all.
 *
 * WHAT OLAI HEARD IS MATCHED ON THE PAIR, never on the session alone: a session
 * id means nothing to the wrong agent, and a property that has been re-pointed
 * at another engine's conversation must not wear the line the old one said.
 */
export const joined = (
  agents: NodeAgents,
  overheard: ReadonlyArray<Overheard>,
  live: ReadonlyMap<string, LiveSession> = new Map(),
): Agents => {
  if (agents.length === 0) return NO_AGENT_ROSTER
  return agents.map((agent) => ({
    ...agent,
    standing: standingOf(agent, live.get(agent.id)),
    waiting: live.get(agent.id)?.asking ?? 0,
    // The one fact olai writes back that a face draws, `null`-on-the-wire
    // where the record carries an absent key: the wire is a decoded value a
    // browser reads per frame, and an optional key there would be one more
    // state for a face to have an opinion about — the same line `Wake.fault`
    // is drawn on one cell over.
    said: (agent.session === null
      ? undefined
      : overheard.find((row) => row.agent === agent.engine && row.session === agent.session)
        ?.said) ?? null,
  }))
}

const standingOf = (
  agent: NodeAgent,
  live: LiveSession | undefined,
): Agents[number]["standing"] => {
  if (agent.session === null) return "unbound"
  if (live === undefined) return "asleep"
  if (live.status === "off" || live.status === "gone") return "gone"
  if (live.status === "booting") return "waking"
  if (live.asking > 0) return "needs-you"
  return live.status === "thinking" ? "working" : "idle"
}
