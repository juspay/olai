/**
 * WHICH agents this machine has, and how to start each of them.
 *
 * One table, read once when the server starts. A row says who an agent is (an
 * id, a name a person reads), how to FIND it, how to SPAWN it, and which leg
 * reads its wire ({@link ./leg.ts}). Everything else in this package takes the
 * answer: {@link ../chat.ts} publishes the list so the panel can ask which one
 * a conversation is for, {@link ../memory.ts} writes the chosen id down beside
 * the conversation, and {@link ../agent.ts} spawns what the row says.
 *
 * ## Found, rather than configured
 *
 * The roster is DETECTED (the human's ruling, 2026-08-21): olai looks for each
 * agent it knows, and what it finds is what you can choose between. There is no
 * list to maintain and no path to set for an agent that is simply installed.
 * Finding nothing is a state with a face of its own — the panel says so and
 * says how to install one — because a chat panel that silently is not there
 * cannot be told apart from one that is broken.
 *
 * ## The two rows, and why they are found differently
 *
 *   - **`claude`** is the ACP agent `OLAI_ACP_AGENT` names ({@link
 *     ../adapter.ts}), which every documented way of starting olai bakes the
 *     pinned Claude Code adapter into. It is NOT looked for on PATH, because it
 *     is not on one: it is a wrapper inside the nix store, and the variable is
 *     how a person points olai at their own. The row is named for the LEG it is
 *     read with rather than for the file the variable happens to hold — point
 *     the variable at something else and you are still telling olai to read it
 *     the way it reads Claude Code, which is what that override has always
 *     meant.
 *   - **`opencode`** is looked for on PATH, because that is where it installs
 *     itself, and started as `opencode acp --cwd <dir>` — plain ACP over stdio
 *     (verified against 1.17.9).
 *
 * ## The two variables
 *
 *   - **`OLAI_ACP_AGENT` set to the EMPTY string is still the whole off
 *     switch.** Not "no Claude row" — no roster at all, nothing probed, the
 *     panel off. That is what the variable has always meant and what a person
 *     setting it means by it; making it merely one row's absence would turn the
 *     documented way of turning chat off into a way of getting some other agent
 *     instead.
 *   - **`OLAI_AGENT_PATH` is where the probes look**, defaulting to `PATH`. It
 *     exists because olai's PATH is not your shell's: run as a systemd user
 *     service (the home-manager unit) it inherits neither your profile nor your
 *     login shell, so an `opencode` you can run in a terminal is not
 *     necessarily one this process can see — the same trap `kolu` detection
 *     already documents from the other side ({@link ../kolu.ts}). Set, it
 *     REPLACES the search path rather than adding to it, so it can also say
 *     "look nowhere": the empty string finds no agent, which is what the e2e
 *     suite spawns a server with when a scenario is not about the roster.
 *
 * ## Once, at the start
 *
 * Detection runs when the chat is built and not again. That is deliberate
 * rather than lazy: the roster is what decides whether the panel has an agent
 * at all, and re-deciding that under a reader would flip the panel's whole face
 * — from a conversation to install instructions and back — because somebody's
 * `$HOME/.local/bin` was being written to. An agent installed while olai runs
 * is offered by the next start, which is the same bargain `OLAI_ACP_AGENT` has
 * always made.
 */

import { AGENTS, type AgentId } from "@olai/surface"

import { type Adapter, adapterFrom, AGENT_ENV, AGENT_PATH_ENV } from "../adapter.ts"
import { CLAUDE } from "./claude.ts"
import type { Leg } from "./leg.ts"
import { OPENCODE } from "./opencode.ts"

/** An agent that is installed: who it is, what to spawn, and how to read what
 *  comes back. The whole of what the rest of the package needs. */
export interface Installed {
  /** Stable, lower-case, never shown: the id a memory writes down and the
   *  browser sends back when a person picks. */
  readonly id: AgentId
  /** What a person reads — in the picker, and in the header beside the
   *  model. Taken from the wire's own table (`@olai/surface`'s `AGENTS`), which
   *  is where both ends' agent tables get their vocabulary. */
  readonly name: string
  readonly adapter: Adapter
  readonly leg: Leg
}

