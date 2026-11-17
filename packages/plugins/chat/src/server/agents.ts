/**
 * THE AGENTS ROSTER, ASSEMBLED — the vault's reading of everything that carries
 * a chat tie, with each session's live state and the last line this machine
 * overheard.
 *
 * TWO THINGS CAN CARRY ONE, and the roster is both in one list: a NODE, whose
 * tie is a property on its row and whose memory is the rows under it, and a
 * NOTE, whose tie is in the YAML block at the top of the `.md` and which IS its
 * own memory. Nodes first, then notes in corpus order (`../seating.ts`'s
 * `rosterIn`), and every lookup below is by ITEM KEY — a node's id, or `/` and
 * a note's path.
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
  itemOf,
  keysDeclaredAs,
  nearestAtOrAbove,
  NO_AGENTS,
  type NodeAgent,
  type NodeAgents,
  type Reading,
  seatableIn,
  seatableNote,
  textDeclaredAs,
} from "@olai/format"
import { type Agents, NO_AGENT_ROSTER } from "olai-plugin-chat/wire"

import { rosterIn } from "../seating.ts"
import type { Forecast } from "../wire/agents.ts"
import { OPENS_TYPE, ownKinds, SLEEPING_TYPE, SLEPT_TYPE, SESSION_TYPE } from "../kinds.ts"

/** AS MUCH OF A REVISION AS THE ROSTER READS — the records (a node's tie is a
 *  property on its row) and the documents (a note's is in its front matter).
 *  A published revision carries all three, and so does the reading a write
 *  commits against. */
export type RosterReading = Pick<Reading, "set" | "claims" | "derived">

