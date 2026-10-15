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
  declarationsOf,
  isRegular,
  type Derived,
  keysDeclaredAs,
  nearestAtOrAbove,
  NO_AGENTS,
  type NodeAgent,
  type NodeAgents,
  seatableIn,
  textDeclaredAs,
} from "@olai/format"
import { type Agents, NO_AGENT_ROSTER } from "olai-plugin-chat/wire"

import { seatingIn } from "../seating.ts"
import type { Forecast } from "../wire/agents.ts"
import { ownKinds, SLEEPING_TYPE, SLEPT_TYPE, SESSION_TYPE } from "../kinds.ts"

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
  /** Every durable row, including sleeping agents with no acquired scope. */
  readonly nodes: () => NodeAgents
  /** THE SET THE ROWS WERE JUST BUILT FROM, or `null` before the first revision
   *  — the same `reading` {@link Roster.sleeps} and {@link Roster.sleptAt} answer
   *  out of. Handed to the sleeper so its forecast is judged over the set a
   *  person is looking at rather than over whatever the LOOP last read: the loop
   *  reads once a tick, and a strip a quarter of an hour behind an edit would say
   *  "nothing new to tidy" about a memory somebody is writing. */
  readonly reading: () => Derived | null
  /**
   * WHICH KEY A BINDING IS WRITTEN UNDER — the vault's own row where it has
   * one, and the word this kind claims where it has not.
   *
   * The first of {@link Roster.keys}, named on its own because the two readers
   * want the two ends of one list and a writer that reached for `[0]` would be
   * spelling that precedence a second time. It is `@olai/format`'s
   * `keysDeclaredAs` order: a board that declares this kind on a column of its
   * own means that column, a board that has said nothing means
   * `chat-agent-session`.
   */
  readonly key: () => string
  /**
   * ...AND EVERY KEY IT COULD BE READ FROM, which is what the session may not write.
   *
   * ALL OF THEM, and that is not belt-and-braces: a vault mid-migration
   * declares two keys of this kind, and this package's own roster reads a
   * binding off either — so a door forbidding only the key it WRITES would
   * leave the other as a way a seated agent could re-seat itself.
   *
   * NEVER EMPTY. This plugin's kind is enabled by construction wherever this
   * carrier exists, so the claim is always in the fold; a store that has never
   * loaded has no declarations at all and answers with the claimed word, which
   * is what an empty vault's fold produces anyway — so nothing downstream has a
   * second state to hold. The one board that can empty the fold is one that has
   * declared the claimed key something ELSE, which is a board saying it keeps no
   * bindings; the claimed word is still the honest thing to forbid, because it
   * is the key a write with nothing declared would land on.
   */
  readonly keys: () => ReadonlyArray<string>
  /**
   * WHICH KEY A SLEEP MEMO IS WRITTEN UNDER — {@link key}'s rule read for the
   * other kind this plugin teaches, one field over: the vault's own column
   * where it declared one, and the word this kind claims where it has not.
   */
  readonly sleptKey: () => string
  /**
   * ...AND EVERY KEY THAT MEMO COULD BE READ FROM, which is the same list
   * {@link keys} keeps and for the same reason: a board mid-migration declares
   * two keys of this kind, and the door that refuses a seated agent's writes
   * must forbid both or leave the other as a way in.
   */
  readonly sleptKeys: () => ReadonlyArray<string>
  /**
   * WHEN THIS NODE AGENT LAST TIDIED ITS SUBTREE, off whichever of this vault's
   * keys for that kind carries one — `null` for a node that is not an agent and
   * for one that has never slept.
   *
   * HERE rather than at the pass that reads it because the answer is a fact
   * about the vault's declarations, and this is the module that holds them:
   * the pass asks about fifteen nodes a tick and may not spell the key.
   */
  readonly sleptAt: (node: string) => string | null
  /**
   * WHICH KEY THIS CHAT'S SLEEPING MARK IS WRITTEN UNDER — {@link sleptKey}'s
   * rule read for the third kind this plugin teaches, one field over: the vault's
   * own column where it declared one, and the word this kind claims where it has
   * not.
   */
  readonly sleepKey: () => string
  /**
   * ...AND EVERY KEY THAT MARK COULD BE READ FROM, which is the same list
   * {@link keys} keeps and for the same reason: a board mid-migration declares
   * two keys of this kind, and the door that refuses a seated agent's writes
   * must forbid both or leave the other as a way in.
   */
  readonly sleepKeys: () => ReadonlyArray<string>
  /**
   * WHETHER THIS CHAT IS TIDIED ON ITS OWN CLOCK — a person's answer, read off
   * whichever of this vault's keys for that kind carries one.
   *
   * ABSENT AND `off` ARE THE SAME ANSWER, and the whole feature rests on it:
   * nothing is tidied until somebody says so. HERE rather than at the loop, for
   * {@link sleptAt}'s reason — the answer is a fact about the vault's
   * declarations, and this is the module that holds them.
   */
  readonly sleeps: (node: string) => boolean
  /** The nearest candidate node at or above an arbitrary node. */
  readonly nearestAt: (node: string, candidates: ReadonlySet<string>) => string | null
  /** The rows the cell carries: the vault's half, wearing what olai overheard
   *  the sessions it names say. */
  readonly rowsWith: (
    overheard: ReadonlyArray<Overheard>,
    live?: ReadonlyMap<string, LiveSession>,
    /** WHAT THE PASS IS DOING FOR A NODE, or `null` — the sleeper's answer, handed
     *  in because this carrier is about the vault and the roster, and the forecast
     *  belongs to the pass (`./sleep.ts`). */
    sleep?: (node: string) => Forecast | null,
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
  // ...and the same pair for the sleep memo, resolved off the same fold and in
  // the same breath — see {@link Roster.sleptKey}.
  let sleptKeys: ReadonlyArray<string> = [SLEPT_TYPE]
  // ...and the same pair for the sleeping mark, off the same fold and in the
  // same breath — see {@link Roster.sleepKey}.
  let sleepingKeys: ReadonlyArray<string> = [SLEEPING_TYPE]
  const nearest = (node: string, candidates: ReadonlySet<string>): string | null =>
    reading === null ? null : nearestAtOrAbove(reading, node, candidates)
  /** See {@link Roster.sleeps} — and read through one closure, because the row
   *  join wants the same answer the loop does. */
  const sleeping = (node: string): boolean => {
    if (reading === null) return false
    const at = reading.byId.get(node)
    if (at === undefined || !isRegular(at)) return false
    return textDeclaredAs(declarationsOf(reading, ownKinds), at.node, SLEEPING_TYPE)?.trim() === "on"
  }
  return {
    seen: (derived) => {
      reading = derived
      if (derived === null) {
        held = NO_AGENTS
        keys = [SESSION_TYPE]
        sleptKeys = [SLEPT_TYPE]
        sleepingKeys = [SLEEPING_TYPE]
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
      const declaredSlept = keysDeclaredAs(declarations, SLEPT_TYPE)
      sleptKeys = declaredSlept.length === 0 ? [SLEPT_TYPE] : declaredSlept
      const declaredSleeping = keysDeclaredAs(declarations, SLEEPING_TYPE)
      sleepingKeys = declaredSleeping.length === 0 ? [SLEEPING_TYPE] : declaredSleeping
    },
    agentAt: (to) =>
      held.find((one) => one.engine === to.agent && one.session === to.session) ?? null,
    nodeAt: (node) => held.find((one) => one.id === node) ?? null,
    seatableAt: (node) => reading !== null && seatableIn(reading, node),
    nodes: () => held,
    reading: () => reading,
    key: () => keys[0] ?? SESSION_TYPE,
    keys: () => keys,
    sleptKey: () => sleptKeys[0] ?? SLEPT_TYPE,
    sleptKeys: () => sleptKeys,
    sleptAt: (node) => {
      if (reading === null) return null
      const at = reading.byId.get(node)
      if (at === undefined || !isRegular(at)) return null
      return textDeclaredAs(declarationsOf(reading, ownKinds), at.node, SLEPT_TYPE) ?? null
    },
    sleepKey: () => sleepingKeys[0] ?? SLEEPING_TYPE,
    sleepKeys: () => sleepingKeys,
    sleeps: sleeping,
    nearestAt: nearest,
    rowsWith: (overheard, live, sleep) => joined(held, overheard, live).map(row => {
      const located = reading?.byId.get(row.id)
      const changed = located !== undefined && isRegular(located) ? located.node.changed : undefined
      // ...AND WHETHER THIS ONE IS TIDIED ON ITS OWN CLOCK, joined here for
      // {@link Roster.sleeps}'s reason: the row is what a verb labels itself
      // off, and a browser cannot ask the vault's declarations.
      return {
        ...row,
        sleeps: sleeping(row.id),
        sleep: sleep?.(row.id) ?? null,
        ...(changed === undefined ? {} : { changed }),
      }
    }),
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
  /** THE ROW AS THE VAULT AND THIS MACHINE KNOW IT, minus the TWO fields only the
   *  caller can answer: whether this chat is tidied on its own clock is a fact
   *  about the vault's DECLARATIONS, and what its sleep is doing is the pass's own
   *  judgement — neither of which this walk is handed ({@link Roster.sleeps} and
   *  the sleeper are, and {@link Roster.rowsWith} joins both on). */
): ReadonlyArray<Omit<Agents[number], "sleeps" | "sleep">> => {
  if (agents.length === 0) return NO_AGENT_ROSTER
  return agents.map((agent) => ({
    ...agent,
    standing: standingOf(agent, live.get(agent.id)),
    ...(live.get(agent.id)?.since === undefined ? {} : { since: live.get(agent.id)!.since }),
    // A PASS'S OWN QUESTION IS NOT SOMEBODY'S TO ANSWER, so it is not counted
    // here — and this one line is the whole of what keeps a sleep from waking a
    // person. The four faces that alert (the chime, the OS notification, the
    // badge and the Needs-you listing) all derive from this count or from the
    // standing below, which is why nothing else had to learn about the mark.
    waiting: live.get(agent.id)?.sleep === true ? 0 : live.get(agent.id)?.asking ?? 0,
    ...(live.get(agent.id)?.unopened === true ? { unopened: true } : {}),
    // The one fact olai writes back that a face draws, `null`-on-the-wire
    // where the record carries an absent key: the wire is a decoded value a
    // browser reads per frame, and an optional key there would be one more
    // state for a face to have an opinion about — the same line `Wake.fault`
    // is drawn on one cell over.
    said: (agent.session === null
      ? undefined
      : overheard.find((row) => row.agent === agent.engine && row.session === agent.session)
        ?.said) ?? null,
    // ...AND THE OTHER HALF OF THAT LINE, matched on the same PAIR for the same
    // reason: what somebody acknowledged in one conversation says nothing about
    // another. `null`-on-the-wire where the record carries none, so a reader
    // compares one instant against `said.at` and never has to hold a third
    // state for "no answer at all" ({@link olai-plugin-chat/wire}'s `seen`).
    seen: (agent.session === null
      ? undefined
      : overheard.find((row) => row.agent === agent.engine && row.session === agent.session)
        ?.seen) ?? null,
  }))
}

const standingOf = (
  agent: NodeAgent,
  live: LiveSession | undefined,
): Agents[number]["standing"] => {
  if (agent.session === null) return live?.unopened === true ? "needs-you" : "unbound"
  if (live === undefined) return "asleep"
  if (live.status === "off" || live.status === "gone") return "gone"
  if (live.status === "booting") return "waking"
  // ... AND OLAI'S OWN TURN IS WORK, never a question — ABOVE the count, so a
  // pass that asks something is still drawn as working rather than as needing
  // anybody. Below `gone` and `waking`, because a pass whose conversation died
  // is a conversation that died, and the mark only ever suppresses the one
  // thing it is for.
  if (live.sleep === true && live.status === "thinking") return "working"
  if (live.asking > 0) return "needs-you"
  return live.status === "thinking" ? "working" : "idle"
}
