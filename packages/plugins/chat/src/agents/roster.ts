/**
 * WHICH ENGINES THIS SERVE MOUNTED, how this machine answers for each of them,
 * and how to start the ones it has.
 *
 * One row per mounted engine, over a list this package is HANDED. A row says
 * who an agent is (an id, a name a person reads) and then either what to spawn
 * — which leg reads its wire, which channel its standing prompt rides — or the
 * SENTENCE a machine that has not got it is owed. Everything else in this
 * package takes the answer: {@link ../chat.ts} publishes the whole table so the
 * panel can ask which one a conversation is for, {@link ../memory.ts} writes the
 * chosen id down beside the conversation, and {@link ../agent.ts} spawns what
 * the row says.
 *
 * ## THE TABLE IS GONE, and that is the phase
 *
 * There was a `KINDS` array here — three rows, each naming a leg and a probe —
 * beside `@olai/surface`'s `AGENTS` record, which made every agent id a CLOSED
 * UNION that only a core PR could widen. Adding another engine was an edit in two
 * general packages, and a bump of ONE adapter's pin was an edit in a file the
 * other two shared.
 *
 * Each engine is a PLUGIN now — `packages/plugins/claude/`, `codex/`, `opencode/`,
 * `pi/`, `omp/`, one row each in `olai.yml` — and what arrives here is whatever
 * those plugins registered on the `Agents` service (`@olai/plugin-api`'s
 * `services.ts`). This package never learns that a plugin system exists: it is
 * handed `ReadonlyArray<Engine>` by the composition root, exactly as it is
 * handed the session-start thunks, and an id it has no entry for is the same
 * absence a missing binary is.
 *
 * ## Found, rather than configured
 *
 * The roster is DETECTED (the human's ruling, 2026-08-21): olai looks for each
 * engine it has, and what it finds is what you can choose between. There is no
 * list to maintain and no path to set for an agent that is simply installed.
 * Finding nothing is a state with a face of its own — the panel says so, out of
 * each row's own sentence — because a chat panel that silently is not there
 * cannot be told apart from one that is broken.
 *
 * HOW each engine is found is the engine's own file rather than a row here: one
 * is a variable the packaged wrapper bakes a pin into, one is a name on the
 * agent search path, and one is both at once. That asymmetry used to be three
 * paragraphs in this header explaining three rows of one table; it is five
 * `server.ts` headers in five directories, each beside the leg it belongs to.
 *
 * ## PUBLISH THE WHOLE READING, and never drop a row
 *
 * A probe answers `Adapter | NotHere` and BOTH arms become a row
 * ({@link Standing}). The second arm used to be `null` and a `null` row was
 * dropped here, which is how a panel came to offer two engines while a third sat
 * enabled, installed-adjacent and unexplained: the fact was computed in the one
 * fiber that could compute it and thrown away at the boundary, where no consumer
 * downstream could recover it. So the table keeps every row and the readers
 * NARROW it on purpose — {@link here} for "startable", {@link offBecause} for
 * "why there is nothing to talk to", {@link choiceOf} for what crosses the wire.
 *
 * ## The shared engine search path
 *
 *   - **`OLAI_AGENT_PATH` is where the probes look**, defaulting to `PATH`. It
 *     exists because olai's PATH is not your shell's: run as a systemd user
 *     service (the home-manager unit) it inherits neither your profile nor your
 *     login shell, so an `opencode` you can run in a terminal is not necessarily
 *     one this process can see — the same trap an optional server's probe
 *     documents from the other side ({@link ../probes.ts}, and the plugin whose
 *     probe it is). Set, it REPLACES the search path rather than adding to it,
 *     so it can also say "look nowhere": the empty string finds no agent, which
 *     is what the e2e suite spawns a server with when a scenario is not about
 *     the roster.
 *   - **An engine resolves a name with the lookup it is HANDED**
 *     ({@link Where.found}), never against its own idea of an environment.
 *     Where this process may look is a fact about the SERVE, and a plugin that
 *     answered it for itself would be answering a question core has decided.
 *
 * ## TWO HALVES, AND ONLY ONE OF THEM WAS EVER MEANT TO MOVE
 *
 * The MACHINE's half stays frozen under a reader, and that is a deliberate
 * refusal rather than a defect left in place: which agents are INSTALLED is what
 * decides whether the panel has an agent at all, and re-deciding it under a
 * reader would flip the panel's whole face — from a conversation to install
 * instructions and back — because somebody's `$HOME/.local/bin` was being
 * written to, or because a CLI was mid-upgrade and its file was briefly not
 * there. An agent installed while olai runs is offered when a person asks again,
 * which is the same bargain `OLAI_ACP_AGENT` has always made.
 *
 * The BUILD's half moves. Which engine PLUGINS are mounted is a fact about the
 * fibers, and a fiber can be turned off at the panel — so a row that leaves
 * leaves the picker and a row that arrives enters it, with no restart.
 *
 * ## {@link detecting} IS WHAT LETS BOTH BE TRUE AT ONCE
 *
 * A live reading over a frozen probe. The detector holds what each engine id
 * answered — the whole {@link Standing}, absences included, because "not here,
 * and here is why" is an ANSWER and re-asking it is the re-probing this
 * arrangement exists to avoid — so recomputing the list when the table moves
 * costs a walk over a map rather than a walk over `PATH`, and the machine's half
 * is frozen by construction rather than by everybody remembering not to re-probe.
 *
 * WHAT "LOOK AGAIN" IS, and who may say it: the cache is not for the life of the
 * process, because turning an engine plugin off and on again is a PERSON asking
 * for a fresh answer about that engine. {@link Detection.forget} drops exactly
 * one id's row, and the only caller is the UNREGISTER finalizer in
 * `../server.ts`'s `AgentsDoor`, which spends it BEFORE ringing `enginesMoved`
 * so the row is re-probed on the way back rather than answered from the cache.
 * Nothing else calls it, on purpose: no clock, file watcher or second plugin is
 * a person, and an engine nobody touched keeps the answer it gave — what changed
 * was one fiber, not the disk.
 *
 * What the cache must not do is outlive the PROCESS, and it cannot: it is closed
 * over by the detector the composition root builds once.
 */

