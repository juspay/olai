/**
 * One standing per mounted engine, in the caller's bundle order.
 *
 * Engine plugins provide probes as data; chat's activation owns detection.
 * The machine half stays frozen under a reader: refreshing a panel must not
 * re-probe PATH or change capability while a CLI is being replaced.
 * The build half follows mounted fibers. Unregistering forgets that engine's
 * cached answer before announcing the change, so off/on is a person's request
 * to look again without invalidating unrelated engines.
 *
 * Publish the whole reading. Missing engines carry their own reason rather
 * than disappearing at the boundary. `here` projects startable engines;
 * `offBecause` distinguishes no mounted engines from none installed.
 *
 * OLAI_AGENT_PATH replaces PATH, including the empty string ("look nowhere").
 * A service's PATH is not a login shell's PATH. Engines use the lookup they
 * are handed rather than resolving against their own environment.
 */

import { type Adapter, type Engine, type Leg, type NotHere, type PromptChannel, type Where } from "@olai/acp/engine"
import type { OffBecause } from "olai-plugin-chat/wire"
import { AGENT_PATH_ENV } from "../adapter.ts"

/** An agent that is installed: who it is, what to spawn, and how to read what
 *  comes back. The whole of what the rest of the package needs. */
export interface Installed {
  /** Stable, lower-case, never shown: the id a memory writes down and the
   *  browser sends back when a person picks. It is the ENGINE PLUGIN'S OWN WORD
   *  — the row's `id` — stamped by the registry from the fiber's binding, so no
   *  plugin can offer an engine under another's name. */
  readonly id: string
  /** What a person reads — in the picker, and in the header beside the model.
   *  The engine plugin's own, because "Claude Code" is a name rather than the
   *  word `claude` with a capital letter. */
  readonly name: string
  readonly adapter: Adapter
  readonly leg: Leg
  /** Which channel this engine's standing prompt rides — read by
   *  {@link ../chat.ts} when a node agent's session is taught its contract. */
  readonly prompt: PromptChannel
}

/**
 * ONE ROW OF THE TABLE: a mounted engine, and how this machine answers for it.
 *
 * The two arms are the one reading the probe gives ({@link Engine.at} answers
 * `Adapter | NotHere`), split rather than filtered: the second arm used to be
 * `null`, and a `null` row was DROPPED — which is how a panel came to offer two
 * engines while a third sat enabled, installed-adjacent and unexplained. An
 * absence with the sentence attached is a row a person can act on; an absence
 * with nothing is a row nobody can even see was owed.
 */
export type Standing =
  | { readonly id: string; readonly name: string; readonly standing: "here"; readonly installed: Installed }
  | { readonly id: string; readonly name: string; readonly standing: "not-here"; readonly missing: NotHere }

/**
 * ...AND THE WHOLE TABLE: one row per MOUNTED engine, in the order the engines
 * were given — the bundle's own order, which is the order the picker draws and
 * the order the log names.
 *
 * An array rather than the two-shape union it used to be, for the Löwy reason:
 * "found on this serve's PATH right now" revs on the machine clock and is
 * computed exactly once, in the build fiber that owns the probe — publishing it
 * FILTERED threw the fact away at the boundary, and no consumer downstream could
 * recover it. The folds below are where a reader narrows it on purpose.
 */
export type Roster = ReadonlyArray<Standing>

/**
 * The rows a reader that means "startable" is after — the picker's pickable
 * entries, the memory's resolution, the listings fan-out. THE FOLD rather than
 * a second reading: same table, one place that decides what "here" means.
 */
export const here = (roster: Roster): ReadonlyArray<Installed> => {
  const installed: Installed[] = []
  for (const row of roster) if (row.standing === "here") installed.push(row.installed)
  return installed
}

