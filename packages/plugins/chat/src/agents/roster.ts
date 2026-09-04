/**
 * WHICH of the engines this build has are installed HERE, and how to start each
 * of them.
 *
 * One reading, taken once when the server starts, over a list this package is
 * HANDED. A row says who an agent is (an id, a name a person reads), what to
 * spawn, which leg reads its wire, and which channel its standing prompt rides.
 * Everything else in this package takes the answer: {@link ../chat.ts} publishes
 * the list so the panel can ask which one a conversation is for,
 * {@link ../memory.ts} writes the chosen id down beside the conversation, and
 * {@link ../agent.ts} spawns what the row says.
 *
 * ## THE TABLE IS GONE, and that is the phase
 *
 * There was a `KINDS` array here — three rows, each naming a leg and a probe —
 * beside `@olai/surface`'s `AGENTS` record, which made every agent id a CLOSED
 * UNION that only a core PR could widen. Adding another engine was an edit in two
 * general packages, and a bump of ONE adapter's pin was an edit in a file the
 * other two shared.
 *
 * Each engine is a PLUGIN now — `packages/plugins/claude/`, `codex/`, `opencode/`, `pi/`,
 * one row each in `olai.yml` — and what arrives here is whatever those plugins
 * registered on the `Agents` service (`@olai/plugin-api`'s `services.ts`). This
 * package never learns that a plugin system exists: it is handed
 * `ReadonlyArray<Engine>` by the composition root, exactly as it is handed the
 * session-start thunks, and an id it has no entry for is the same absence a
 * missing binary is.
 *
 * ## Found, rather than configured
 *
 * The roster is DETECTED (the human's ruling, 2026-08-21): olai looks for each
 * engine it has, and what it finds is what you can choose between. There is no
 * list to maintain and no path to set for an agent that is simply installed.
 * Finding nothing is a state with a face of its own — the panel says so and says
 * how to install one, out of each enabled plugin's own sentence — because a chat
 * panel that silently is not there cannot be told apart from one that is broken.
 *
 * HOW each engine is found is now the engine's own file rather than a row here:
 * one is a variable the packaged wrapper bakes a pin into, one is a name on the
 * agent search path, and one is both at once. That asymmetry used to be three
 * paragraphs in this header explaining three rows of one table; it is three
 * `server.ts` headers in three directories, each beside the leg it belongs to.
 *
 * ## The two variables that are still CORE'S
 *
 *   - **`OLAI_ACP_AGENT` set to the EMPTY string is the whole off switch.** Not
 *     "no Claude row" — no roster at all, nothing probed, the panel off. That is
 *     what the variable has always meant and what a person setting it means by
 *     it; making it merely one row's absence would turn the documented way of
 *     turning chat off into a way of getting some other agent instead. It is
 *     read HERE, before anything is probed, which is why the constant lives in
 *     `@olai/acp/engine` where both this file and the engine that reads it as
 *     its own adapter can reach it.
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
 *
 * Both are core's because both are about the SERVE rather than about one engine:
 * whether there is a panel at all, and where this process may look.
 *
 * ## TWO HALVES, AND ONLY ONE OF THEM WAS EVER MEANT TO HOLD STILL
 *
 * This section said both were read once at boot and named the second as a phase
 * boundary: *the day something can turn a row off, this is one of the places
 * that has to learn to move, beside `@olai/server`'s `propKinds.ts` … and its
 * `runtime.ts`*. The loader surface is that day. The vocabulary moved, the row
 * report moved, and this is the third — and the one that reaches a PERSON, since
 * what it decides is which agents a picker offers.
 *
 * The MACHINE's half stays exactly as it was, and that is a deliberate refusal
 * rather than the same defect left in place: which agents are INSTALLED is what
 * decides whether the panel has an agent at all, and re-deciding it under a
 * reader would flip the panel's whole face — from a conversation to install
 * instructions and back — because somebody's `$HOME/.local/bin` was being
 * written to. An agent installed while olai runs is offered by the next start,
 * which is the same bargain `OLAI_ACP_AGENT` has always made.
 *
 * The BUILD's half moves. Which engine PLUGINS are mounted is a fact about the
 * fibers, and a fiber can be turned off at the panel now — so a row that leaves
 * leaves the picker and a row that arrives enters it, with no restart.
 *
 * ## {@link detecting} IS WHAT LETS BOTH BE TRUE AT ONCE
 *
 * A live reading over an unchanged probe. The detector holds what each engine id
 * answered the first time it was asked and never asks that id again, so
 * recomputing the list when the table moves costs a walk over a map rather than
 * a walk over `PATH` — and the machine's half is frozen by construction rather
 * than by everybody remembering not to re-probe.
 *
 * THE CACHE IS SAFE FOR THE REASON THE REFUSAL ABOVE IS, and this is worth
 * saying rather than leaving to be re-derived: a binary appearing or vanishing
 * mid-serve is explicitly NOT a thing this phase re-decides, so a cached `null`
 * for an engine that was not installed at first ask is the answer olai has
 * always given until the next start. What the cache must not do is outlive the
 * PROCESS, and it cannot — it is closed over by the detector the composition
 * root builds once.
 *
 * A plugin that unloads and comes back is asked NOTHING on the way back: its
 * answer is the one it gave, which is right, because what changed was the fiber
 * and not the disk.
 */

