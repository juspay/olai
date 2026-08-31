/**
 * WHICH CONVERSATIONS A PERSON POINTED A DOORBELL AT, and at which file —
 * remembered across a restart.
 *
 * The second per-directory record this package keeps, beside the one that
 * remembers which conversation the panel was in ({@link ./memory.ts}). It holds
 * a row per (conversation, plugin) somebody picked a file for, and it is the
 * whole of what turns a doorbell on: there is no serve-level default, nothing
 * an agent can call, and no row a fresh conversation starts with. A doorbell is
 * off until a person picks, and this is where the pick lands.
 *
 * ## The picks, and never the messages
 *
 * A held body does not come through here and never will
 * ({@link ./deliveries.ts} says the same thing from the other side). A pick is
 * a decision somebody made that nothing else can reconstruct; a held body is a
 * derivation of state that is still true, and whatever derived it rings again
 * on its next tick. So a restart comes back knowing which doorbells are on and
 * holding nothing, which is exactly the human's third ruling read from the
 * disk: saved events survive a conversation's SESSION GAPS, and a restart is
 * not a session gap.
 *
 * ## The key is the TRIPLE, and the conversation half of it is the pair
 *
 * A conversation is `(agent, session)`, because a session id means nothing to
 * the wrong agent — core's own identity for the thing, already spelled at
 * {@link ./memory.ts} and in `@olai/surface`'s `SessionInfo`, rather than a
 * second one minted here. The third column is the PLUGIN, and it is what makes
 * `Deliveries.scopes()` answerable per plugin: an unkeyed table would hand one
 * plugin the conversations a person scoped to another.
 *
 * `plugin` is an OPAQUE STRING to this file, exactly as `dial` is a key core
 * does not interpret. This package learns no appliance word from it.
 *
 * ## Behind ONE permit, and that is not tidiness
 *
 * `@olai/state`'s writer stages per PROCESS (`<file>.<pid>.tmp`), not per call.
 * Two writes overlapping in one process — two tabs, a double-click on the
 * picker — race: A writes the stage, B overwrites it, A renames it onto the
 * destination and B's rename fails ENOENT, so B reports a failure for a pick
 * whose bytes never landed. {@link ./memory.ts} is safe from that only because
 * `agent.ts` holds a semaphore around its one writer. This file inherits the
 * PERMIT and not just the file format.
 *
 * ## Capped by COUNT, and never pruned against what an agent lists
 *
 * Thirty-two rows, least-recently-touched evicted. The obvious alternative —
 * drop rows whose session no longer appears in an agent's `session/list` — is
 * refused: that call is PAGED ({@link ./agent.ts}), so membership is not proof
 * of absence, and a wrong prune silently deletes a live scope somebody set. A
 * count cap costs no probe and cannot be wrong about a conversation it has
 * never asked about.
 *
 * A conversation can still become unreachable — `adopt` demotes a remembered
 * one an agent stops listing, and the strip only draws the OPEN conversation's
 * row — so a stranded scope is possible and the cap is what eventually clears
 * it. That is stated rather than hidden.
 *
 * ## What it does with a failure
 *
 * A read at boot that fails is an EMPTY MIRROR and one warning, never a refusal
 * to serve: the discipline {@link ./memory.ts}'s header sets and
 * {@link ./chat.ts} already keeps for the note it reads at boot. A WRITE that
 * fails is told to the person who just made the gesture, because a pick that
 * did not stick is a thing they need told — so `set` fails and the member above
 * it refuses.
 *
 * ## Two things this deliberately is not
 *
 * **Not a sidecar on the memory note.** `remember` builds a fresh
 * `{cwd, agent, session, model}` literal over a plain `JSON.stringify`, so an
 * extra key written beside it dies on the next conversation entered. Two
 * records means two files, which is what `@olai/state`'s `Kind` is a closed
 * union of.
 *
 * **Not a second failure vocabulary.** {@link ./memory.ts}'s `MemoryFailure` is
 * this package's word for "a kept record would not read or write", and this is
 * a second kept record rather than a second kind of problem.
 */

import { canonical, fileFor, readHeld, writeHeld } from "@olai/state"
import { Effect, Semaphore } from "effect"

import { MemoryFailure } from "./memory.ts"

/** The `kind` these files live under in the state home — the second
 *  subdirectory, beside `chat`'s. */
const WAKE = "wake"

/**
 * How many picks are kept, across every conversation this directory has.
 *
 * See the header for why this is a count rather than a liveness question.
 * Thirty-two is far past a single-user panel's working set — the picks that
 * matter are for conversations somebody still opens — and it is the number
 * {@link ./deliveries.ts} bounds its own two axes by, so there is one number to
 * argue about rather than three.
 */
export const ROWS = 32

/**
 * ONE PICK: whose doorbell, in which conversation, on which file, and when.
 *
 * `at` is ISO-8601 and is here for the cap's eviction order alone — nothing
 * draws it and nothing compares it to a clock. It is written down rather than
 * derived from position because the file is rewritten whole on every `set` and
 * position would be an ordering nothing guarantees on the way back in.
 */
export interface Scoped {
  readonly agent: string
  readonly session: string
  /** One of the roster's built plugin names, as DATA. This file spells none. */
  readonly plugin: string
  /** Root-relative and `/`-spelled, the one spelling every path on this wire
   *  uses. What it MEANS is the plugin's business; core stores it and hands it
   *  back. */
  readonly file: string
  readonly at: string
}

