/**
 * WHICH CONVERSATION EACH NODE AGENT IS BOUND TO — the node↔session pointer,
 * and the two things olai writes back beside it.
 *
 * The third per-directory record this package keeps, beside the one that
 * remembers which conversation the panel was in ({@link ./memory.ts}) and the
 * one that remembers which doorbells are on ({@link ./scopes.ts}). It is the
 * other half of what makes a node agent work: the `agent` PROPERTY creates one
 * and is board-durable — it is in the vault, it travels, an agent can write it
 * — while WHICH SESSION that node's agent is currently talking through is a
 * fact about this laptop and cannot travel at all. A session id means nothing
 * to another machine's agent, for the same reason the which-conversation note
 * is per-machine, so a vault served from two machines is one node agent with a
 * session on each and a subtree that keeps them coherent.
 *
 * ## HAND-BOUND, and that is the phase rather than an omission
 *
 * Nothing in olai writes a binding: there is no assign gesture, no picker, and
 * no `Unassigned` roster entry — all three are the next phase's, where a person
 * moves their real chats over one row at a time. What exists now is the FILE, so
 * the rest of the feature can be built and used over bindings somebody wrote by
 * hand (docs/chat.md names the path and the shape). Which is why this table is
 * read leniently and never CAPPED: `./scopes.ts` evicts because olai is what
 * fills that table, and a cap over rows a person authored would silently throw
 * away a binding they made.
 *
 * ## What olai writes back, and why exactly these two
 *
 * The pointer is the person's. Two facts beside it are olai's, and both exist
 * because they cannot be reconstructed:
 *
 *   - {@link Bound.taught} — that this SESSION has already been told its
 *     contract ({@link ./teaching.ts}). "Exactly once, and not again after a
 *     restart" is a fact about a message that was sent, which is
 *     {@link ./scopes.ts}'s `fault` argument word for word: nothing can
 *     re-derive it, and a serve that forgot would re-teach on every boot. It is
 *     written against the session it was said in, so a fresh session is untaught
 *     — which is the point, since the transcript is exactly what does not carry
 *     the contract.
 *   - {@link Bound.said} — the last thing this agent said WHILE OLAI WAS
 *     WATCHING. The panel runs one conversation at a time, so an agent that is
 *     not the open one has no transcript here to read a line off; without this,
 *     the door on its row could say what it is and never what it was doing. The
 *     honesty is in the words rather than in a guess: this is a line olai heard
 *     and wrote down, in the same sense the model note is a switch olai saw
 *     ({@link ./memory.ts}), and a conversation somebody drove from a terminal
 *     moves it not at all.
 *
 * Both are written against a session, so re-pointing a node at a different
 * conversation drops both — a new session has not been taught and has not said
 * anything here.
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

/** The `kind` these files live under in the state home — the third
 *  subdirectory, beside `chat`'s and `wake`'s. */
const AGENTS = "agents"

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
 * ONE BINDING: which conversation a node agent is talking through, and what
 * olai has learnt about it.
 *
 * KEYED ON THE NODE and not on the conversation, which is the direction the
 * whole design points: the node is the durable thing, the session is cattle.
 * One node has at most one current session — re-pointing it replaces the row —
 * and one session belongs to at most one node, which is a rule this file keeps
 * at the WRITE rather than in the type: {@link Bindings.at} answers the first
 * row that names a pair, and a file that bound two nodes to one conversation
 * would be a person having written two rows that cannot both be true.
 */
