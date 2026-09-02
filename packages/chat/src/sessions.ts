/**
 * WHAT OLAI OVERHEARD ONE CONVERSATION DO — that a session has been told its
 * node agent's contract, and the last line its agent said while olai was
 * watching.
 *
 * The third per-directory record this package keeps, beside the one that
 * remembers which conversation the panel was in ({@link ./memory.ts}) and the
 * one that remembers which doorbells are on ({@link ./scopes.ts}).
 *
 * ## Why these two are here and the pointer is NOT
 *
 * Which node agent a session belongs to is CONFIG, and since the human's ruling
 * of 2026-09-02 all config lives in `.olai` files or their properties: the
 * `agent-session` property both marks a node as a node agent and carries its
 * session pointer (`@olai/format`'s `agents.ts`, which argues the value shape
 * and what a second machine sees). This file used to hold that pointer and no
 * longer does — what is left is the half that was never config:
 *
 *   - {@link Overheard.taught} — that this SESSION has already been told its
 *     contract ({@link ./teaching.ts}). "Exactly once, and not again after a
 *     restart" is a fact about a message that was sent, which is
 *     {@link ./scopes.ts}'s `fault` argument word for word: nothing can
 *     re-derive it, and a serve that forgot would re-teach on every boot. It is
 *     written against the session it was said in, so a fresh session is untaught
 *     — which is the point, since the transcript is exactly what does not carry
 *     the contract.
 *   - {@link Overheard.assigned} — that this session was MOVED to a node agent
 *     rather than opened for one. It decides WHICH of the two standing
 *     instructions goes out ({@link ./teaching.ts}), and it is the same kind of
 *     fact `taught` is: a gesture happened once and nothing can re-derive it —
 *     the transcript of a chat somebody assigned is indistinguishable from the
 *     transcript of one olai opened for a node.
 *   - {@link Overheard.superseded} — the conversation that replaced this one,
 *     WHERE OLAI ITSELF DID THE REPLACING. The adapter reports a `/clear` in
 *     its own corner of `session/list` ({@link ./events.ts}'s `Stored`) and
 *     says nothing about a re-pointing olai made, so without this a node
 *     agent's own previous session would come back as a conversation nobody
 *     claims ({@link ./succession.ts}).
 *   - {@link Overheard.said} — the last thing this agent said WHILE OLAI WAS
 *     WATCHING. The panel runs one conversation at a time, so an agent that is
 *     not the open one has no transcript here to read a line off; without this,
 *     the door on its row could say what it is and never what it was doing. The
 *     honesty is in the words rather than in a guess: this is a line olai heard
 *     and wrote down, in the same sense the model note is a switch olai saw
 *     ({@link ./memory.ts}), and a conversation somebody drove from a terminal
 *     moves it not at all.
 *
 * None of them could be put in the vault without writing to the board on every
 * turn, which is a commit on every turn — so the ruling's line is kept where it
 * is drawn: config in the vault, bookkeeping on the machine. WHICH node a
 * session belongs to is the config half and is the property; that a chat was
 * assigned, and what replaced it, are things that HAPPENED here.
 *
 * ## KEYED ON THE CONVERSATION, which is the whole shape change
 *
 * The rows are keyed on the `(agent, session)` PAIR and know nothing about
 * nodes. That is not a smaller version of the old table; it is the table the
 * two remaining facts always wanted, and it is why re-pointing a node at
 * another conversation needs nothing here: both facts were always ABOUT the
 * session, and the node was a key they were reached through. A node agent given
 * a fresh session is untaught and has said nothing, because that session has
 * not been taught and has not said anything — no row has to be cleared for that
 * to be true.
 *
 * ## Written only by olai, and therefore CAPPED
 *
 * Nobody hand-writes this file — the gesture that binds a node writes a
 * property now, and these rows appear behind turns a person is having and
 * behind the two gestures that move a binding. So it grows one row per session
 * that is ever taught, assigned or replaced, and it is capped the way
 * {@link ./scopes.ts} is and for the same reason: {@link ROWS} rows,
 * least-recently-touched evicted, because a count cap costs no probe and cannot
 * be wrong about a conversation it has never asked about. What an eviction
 * costs is one re-teaching in a conversation somebody comes back to after
 * thirty-odd others, which is a sentence at the top of a transcript rather than
 * anything lost.
 *
 * It is still read LENIENTLY, field by field — an older olai's file is read by
 * a newer one, and a row that will not parse is a session that gets taught
 * again rather than a serve that will not start.
 *
 * ## Behind ONE permit, for {@link ./scopes.ts}'s reason exactly
 *
 * Every writer here is a read-modify-write over one in-memory mirror: read
 * `rows`, replace one, assign back. Two of those interleaved lose a write, and
 * no staging name at the leaf has anything to say about it — the hazard is over
 * MEMORY. Both writers are on one permit, and the record goes to disk before
 * the mirror moves, so a failure a caller is handed means nothing stuck
 * anywhere.
 *
 * ## What it does with a failure
 *
 * A read at boot that fails is an EMPTY MIRROR and one warning, never a refusal
 * to serve — the discipline this package's other two records already keep. A
 * WRITE that fails is different in the other direction from theirs: nobody made
 * a gesture, so there is nobody to tell, and both writers here are bookkeeping
 * behind a turn a person is watching for something else. They FAIL, with a
 * reason, and the caller logs it and carries on ({@link ./chat.ts}) — the cost
 * of a lost write is a contract taught twice or a door line one turn stale,
 * which is not worth taking a turn away from somebody over.
 *
 * ## Not a second failure vocabulary
 *
 * {@link ./memory.ts}'s `MemoryFailure` is this package's word for "a kept
 * record would not read or write", and this is a third kept record rather than
 * a third kind of problem.
 */