import { type Adapter, type Engine, type Leg, type NotHere, type PromptChannel, type Where } from "@olai/acp/engine"
import type { AgentChoice, OffBecause } from "olai-plugin-chat/wire"
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
  | { readonly standing: "here"; readonly installed: Installed }
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
 * ...AND THE ROW AS THE BROWSER HEARS IT — the third fold, and the only one
 * that crosses a wall.
 *
 * THE SERVER'S EXECUTION DETAILS STAY HERE: the adapter, the leg and the
 * prompt channel belong to opening a conversation, not to drawing a choice.
 * A browser sends back the engine's ID, never a command to execute. What
 * crosses is that ID, a NAME to draw and — on the `not-here` arm — the
 * engine's own sentence about what prevents it from starting.
 *
 * IT LIVES HERE, beside {@link here} and {@link offBecause}, because it is the
 * same kind of thing: one reader's narrowing of one table, and the third place
 * that decides what an arm MEANS. It was `said` in `../chat.ts` for a revision,
 * which cost twice over — `said` in this package already means what an agent
 * last uttered (`../heard.ts`'s `lastSaid`, `NodeAgentRow.said`, the
 * transcript's `SaidLine`), and `../server.ts` had to import a panel
 * constructor to reach a five-line mapping it wanted for the engines cell
 * before any panel exists.
 *
 * The MARK is not here either, and that is this decision read from the other
 * side: which glyph to draw for an engine is a fact about the drawing, so the
 * browser keeps the marks and looks them up by id.
 */
export const choiceOf = (row: Standing): AgentChoice =>
  row.standing === "here"
    ? { id: row.installed.id, name: row.installed.name, standing: "here" }
    : { id: row.id, name: row.name, standing: "not-here", missing: row.missing }

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
): Roster => engines.map(engine => standingOf(engine, engine.at(where)))

/** One probe's answer, as a row of the table. THE ONE PLACE the union is
 *  split: `installed` rides the `here` arm and `missing` the `not-here` one,
 *  and every other reader folds ({@link here}, {@link offBecause},
 *  {@link choiceOf}) rather than re-deriving what a probe's answer means.
 *
 *  IT KEYS ON `why`, which is the field that carries the MEANING of the arm it
 *  belongs to: an absence is a sentence, and this package owns the reading that
 *  a sentence is what a `not-here` row is made of. Keying on `command` instead
 *  sniffed the OTHER package's shape — `@olai/acp`'s `Adapter`, whose fields are
 *  a spawn's business and not this table's — so a protocol-side field rename
 *  would have silently filed every installed engine as absent. */
const standingOf = (engine: Engine, at: Adapter | NotHere): Standing =>
  "why" in at
    ? { id: engine.id, name: engine.name, standing: "not-here", missing: at }
    : {
      standing: "here",
      installed: { id: engine.id, name: engine.name, adapter: at, leg: engine.leg, prompt: engine.prompt },
    }

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
      engines.map((engine) => {
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