/**
 * The table, and the two things anybody does with it.
 *
 * A MIRROR plus a write, rather than a read per question, and that shape is
 * forced from above: `Deliveries.scopes()` is SYNCHRONOUS — the composition
 * root builds that blob inside a plain `.map`, and the caller is a watcher sink
 * with no Effect around it — so the in-memory copy is the one that answers and
 * the disk copy follows the write rather than leading the read.
 */
export interface Scopes {
  /** Every pick, in the order they are held. */
  readonly rows: () => ReadonlyArray<Scoped>
  /**
   * Set or CLEAR one — `file: null` clears, which is how a doorbell is turned
   * off.
   *
   * Not a second verb beside a `forget`, because there is one fact here and it
   * has an empty value: two doors onto one row would be a question about which
   * of them a fresh pick goes through.
   *
   * The mirror moves FIRST and the record is written under the same permit, so
   * a caller that comes straight back for {@link Scopes.rows} sees its own
   * write whether or not the disk has caught up — and a failure to write is
   * still told, because it is the NEXT boot that would be wrong.
   */
  readonly set: (
    to: { readonly agent: string; readonly session: string },
    plugin: string,
    file: string | null,
    at: string,
  ) => Effect.Effect<void, MemoryFailure>
}

/** What one of these files looks like written. The rows are read leniently
 *  (see {@link picks}); the `cwd` guard is `@olai/state`'s. */
interface Written {
  readonly scopes?: unknown
}

/** A non-empty string, or `null` for everything else — including an absent
 *  field, which is what a row damaged in transit looks like. */
const word = (value: unknown): string | null =>
  typeof value === "string" && value !== "" ? value : null

/**
 * What a read makes of the rows.
 *
 * LENIENT PER ROW rather than all-or-nothing: every field of a pick is
 * load-bearing — a row missing any of them names no conversation, no doorbell
 * or no file — so a damaged row is DROPPED and the rest still open their
 * doorbells. Refusing the whole file over one would turn every doorbell in the
 * directory off, which is the louder failure and the wrong one: the picks that
 * are still legible are still what a person asked for.
 */
const picks = (held: Record<string, unknown>): ReadonlyArray<Scoped> => {
  const written = (held as Written).scopes
  if (!Array.isArray(written)) return []
  const rows: Array<Scoped> = []
  for (const row of written as ReadonlyArray<unknown>) {
    if (typeof row !== "object" || row === null) continue
    const one = row as Record<string, unknown>
    const agent = word(one["agent"])
    const session = word(one["session"])
    const plugin = word(one["plugin"])
    const file = word(one["file"])
    const at = word(one["at"])
    if (agent === null || session === null || plugin === null || file === null) continue
    // A row written by an olai that did not stamp one sorts oldest, which is
    // the safe direction: the cap evicts it before anything somebody has
    // touched since.
    rows.push({ agent, session, plugin, file, at: at ?? "" })
  }
  return rows
}

/**
 * The CAP applied — the {@link ROWS} most recently touched, in the order they
 * were held.
 *
 * Order is preserved rather than sorted, because the array's order is what
 * `rows()` hands out and re-sorting it on every write would make the strip's
 * source of truth a thing that moves for reasons nobody asked about.
 */
const capped = (rows: ReadonlyArray<Scoped>): ReadonlyArray<Scoped> => {
  if (rows.length <= ROWS) return rows
  const kept = new Set(
    [...rows]
      .map((row, index) => ({ row, index }))
      // Newest first, and a tie goes to the one held later — two picks stamped
      // in the same millisecond are ordered by the only other fact there is.
      .sort((a, b) => a.row.at === b.row.at ? b.index - a.index : (a.row.at < b.row.at ? 1 : -1))
      .slice(0, ROWS)
      .map((one) => one.row),
  )
  return rows.filter((row) => kept.has(row))
}

export const forDirectory = (spelling: string): Effect.Effect<Scopes> =>
  Effect.gen(function*() {
    // ONE spelling from here down, and it is `@olai/state`'s — the same
    // resolution {@link ./memory.ts} names its own file by, so a vault reached
    // through a symlink is one directory to both of this package's records.
    const cwd = canonical(spelling)
    const at = fileFor(WAKE, cwd)
    /** See the header: `@olai/state`'s staging file is per PROCESS, so two
     *  overlapping writes in this one would race through it. */
    const writing = yield* Semaphore.make(1)

    // AN EMPTY MIRROR AND ONE WARNING, never a refusal to serve: nobody is
    // standing at the screen when a boot reads this, and a directory whose
    // doorbells cannot be read is a directory whose doorbells are off until
    // somebody picks again. The write is the opposite case and refuses.
    const read = yield* Effect.result(readHeld(at, cwd))
    let rows: ReadonlyArray<Scoped> = []
    if (read._tag === "Failure") {
      yield* Effect.logWarning(
        `the doorbells this directory had on could not be read (${read.failure.why}) — ` +
          `they are off until somebody picks again`,
      )
    } else if (read.success !== null) {
      rows = picks(read.success)
    }

    return {
      rows: () => rows,
      set: (to, plugin, file, when) =>
        writing.withPermit(Effect.gen(function*() {
          const without = rows.filter((row) =>
            !(row.agent === to.agent && row.session === to.session && row.plugin === plugin)
          )
          const next = file === null
            ? without
            : capped([...without, { agent: to.agent, session: to.session, plugin, file, at: when }])
          rows = next
          yield* Effect.mapError(
            writeHeld(at, { cwd, scopes: next }),
            (failure) => new MemoryFailure(failure),
          )
        })),
    }
  })