import { canonical, fileFor, readHeld, writeHeld } from "@olai/state"
import { Effect, Semaphore } from "effect"

import { MemoryFailure, word } from "./memory.ts"
import { ROWS } from "./scopes.ts"

/** The `kind` these files live under in the state home — the third
 *  subdirectory, beside `chat`'s and `wake`'s. */
const HEARD = "heard"

/** The pair that identifies a conversation everywhere in this package: a
 *  session id means nothing to the wrong agent, so neither half stands alone
 *  ({@link ./memory.ts}, `@olai/surface`'s `SessionInfo`). */
export interface Conversing {
  readonly agent: string
  readonly session: string
}

/** The last thing an agent said while olai was watching — see the header for
 *  what that qualification is doing there. */
export interface Said {
  /** ONE LINE, already cut to one by whoever heard it: what the door draws is
   *  a line, and a record holding a screenful so that a component could take
   *  the first line of it would be storing the rest for nobody. */
  readonly text: string
  /** ISO 8601, so a door can say how long ago without a second clock. */
  readonly at: string
}

/**
 * ONE CONVERSATION, and what olai overheard it do.
 *
 * ## THE ARRAY IS THE ORDER, exactly as {@link ./scopes.ts}'s is
 *
 * The rows are held touched-oldest-first and there is no second copy of that:
 * no stamp, no counter. A writer drops the row it is about to replace and
 * re-appends it, which is the touch, and {@link capped} takes from the front.
 * A stamp beside it would be the position spelled twice and kept in step by
 * hand.
 */
export interface Overheard extends Conversing {
  /** This SESSION has already been told its contract. Absent is untaught,
   *  which is what every conversation starts as. */
  readonly taught?: boolean
  /**
   * This session was ASSIGNED to a node agent — an ordinary chat given a home
   * rather than a conversation opened for one.
   *
   * NOT CLEARED when a node lets it go, because what it says is how this
   * conversation ARRIVED, and that does not stop having happened. It is read
   * together with {@link taught} in the one place that asks, so a session
   * taught its migration contract is never taught a second one.
   */
  readonly assigned?: boolean
  /** The conversation that REPLACED this one, where olai made the replacement —
   *  a session id, with this row's own agent. Absent for every conversation
   *  nothing has replaced, and for a `/clear` the adapter already reports. */
  readonly superseded?: string
  /** The last line olai heard from it. Absent until olai has heard one. */
  readonly said?: Said
}

/**
 * The table, and the three things anybody does with it.
 *
 * A MIRROR plus a write, for {@link ./scopes.ts}'s reason: the roster is
 * assembled SYNCHRONOUSLY, per revision and per chat frame, by a composition
 * root with no Effect around it — so the in-memory copy is what answers and the
 * disk copy follows.
 */
