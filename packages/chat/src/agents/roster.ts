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
 * ## READ ONCE, at boot, and that is a phase boundary
 *
 * TWO THINGS ARE READ ONCE HERE and they are worth telling apart. The MACHINE's
 * half — which agents are installed — is a deliberate refusal to re-decide: the
 * roster is what decides whether the panel has an agent at all, and re-deciding
 * it under a reader would flip the panel's whole face, from a conversation to
 * install instructions and back, because somebody's `$HOME/.local/bin` was being
 * written to. An agent installed while olai runs is offered by the next start,
 * which is the same bargain `OLAI_ACP_AGENT` has always made.
 *
 * The BUILD's half is the phase boundary. The engines this function is handed
 * are read off the plugin registry once, in `@olai/server`'s `serve.ts`, before
 * the store opens — so an engine plugin that unloads mid-serve leaves its row in
 * the picker until the next boot, and one that arrives is not offered. Nothing
 * in this phase can do either (the bundle is mounted before the chat is built
 * and nothing turns a row off afterwards), and the day something can — the
 * preferences toggle — this is one of the places that has to learn to move,
 * beside `@olai/server`'s `propKinds.ts`, which says the same of the vocabulary,
 * and its `runtime.ts`, which says it of the row a person reads.
 */

import { AGENT_ENV, type Adapter, type Engine, type Leg, type PromptChannel, type Where } from "@olai/acp/engine"
import type { OffBecause } from "@olai/surface"

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
export const rosterOf = (where: Where, engines: ReadonlyArray<Engine>): Roster => {
  // The explicit off switch, and it is the WHOLE panel rather than one row —
  // see the header. Read before anything is probed, so a machine with an agent
  // installed still gets the "off" a person asked for.
  if (where.env[AGENT_ENV] === "") return { kind: "none", because: { kind: "switched-off" } }
  const found: Array<Installed> = []
  for (const engine of engines) {
    const adapter = engine.at(where)
    if (adapter !== null) {
      found.push({
        id: engine.id,
        name: engine.name,
        adapter,
        leg: engine.leg,
        prompt: engine.prompt,
      })
    }
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

/** The roster of the machine this process is on. The one impure door, and the
 *  only place `process.env` and the disk are read for this question. */
export const roster = (cwd: string, engines: ReadonlyArray<Engine>): Roster =>
  rosterOf({ env: process.env, cwd, found: (name) => onPath(name, searchPath()) }, engines)

/** Where the probes look: {@link AGENT_PATH_ENV} when it is set — including
 *  when it is set to the empty string, which is "nowhere" — and `PATH`
 *  otherwise. */
const searchPath = (): string => process.env[AGENT_PATH_ENV] ?? process.env["PATH"] ?? ""

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