/**
 * WHY THERE IS NOTHING TO TALK TO, or `null` when there is — the fold behind
 * the panel's `off` face and the log's sentence.
 *
 * THREE OUTCOMES, and the distinction is the whole point of the fold: `null`
 * when at least one engine is `here` (a panel with an agent); `{kind:
 * "no-engine"}` when the table is EMPTY (a serve that mounted no engine plugin,
 * so nothing was ever probed and no install sentence exists to draw); and
 * `{kind: "none-installed"}` otherwise — engines were mounted, every one of
 * them was asked, and this machine has none of them, which is the one arm where
 * "here is how to get one" is groundable off the rows' own sentences.
 */
export const offBecause = (roster: Roster): OffBecause | null => {
  if (roster.some((row) => row.standing === "here")) return null
  // NOTHING, and the two ways of getting here are not the same sentence: an
  // engine that was never mounted was never asked, and there is no install
  // sentence to draw for it either, because the sentence is the plugin's own.
  return roster.length === 0 ? { kind: "no-engine" } : { kind: "none-installed" }
}

/**
 * Every mounted engine's standing, in the order it was given.
 *
 * PURE over {@link Where} and the engines handed in, which makes each row's
 * shape and each absence sentence assertable by a function a test can
 * call with a made-up environment and a made-up engine.
 *
 * THE ORDER IS THE CALLER'S. It is the order the picker draws and the order the
 * rows are listed in, and it is decided against the BUNDLE'S own list of
 * rows rather than here — because registration order is the order two dynamic
 * imports came back in, which is a fact about the filesystem on the day
 * (`@olai/server`'s `probes.ts` argues it, and has an e2e failure behind it).
 *
 * No enabled engine and no installed engine are separate readings: the first
 * probes nothing, while the second names where each enabled engine looked.
 */
export const rosterOf = (
  where: Where,
  engines: ReadonlyArray<Engine>,
  /**
   * HOW ONE ENGINE IS DETECTED — a seam, defaulting to asking the engine
   * itself.
   *
   * It exists for exactly one caller ({@link detecting}, which answers from a
   * table it keeps) and it is a PARAMETER rather than that caller reimplementing
   * this loop, because the loop is where the ORDER and the row shape are decided
   * and neither is a thing to have twice. The default is the behaviour every
   * existing caller had; nothing about a one-shot reading changed.
   */
  detected: (engine: Engine) => Standing = (engine) => standingOf(engine, engine.at(where)),
): Roster => engines.map(detected)

/** One probe's answer, as a row of the table. THE ONE PLACE the union is
 *  split: `installed` rides the `here` arm and `missing` the `not-here` one,
 *  and every other reader folds ({@link here}, {@link offBecause}) rather than
 *  re-deriving what a probe's answer means. */
const standingOf = (engine: Engine, at: Adapter | NotHere): Standing =>
  "command" in at
    ? {
      id: engine.id,
      name: engine.name,
      standing: "here",
      installed: { id: engine.id, name: engine.name, adapter: at, leg: engine.leg, prompt: engine.prompt },
    }
    : { id: engine.id, name: engine.name, standing: "not-here", missing: at }

/**
 * The roster of the machine this process is on — the one impure door, and the
 * only place the disk is read for this question.
 *
 * THE ENVIRONMENT IS HANDED IN, and that is the plugin wall rather than a
 * preference. It was `process.env`, read here, which was exact while this
 * package was core and the composition root was the process. It is a ROW now,
 * and a plugin that reaches for the real environment itself is a plugin a test
 * cannot drive — so the variables arrive on `@olai/plugin-api`'s `Env`, which is
 * where a composition root reaches for them once, and this function takes what
 * it was given.
 */
export const roster = (
  vars: Record<string, string | undefined>,
  cwd: string,
  engines: ReadonlyArray<Engine>,
): Roster =>
  rosterOf({ env: vars, cwd, found: (name) => onPath(name, searchPath(vars)) }, engines)