export interface Bound {
  /** The node agent's node id — `@olai/format`'s roster answers with the same
   *  spelling, and the join is on it. */
  readonly node: string
  /** ... and the conversation it is talking through. */
  readonly agent: string
  readonly session: string
  /** This SESSION has already been told its contract. Absent is untaught,
   *  which is what every row a person writes by hand starts as. */
  readonly taught?: boolean
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
export interface Bindings {
  /** Every binding, in the order the file holds them. */
  readonly rows: () => ReadonlyArray<Bound>
  /** Which node agent this conversation belongs to, or `undefined` for a
   *  conversation no node claims — which is nearly every conversation, and is
   *  the state the whole panel was in before node agents existed. */
  readonly at: (to: Conversing) => Bound | undefined
  /**
   * Mark this conversation as TAUGHT — said once, when the standing instruction
   * has actually gone out with a message the agent took.
   *
   * A no-op for a conversation no node claims, and for one already marked: the
   * table is not written, so a chat with an untaught node agent costs one write
   * in its life and every other conversation costs none.
   */
  readonly teach: (to: Conversing) => Effect.Effect<void, MemoryFailure>
  /**
   * ... and write down the last line this conversation's agent said.
   *
   * A no-op for a conversation no node claims, and for a line identical to the
   * one already written — an agent that answers with the same sentence twice
   * writes the disk once, and a panel that is merely re-reporting does not
   * write at all.
   */
  readonly said: (
    to: Conversing,
    said: Said,
  ) => Effect.Effect<void, MemoryFailure>
}

/** What one of these files looks like written — see {@link read} for the
 *  leniency, which is sharper here than anywhere else in this package because
 *  a PERSON types this file. */
interface Written {
  readonly bound?: unknown
}

/**
 * The rows a file holds, read field by field.
 *
 * THE THREE NAMES ARE LOAD-BEARING and a row missing any of them is dropped: a
 * binding that does not say which node, which agent and which session is not a
 * binding, and there is nothing to guess. Everything else is read leniently and
 * a strange value reads as absent — the same rule {@link ./memory.ts}'s `word`
 * is, spent here on a file somebody edits in an editor with no schema in front
 * of them. A `taught` that is not `true` is untaught, which costs one extra
 * teaching; a `said` that will not parse is a door with no line on it, which is
 * what every door starts as.
 */
const read = (held: Record<string, unknown>): ReadonlyArray<Bound> => {
  const written = (held as Written).bound
  if (!Array.isArray(written)) return []
  const rows: Array<Bound> = []
  for (const row of written as ReadonlyArray<unknown>) {
    if (typeof row !== "object" || row === null) continue
    const one = row as Record<string, unknown>
    const node = word(one["node"])
    const agent = word(one["agent"])
    const session = word(one["session"])
    if (node === null || agent === null || session === null) continue
    rows.push({
      node,
      agent,
      session,
      ...(one["taught"] === true ? { taught: true } : {}),
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

/** The same conversation — the PAIR, never the session alone. */
const sameChat = (row: Bound, to: Conversing): boolean =>
  row.agent === to.agent && row.session === to.session

export const forDirectory = (spelling: string): Effect.Effect<Bindings> =>
  Effect.gen(function*() {
    // ONE spelling from here down, and it is `@olai/state`'s — the resolution
    // this package's other two records name their files by, so a vault reached
    // through a symlink is one directory to all three.
    const cwd = canonical(spelling)
    const at = fileFor(AGENTS, cwd)
    /** See the header: every writer here is a read-modify-write over `rows`. */
    const writing = yield* Semaphore.make(1)

    // AN EMPTY MIRROR AND ONE WARNING. Nobody is standing at the screen when a
    // boot reads this, and a directory whose bindings cannot be read is a
    // directory whose node agents have no sessions — the roster still draws,
    // every row saying it is unbound, which is the honest face of exactly this
    // failure and of a vault nobody has bound anything in yet.
    const held = yield* Effect.result(readHeld(at, cwd))
    let rows: ReadonlyArray<Bound> = []
    if (held._tag === "Failure") {
      yield* Effect.logWarning(
        `the node agents' session bindings could not be read (${held.failure.why}) — ` +
          `every node agent draws as unbound until it can be`,
      )
    } else if (held.success !== null) {
      rows = read(held.success)
    }

    /**
     * One row replaced, written down, and the mirror moved only if it landed.
     *
     * THE RECORD FIRST, for {@link ./scopes.ts}'s reason: the two are one fact
     * in two places, and a mirror that moved under a failed write would have a
     * conversation marked taught in memory and untaught on disk — so the next
     * restart teaches it again, having told the caller nothing went wrong.
     *
     * `change` answers with the row it wants written, or `undefined` for
     * NOTHING TO DO — which is what keeps a conversation no node claims, and a
     * repeated line, off the disk entirely.
     */
    const replace = (
      to: Conversing,
      change: (row: Bound) => Bound | undefined,
    ): Effect.Effect<void, MemoryFailure> =>
      writing.withPermit(Effect.gen(function*() {
        const before = rows
        const held = before.find((row) => sameChat(row, to))
        if (held === undefined) return
        const next = change(held)
        if (next === undefined) return
        // The row is written WHERE IT STOOD. Nothing here is a touch and there
        // is no eviction order to keep — the positions are the person's file,
        // and a bookkeeping write must not reorder somebody's records.
        const table = before.map((row) => (row === held ? next : row))
        yield* Effect.mapError(
          writeHeld(at, { cwd, bound: table }),
          (failure) => new MemoryFailure(failure),
        )
        rows = table
      }))

    return {
      rows: () => rows,
      at: (to) => rows.find((row) => sameChat(row, to)),
      teach: (to) => replace(to, (row) => (row.taught === true ? undefined : { ...row, taught: true })),
      said: (to, said) =>
        replace(to, (row) =>
          row.said?.text === said.text && row.said.at === said.at
            ? undefined
            : { ...row, said }),
    }
  })