export interface Sessions {
  /** Every row, touched-oldest-first. */
  readonly rows: () => ReadonlyArray<Overheard>
  /** What olai overheard this conversation do, or `undefined` for one it has
   *  overheard nothing from — which is every conversation until it is taught
   *  or says something. */
  readonly at: (to: Conversing) => Overheard | undefined
  /**
   * Mark this conversation as TAUGHT — said once, when the standing instruction
   * has actually gone out with a message the agent took.
   *
   * A no-op for one already marked: the table is not written, so a node agent's
   * conversation costs one write in its life and every other conversation costs
   * none.
   */
  readonly teach: (to: Conversing) => Effect.Effect<void, MemoryFailure>
  /**
   * Mark this conversation as ASSIGNED to a node agent — said once, by the
   * gesture that writes the pointer onto a node (`@olai/server`'s
   * `assignSession`), and after the property has landed rather than before it.
   *
   * A no-op for one already marked, for {@link teach}'s reason: the row already
   * says what this would write, and a chat is assigned once.
   */
  readonly assign: (to: Conversing) => Effect.Effect<void, MemoryFailure>
  /**
   * ... and write down that OLAI replaced this conversation with another —
   * said by the gesture that re-points a bound node at a fresh session.
   *
   * ON THE ROW OF THE SESSION LEFT BEHIND, which is the direction a listing
   * reads it in: `supersededBy` is a fact about the conversation that was
   * replaced ({@link ./succession.ts}), and a record shaped the other way would
   * have to be inverted at every read.
   *
   * A no-op where the row already names that successor; where it names a
   * DIFFERENT one, the newer wins, because a session replaced twice was
   * replaced last by the one that is bound now.
   */
  readonly supersede: (to: Conversing, by: string) => Effect.Effect<void, MemoryFailure>
  /**
   * ... and write down the last line this conversation's agent said.
   *
   * A no-op for a line whose WORDS are already the ones written down —
   * whatever instant comes with them.
   *
   * ON THE TEXT ALONE, and the stamp deliberately does not get a vote. This is
   * offered at every turn boundary, and a turn that adds no prose of its own
   * re-offers the line before it; a resumed conversation re-offers it with a
   * fresh instant besides, because a replay re-mints the rows it replays
   * ({@link ./heard.ts}). Writing on either would move the door's *7m ago*
   * forward over words that are days old — which is the one thing a feature
   * called "what olai heard" must not do.
   *
   * WHAT IT COSTS is an agent that repeats itself word for word in a later
   * turn: the door goes on showing the earlier instant. That is the safe
   * direction — understating how fresh a line is, never overstating it — and
   * the alternative cannot be told apart from the resume case by anything this
   * end holds.
   */
  readonly said: (
    to: Conversing,
    said: Said,
  ) => Effect.Effect<void, MemoryFailure>
}

/** What one of these files looks like written. */
interface Written {
  readonly heard?: unknown
}

/**
 * The rows a file holds, read field by field.
 *
 * BOTH NAMES ARE LOAD-BEARING and a row missing either is dropped: a row that
 * does not say which agent and which session names no conversation, and there
 * is nothing to guess. Everything else is read leniently and a strange value
 * reads as absent — the same rule {@link ./memory.ts}'s `word` is. A `taught`
 * that is not `true` is untaught, which costs one extra teaching; a `said` that
 * will not parse is a door with no line on it, which is what every door starts
 * as.
 */
const read = (held: Record<string, unknown>): ReadonlyArray<Overheard> => {
  const written = (held as Written).heard
  if (!Array.isArray(written)) return []
  const rows: Array<Overheard> = []
  for (const row of written as ReadonlyArray<unknown>) {
    if (typeof row !== "object" || row === null) continue
    const one = row as Record<string, unknown>
    const agent = word(one["agent"])
    const session = word(one["session"])
    if (agent === null || session === null) continue
    rows.push({
      agent,
      session,
      ...(one["taught"] === true ? { taught: true } : {}),
      ...(one["assigned"] === true ? { assigned: true } : {}),
      ...supersededIn(one["superseded"]),
      ...saidIn(one["said"]),
    })
  }
  return rows
}

/** The last-said line of a row, or nothing at all — both fields required,
 *  because a line with no instant cannot be drawn beside one and an instant
 *  with no line has nothing to say. */