/**
 * ...AND THE SAME READING, ASKABLE AGAIN — the door a serve whose engine rows
 * can be switched off holds, and the one this package's live half is built on.
 *
 * {@link roster} above is the one-shot: hand it a list, get an answer. This is
 * the same answer over a list that MOVES, which is what an engine plugin being
 * turned on or off at the panel makes of it. The caller keeps the detector and
 * asks it whenever the table changes; what comes back is a fresh {@link Roster}
 * over the engines mounted at that moment.
 *
 * ## What it remembers, and what it refuses to
 *
 * WHAT EACH ENGINE ID ANSWERED, once, until the person asks again — see the
 * header's sections for why that is the refusal rather than the shortcut. The
 * consequence worth naming here is the one a reader would otherwise have to
 * work out: asking twice with the same id in the list does no work at all, so a
 * flip costs a map walk. Asking with an id never seen before probes once, which
 * is a plugin arriving.
 *
 * Absences are cached too. Every cached value is a standing, so a missing map
 * entry alone means the engine has not yet been asked.
 *
 * ## What un-asking is, and who may do it
 *
 * {@link Detection.forget} drops ONE id's row — nothing else's — so the next
 * `read` probes that engine again. It exists for exactly one caller: the
 * UNREGISTER finalizer in `../server.ts`'s `AgentsDoor`, which runs it BEFORE
 * ringing `enginesMoved`, so a plugin the panel turned off and on again is
 * re-read on the way back rather than answered from the cache. Nothing else
 * calls it, on purpose: a toggle is a person's "look again", and no clock, file
 * watcher or second plugin is a person.
 */
export interface Detection {
  /** The whole table, over the engines mounted at this moment. */
  readonly read: (engines: ReadonlyArray<Engine>) => Roster
  /** Drop one engine's cached answer, so the next `read` asks it again. */
  readonly forget: (id: string) => void
}

export const detecting = (vars: Record<string, string | undefined>, cwd: string): Detection => {
  const asked = new Map<string, Standing>()
  const where: Where = { env: vars, cwd, found: (name) => onPath(name, searchPath(vars)) }
  return {
    read: (engines) =>
      rosterOf(where, engines, (engine) => {
        const cached = asked.get(engine.id)
        if (cached !== undefined) return cached
        const standing = standingOf(engine, engine.at(where))
        asked.set(engine.id, standing)
        return standing
      }),
    forget: (id) => {
      asked.delete(id)
    },
  }
}

/** Where the probes look: {@link AGENT_PATH_ENV} when it is set — including
 *  when it is set to the empty string, which is "nowhere" — and `PATH`
 *  otherwise. */
const searchPath = (vars: Record<string, string | undefined>): string =>
  vars[AGENT_PATH_ENV] ?? vars["PATH"] ?? ""

/**
 * The first runnable file of that name on a search path, spelled absolutely, or
 * `null`.
 *
 * `which`, and the runtime already has one: this is a NAMED WRAPPER over
 * `Bun.which`, which is the same question asked of the same PATH by the same
 * process that will do the spawning. The twenty lines this replaced walked the
 * path, stat'd each candidate and asked `access(X_OK)` — a hand-rolled copy of
 * a built-in, with its own edge cases to get right.
 *
 * THE EDGE CASES ARE STILL PINNED, in this module's own tests, and that is not
 * belt-and-braces: what they assert is not "Bun works" but that the answers
 * olai DEPENDS on are the answers it gives.
 *
 *   - **an EMPTY entry finds nothing.** POSIX reads `""` in a PATH as the
 *     current directory, and this process's current directory is somebody's
 *     vault — so honouring it would let a file dropped beside a person's
 *     outlines decide which agent olai starts. A trailing `:` is a typo far
 *     more often than it is a request.
 *   - **a DIRECTORY of the right name is not an agent**, and neither is a file
 *     the permissions will not run: either would fail at the spawn, in a
 *     sentence about EACCES rather than about a roster.
 *
 * A wrapper rather than the call inline because those are the two properties,
 * and a test naming `Bun.which` would be a test about Bun rather than about
 * what olai offers a person.
 *
 * IT IS ALSO WHAT AN ENGINE PLUGIN'S PROBE IS HANDED, as `Where.found`: where
 * this process may look is a fact about the SERVE, and a plugin that resolved a
 * name against its own idea of a path would be answering a question core has
 * already decided.
 */
export const onPath = (name: string, search: string): string | null =>
  Bun.which(name, { PATH: search })