/** What a probe is given: the environment to read and the directory the agent
 *  would work in. Handed in rather than reached for, so the table is a pure
 *  function of them and a test needs no machine. */
export interface Where {
  readonly env: { readonly [name: string]: string | undefined }
  readonly cwd: string
  /** The first RUNNABLE file of that name on the agent search path, or `null`.
   *  Injected so {@link rosterOf} is testable without a filesystem — the real
   *  one is {@link onPath}. */
  readonly found: (name: string) => string | null
}

/** One agent olai knows how to talk to. */
interface Kind {
  readonly id: AgentId
  readonly leg: Leg
  /** How to start it here, or `null` when it is not installed. */
  readonly at: (where: Where) => Adapter | null
}

/**
 * The table. ORDER IS THE ORDER THE PICKER DRAWS, so it is decided here rather
 * than by a sort somewhere else: the agent olai ships with comes first, and
 * everything found on the machine follows in the order somebody wrote it down.
 */
const KINDS = [
  {
    id: "claude",
    leg: CLAUDE,
    at: (where) => adapterFrom(where.env[AGENT_ENV]),
  },
  {
    id: "opencode",
    leg: OPENCODE,
    at: (where) => {
      const bin = where.found("opencode")
      // `--cwd` rather than the child's own working directory, because opencode
      // reads it for which sessions the directory has as well as for where to
      // run: `session/list` ignores the `cwd` a request carries, so the one on
      // the command line is the only one it hears. (The client-side filter over
      // that answer is mandatory either way — see `../agent.ts`'s `storedFor`.)
      return bin === null ? null : { command: bin, args: ["acp", "--cwd", where.cwd] }
    },
  },
] as const satisfies ReadonlyArray<Kind>

/**
 * ... and the table COVERS the wire's list, checked by the compiler.
 *
 * The two tables over agents live in packages that never meet
 * (`@olai/surface`'s `AGENTS` says why), and this is the half a record cannot
 * enforce on its own: the ORDER of these rows is the order the picker draws, so
 * they are an array rather than a record keyed by id. This line buys the
 * coverage back — a third agent named on the wire and not started here stops
 * compiling, in the file that would otherwise silently not offer it.
 */
const _everyAgentIsStartable: (typeof KINDS)[number]["id"] extends AgentId
  ? AgentId extends (typeof KINDS)[number]["id"] ? true : never
  : never = true

/**
 * Every agent installed here, in the table's order — or NOTHING when chat is
 * switched off.
 *
 * PURE over {@link Where}, which is what makes the rule above assertable: the
 * off switch, the order, and each row's shape are decided by a function a test
 * can call with a made-up environment.
 */
export const rosterOf = (where: Where): ReadonlyArray<Installed> => {
  // The explicit off switch, and it is the WHOLE panel rather than one row —
  // see the header. Read before anything is probed, so a machine with an agent
  // installed still gets the "off" a person asked for.
  if (where.env[AGENT_ENV] === "") return []
  const found: Array<Installed> = []
  for (const kind of KINDS) {
    const adapter = kind.at(where)
    if (adapter !== null) {
      found.push({ id: kind.id, name: AGENTS[kind.id].name, adapter, leg: kind.leg })
    }
  }
  return found
}

/** The roster of the machine this process is on. The one impure door, and the
 *  only place `process.env` and the disk are read for this question. */
export const roster = (cwd: string): ReadonlyArray<Installed> =>
  rosterOf({ env: process.env, cwd, found: (name) => onPath(name, searchPath()) })

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
 */
export const onPath = (name: string, search: string): string | null =>
  Bun.which(name, { PATH: search })

/**
 * The agent a memory that names none is about ({@link ../memory.ts}).
 *
 * A note written before olai remembered which agent a conversation belonged to
 * was written by an olai that had exactly one — the ACP agent `OLAI_ACP_AGENT`
 * names — so reading an agent-less file as that row's is not a guess about what
 * somebody meant, it is the only conversation such a file could be about. An
 * upgrade therefore comes back into the conversation it was in, which is the
 * whole promise of the note.
 */
export const BEFORE_THE_ROSTER: AgentId = "claude"