import { AGENT_ENV, type Adapter, type Engine, type Leg, type PromptChannel, type Where } from "@olai/acp/engine"
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
 * WHAT THIS MACHINE ANSWERED: the agents it has, or the reason it has none.
 *
 * A UNION RATHER THAN AN ARRAY THAT CAN BE EMPTY, and the arm is the whole
 * point. An empty roster did THREE jobs — chat switched off, no engine plugin
 * mounted, every engine asked and none installed — and the panel, holding one
 * empty array, hedged across all of them in prose. One of its two guesses ("olai
 * was started by hand, without the wrapper that bakes the pinned adapters in")
 * cannot happen on any documented way of starting olai, so the commonest real
 * cause — a `--plugins` list naming no engine — was the one case the face never
 * named.
 *
 * The three are told apart HERE, where the deciding is, and the answer carries
 * the reason on the arm that has one: `because` exists only where there is
 * nothing installed, and `installed` is non-empty wherever it exists. Neither is
 * a state a reader has to check the other for.
 */
export type Roster =
  /** At least one agent, in the order the engines were given. */
  | { readonly kind: "here"; readonly installed: ReadonlyArray<Installed> }
  /** ...or none at all, and which of the three ways — `@olai/surface`'s
   *  {@link OffBecause}, drawn by the panel and written to the log. */
  | { readonly kind: "none"; readonly because: OffBecause }

/**
 * Every engine installed here, in the order it was given — or why there are
 * none.
 *
 * PURE over {@link Where} and the engines handed in, which is what makes the off
 * switch, each row's shape AND each reason assertable by a function a test can
 * call with a made-up environment and a made-up engine.
 *
 * THE ORDER IS THE CALLER'S. It is the order the picker draws and the order the
 * install rows are listed in, and it is decided against the BUNDLE'S own list of
 * rows rather than here — because registration order is the order two dynamic
 * imports came back in, which is a fact about the filesystem on the day
 * (`@olai/server`'s `probes.ts` argues it, and has an e2e failure behind it).
 *
 * THE ORDER OF THE `none` ARMS IS ALSO A RULING. The off switch wins even where
 * no engine was mounted either, because it is the one a PERSON ASKED FOR:
 * somebody who wrote `OLAI_ACP_AGENT=` is owed "you turned this off" rather than
 * a lecture about `--plugins`. Below it, no engine at all outranks nothing
 * installed for the plainer reason that nothing was ever asked.
 */
export const rosterOf = (
  where: Where,
  engines: ReadonlyArray<Engine>,
  /**
   * HOW ONE ENGINE IS DETECTED, or `null` for one this machine has not got —
   * a seam, defaulting to asking the engine itself.
   *
   * It exists for exactly one caller ({@link detecting}, which answers from a
   * table it keeps) and it is a PARAMETER rather than that caller reimplementing
   * this loop, because the loop is where the ORDER, the off switch and the three
   * `none` arms are decided and none of those is a thing to have twice. The
   * default is the behaviour every existing caller had; nothing about a one-shot
   * reading changed.
   */
  detected: (engine: Engine) => Installed | null = (engine) => {
    const adapter = engine.at(where)
    return adapter === null ? null : {
      id: engine.id,
      name: engine.name,
      adapter,
      leg: engine.leg,
      prompt: engine.prompt,
    }
  },
): Roster => {
  // The explicit off switch, and it is the WHOLE panel rather than one row —
  // see the header. Read before anything is probed, so a machine with an agent
  // installed still gets the "off" a person asked for.
  if (where.env[AGENT_ENV] === "") return { kind: "none", because: { kind: "switched-off" } }
  const found: Array<Installed> = []
  for (const engine of engines) {
    const one = detected(engine)
    if (one !== null) found.push(one)
  }
  if (found.length > 0) return { kind: "here", installed: found }
  // NOTHING, and the two ways of getting here are not the same sentence: an
  // engine that was never mounted was never asked, and there is no install
  // sentence to draw for it either, because the face that draws one is its own
  // browser half's.
  return {
    kind: "none",
    because: engines.length === 0 ? { kind: "no-engine" } : { kind: "none-installed" },
  }
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
 * WHAT EACH ENGINE ID ANSWERED, once, for the life of the process — see the
 * header's last section for why that is the refusal rather than the shortcut.
 * The consequence worth naming here is the one a reader would otherwise have to
 * work out: asking twice with the same id in the list does no work at all, so a
 * flip costs a map walk. Asking with an id never seen before probes once, which
 * is a plugin arriving.
 *
 * IT REMEMBERS THE ABSENCES TOO — `null` for an engine that was asked and is not
 * installed — because "not installed" is an answer and re-asking it would be the
 * re-probing this whole arrangement exists to avoid. `has` rather than a
 * truthiness check on the value, so a cached absence is a hit.
 *
 * ## The off switch is NOT cached, and could not be
 *
 * `OLAI_ACP_AGENT=` is read per call, inside {@link rosterOf}. It is one map
 * lookup, and it is the whole panel rather than one row — so caching it would
 * save nothing and would make the one answer a PERSON set the one answer this
 * function could not re-read.
 */
export const detecting = (
  vars: Record<string, string | undefined>,
  cwd: string,
): (engines: ReadonlyArray<Engine>) => Roster => {
  const asked = new Map<string, Installed | null>()
  const where: Where = { env: vars, cwd, found: (name) => onPath(name, searchPath(vars)) }
  return (engines) =>
    rosterOf(where, engines, (engine) => {
      if (!asked.has(engine.id)) {
        const adapter = engine.at(where)
        asked.set(
          engine.id,
          adapter === null ? null : {
            id: engine.id,
            name: engine.name,
            adapter,
            leg: engine.leg,
            prompt: engine.prompt,
          },
        )
      }
      return asked.get(engine.id) ?? null
    })
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