export interface Roster {
  /**
   * A published revision arrived — re-read the vault's half.
   *
   * `null` is a store that has never loaded, and the answer is NO AGENTS
   * rather than an unknown number of them: an empty roster draws nothing, which
   * is what a directory with no tie anywhere draws and what the sidebar showed
   * while the first frame was arriving.
   */
  readonly seen: (reading: RosterReading | null) => void
  /**
   * WHOSE AGENT THIS CONVERSATION IS, or `null` for one no item claims —
   * which is nearly every conversation, and also a tie still naming a
   * session on a record somebody has since trashed.
   *
   * THE FIRST ITEM WINS where two ties name one session, which is the
   * same first-claim-wins rule the set's own id index keeps: a session belongs
   * to one agent, so a second item naming it is somebody's copied
   * tie rather than a second answer.
   */
  readonly agentAt: (to: Conversing) => NodeAgent | null
  /**
   * ... AND THE SAME READING FROM THE ITEM'S END: this item's row, or `null`
   * for an item that is not an agent — which is every other row of every
   * outline and every other note in the directory.
   *
   * BY ITEM KEY, which is a node's own id or `/` and a note's path
   * (`@olai/format`'s `itemKey`; ids olai writes cannot start with a slash, so
   * the two never collide). What a gesture needs is the half of the tie a
   * browser must not judge for itself: whether this item is already talking
   * through a conversation. A tab decides that against the frame it was drawn
   * on, which is the right answer for a dimmed row and the wrong one for a
   * write — two tabs, or one left open while a `•••` verb ran, and the check
   * would pass against a roster that has moved.
   *
   * A SCAN, for {@link agentAt}'s reason word for word: a handful of rows,
   * re-read per revision, asked once per gesture.
   */
  readonly nodeAt: (item: string) => NodeAgent | null
  /**
   * ...AND WHETHER AN ITEM COULD BE ONE, which is a different question that used
   * to be answered with that one.
   *
   * {@link nodeAt} is the query over the TIE, so it says `null` about every
   * item that has not got one — and the gesture that WRITES a tie is
   * precisely a gesture about such an item. What that gesture needs to know is
   * only that there is something there to seat an agent at: a record
   * (`@olai/format`'s `seatableIn`, which argues the three tests) or a note the
   * directory still holds and has not put away (`seatableNote`).
   */
  readonly seatableAt: (item: string) => boolean
  /** Every durable row, nodes then notes — including sleeping agents with no
   *  acquired scope. */
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
   * WHICH KEY A NOTE'S *opens* SWITCH IS WRITTEN UNDER — {@link key}'s rule
   * read for the fourth kind this plugin teaches: the vault's own column where
   * it declared one, and the word this kind claims where it has not.
   *
   * IT IS A FRONT-MATTER KEY and not a column, which changes nothing here: a
   * `.md`'s YAML block is custom values on a document exactly as a row's
   * properties are custom values on a record, and the declarations fold is the
   * same one ({@link @olai/format}'s `notesIn` reads it, the note writer writes
   * it).
   */
  readonly opensKey: () => string
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
  // THE WHOLE REVISION and not only its records, because half the roster is
  // read off the DOCUMENTS: a note's tie is in the YAML block at the top of the
  // file, and `seatableAt` has to answer about a path as well as about an id.
  let read: RosterReading | null = null
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
  // ...and the key a note's *opens* switch is written under, off the same fold
  // — see {@link Roster.opensKey}.
  let opensKeys: ReadonlyArray<string> = [OPENS_TYPE]
  const nearest = (node: string, candidates: ReadonlySet<string>): string | null =>
    read === null ? null : nearestAtOrAbove(read.derived, node, candidates)
  /** See {@link Roster.sleeps} — and read through one closure, because the row
   *  join wants the same answer the loop does.
   *
   *  A NOTE IS NEVER TIDIED, which needs no clause of its own: its key is a
   *  path and no record carries one, so the index below has nothing to find. */
  const sleeping = (node: string): boolean => {
    if (read === null) return false
    const at = read.derived.byId.get(node)
    if (at === undefined || !isRegular(at)) return false
    return textDeclaredAs(declarationsOf(read.derived, ownKinds), at.node, SLEEPING_TYPE)?.trim() === "on"
  }
  return {
    seen: (reading) => {
      read = reading
      if (reading === null) {
        held = NO_AGENTS
        keys = [SESSION_TYPE]
        sleptKeys = [SLEPT_TYPE]
        sleepingKeys = [SLEEPING_TYPE]
        opensKeys = [OPENS_TYPE]
        return
      }
      // ONE FOLD, read twice. `declarationsOf` is a memo on the derivation, so
      // asking it here costs the walk the validator has already paid for — and
      // the rows and the keys cannot come from two different readings of one
      // revision, which is the whole reason they are assigned together.
      const declarations = declarationsOf(reading.derived, ownKinds)
      held = rosterIn(reading)
      const declared = keysDeclaredAs(declarations, SESSION_TYPE)
      keys = declared.length === 0 ? [SESSION_TYPE] : declared
      const declaredSlept = keysDeclaredAs(declarations, SLEPT_TYPE)
      sleptKeys = declaredSlept.length === 0 ? [SLEPT_TYPE] : declaredSlept
      const declaredSleeping = keysDeclaredAs(declarations, SLEEPING_TYPE)
      sleepingKeys = declaredSleeping.length === 0 ? [SLEEPING_TYPE] : declaredSleeping
      const declaredOpens = keysDeclaredAs(declarations, OPENS_TYPE)
      opensKeys = declaredOpens.length === 0 ? [OPENS_TYPE] : declaredOpens
    },
    agentAt: (to) =>
      held.find((one) => one.engine === to.agent && one.session === to.session) ?? null,
    nodeAt: (item) => held.find((one) => one.id === item) ?? null,
    // THE TWO TESTS BEHIND ONE QUESTION, picked by what the key names: a record
    // this reading still holds and has not put away, or a `.md` it still holds
    // and has not put away. Neither is this module's rule — both are
    // `@olai/format`'s, read of the two things that can carry a tie.
    seatableAt: (item) => {
      if (read === null) return false
      const at = itemOf(item)
      return at.kind === "node"
        ? seatableIn(read.derived, at.id)
        : seatableNote(read.set, read.claims, at.path)
    },
    nodes: () => held,
    reading: () => read?.derived ?? null,
    key: () => keys[0] ?? SESSION_TYPE,
    keys: () => keys,
    sleptKey: () => sleptKeys[0] ?? SLEPT_TYPE,
    sleptKeys: () => sleptKeys,
    sleptAt: (node) => {
      if (read === null) return null
      const at = read.derived.byId.get(node)
      if (at === undefined || !isRegular(at)) return null
      return textDeclaredAs(declarationsOf(read.derived, ownKinds), at.node, SLEPT_TYPE) ?? null
    },
    sleepKey: () => sleepingKeys[0] ?? SLEEPING_TYPE,
    sleepKeys: () => sleepingKeys,
    opensKey: () => opensKeys[0] ?? OPENS_TYPE,
    sleeps: sleeping,
    nearestAt: nearest,
    rowsWith: (overheard, live, sleep) => joined(held, overheard, live).map(row => {
      const located = read?.derived.byId.get(row.id)
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
  return agents.map((agent) => {
    // THE ROW OLAI OVERHEARD, FOUND ONCE. Both halves of it are read below, and
    // a second `find` would be the pair rule spelled twice over the same array —
    // on the walk that runs per revision and per chat frame.
    const heard = agent.session === null
      ? undefined
      : overheard.find((row) => row.agent === agent.engine && row.session === agent.session)
    return {
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
      said: heard?.said ?? null,
      // ...AND THE OTHER HALF OF THAT LINE, off the same row: what a person has
      // acknowledged in this conversation. `null`-on-the-wire where none was
      // written, so a reader compares one instant against `said.at` and never
      // holds a third state for "no answer at all" (`olai-plugin-chat/wire`).
      seen: heard?.seen ?? null,
    }
  })
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