const saidIn = (value: unknown): { readonly said?: Said } => {
  if (typeof value !== "object" || value === null) return {}
  const one = value as Record<string, unknown>
  const text = word(one["text"])
  const at = word(one["at"])
  return text === null || at === null ? {} : { said: { text, at } }
}

/** The successor a row names, or nothing at all — read by the same `word` every
 *  other name in this file is, so an empty string names no conversation and is
 *  absent rather than a link to nowhere. */
const supersededIn = (value: unknown): { readonly superseded?: string } => {
  const by = word(value)
  return by === null ? {} : { superseded: by }
}

/** The same conversation — the PAIR, never the session alone. */
const sameChat = (row: Conversing, to: Conversing): boolean =>
  row.agent === to.agent && row.session === to.session

/** See the header: the front of the array is the least recently touched. */
const capped = (rows: ReadonlyArray<Overheard>): ReadonlyArray<Overheard> =>
  rows.length <= ROWS ? rows : rows.slice(rows.length - ROWS)

export const forDirectory = (spelling: string): Effect.Effect<Sessions> =>
  Effect.gen(function*() {
    // ONE spelling from here down, and it is `@olai/state`'s — the resolution
    // this package's other two records name their files by, so a vault reached
    // through a symlink is one directory to all three.
    const cwd = canonical(spelling)
    const at = fileFor(HEARD, cwd)
    /** See the header: every writer here is a read-modify-write over `rows`. */
    const writing = yield* Semaphore.make(1)

    // AN EMPTY MIRROR AND ONE WARNING. Nobody is standing at the screen when a
    // boot reads this, and a directory whose overhearings cannot be read is a
    // directory where every node agent gets taught once more and every door
    // starts with no line on it — the honest face of exactly this failure, and
    // of a machine that has never served this vault before.
    const held = yield* Effect.result(readHeld(at, cwd))
    let rows: ReadonlyArray<Overheard> = []
    if (held._tag === "Failure") {
      yield* Effect.logWarning(
        `what olai had overheard in this directory could not be read (${held.failure.why}) — ` +
          `node agents will be taught their contract once more, and their doors start blank`,
      )
    } else if (held.success !== null) {
      rows = read(held.success)
    }

    /**
     * One row replaced or ADDED, written down, and the mirror moved only if it
     * landed.
     *
     * THE RECORD FIRST, for {@link ./scopes.ts}'s reason: the two are one fact
     * in two places, and a mirror that moved under a failed write would have a
     * conversation marked taught in memory and untaught on disk — so the next
     * restart teaches it again, having told the caller nothing went wrong.
     *
     * `change` is handed what olai already overheard, or `undefined` for a
     * conversation it has overheard nothing from, and answers with the row it
     * wants written — or `undefined` for NOTHING TO DO, which is what keeps a
     * repeated line and a second teaching off the disk entirely.
     *
     * DROPPED AND RE-APPENDED rather than written where it stood, which is the
     * touch {@link Overheard} describes: unlike `./scopes.ts`'s picks these
     * positions are nobody's file, and the row olai just overheard something
     * from is the last one it should evict.
     */
    const write = (
      to: Conversing,
      change: (row: Overheard | undefined) => Overheard | undefined,
    ): Effect.Effect<void, MemoryFailure> =>
      writing.withPermit(Effect.gen(function*() {
        const before = rows
        const next = change(before.find((row) => sameChat(row, to)))
        if (next === undefined) return
        const table = capped([
          ...before.filter((row) => !sameChat(row, to)),
          next,
        ])
        yield* Effect.mapError(
          writeHeld(at, { cwd, heard: table }),
          (failure) => new MemoryFailure(failure),
        )
        rows = table
      }))

    return {
      rows: () => rows,
      at: (to) => rows.find((row) => sameChat(row, to)),
      teach: (to) =>
        write(to, (row) => (row?.taught === true ? undefined : { ...row, ...to, taught: true })),
      assign: (to) =>
        write(
          to,
          (row) => (row?.assigned === true ? undefined : { ...row, ...to, assigned: true }),
        ),
      supersede: (to, by) =>
        write(
          to,
          (row) => (row?.superseded === by ? undefined : { ...row, ...to, superseded: by }),
        ),
      said: (to, said) =>
        write(to, (row) => (row?.said?.text === said.text ? undefined : { ...row, ...to, said })),
    }
  })
