/**
 * WHAT IT TAKES TO SEAT AN ACP AGENT ON THIS HOST — the shape one ENGINE PLUGIN
 * hands over, and the shape core reads it back as.
 *
 * ## Why this is a module and not a table
 *
 * It was a table: `KINDS` in `@olai/chat`'s `agents/roster.ts`, three rows deep,
 * each naming a leg, an id and a probe, with `@olai/surface`'s `AGENTS` beside
 * it as a closed union so that a fourth engine was a core PR in two packages.
 * The engines are PLUGINS now — one directory each, one row each in
 * `olai.yml`, each with its own adapter pin and its own release clock (the
 * Claude adapter's moved five times in a month; opencode's has never moved) —
 * so what used to be a table is a REGISTRATION, and this is what it carries.
 *
 * ## Why it lives in `@olai/acp`
 *
 * Because both ends of it are forbidden the other's package. A plugin may not
 * import `@olai/chat` (chat sits a floor BELOW the plugin system: it is handed a
 * list, and `@olai/server` is what meets a plugin), and `@olai/chat` may not
 * import a plugin (that is the fence). The shape they both spell therefore has
 * to be under both of them — and `@olai/acp` is where it belongs on merit
 * rather than by elimination: an engine is *an ACP agent and how to reach it*,
 * and the protocol is the language rather than an integration. The leg beside
 * this ({@link ./leg.ts}) is the other half of that same sentence.
 *
 * ## WHAT IS NOT HERE
 *
 * The standing prompt's TEXT ({@link PromptChannel} carries only the channel it
 * rides), because that is one instruction versioned with the binary and not a
 * thing three engines should be free to say three ways. And the SPAWN: what to
 * do with an {@link Adapter} once you have one is `@olai/chat`'s, which is the
 * package that speaks the protocol out loud.
 *
 * AND HOW TO GET THE ENGINE, which is the one that was here and went. A
 * `missing: NotHere` rode this registration for a revision, so an engine handed
 * over its install sentence twice: once here and once as the face its browser
 * half hangs in `chat.agent.install`. Only the face was ever read — no serve, no
 * log line and no cell ever touched the field — so what it bought was a second
 * authored copy of one sentence and a `null` arm whose documented behaviour ("a
 * row with none is drawn nowhere") could not be observed, because the non-null
 * arm was drawn nowhere either. The sentence is spelled once, in the plugin's
 * own `install.ts`, and spent once, by the half that draws it. `NotHere` went
 * back with it, to `@olai/plugin-api`'s `contract.ts` — the door of the probe
 * that does read one.
 */

import type { Leg } from "./leg.ts"

export * from "./leg.ts"

/**
 * Which executable speaks ACP, and what "none" means.
 *
 * **The default is the pinned Claude Code adapter, on every documented way of
 * starting olai** (`nix/acp-agent.nix`), baked into the packaged binary's
 * wrapper with `--set-default`; the dev-loop recipes resolve the same
 * derivation on demand. So a person who follows any documented path gets a
 * working chat panel and never has to know this variable exists.
 *
 * IT HAS TWO READERS AND THAT IS DELIBERATE, because it answers two questions
 * that a person setting it means at once:
 *
 *   - **`olai-plugin-claude` reads it as ITS ADAPTER.** Point it at something
 *     else and you are still telling olai to read that thing the way it reads
 *     Claude Code, which is what the override has always meant.
 *   - **`@olai/chat` reads the EMPTY STRING as the whole off switch** — not
 *     "no Claude row", but no roster at all, nothing probed, the panel off. The
 *     empty value survives the wrapper's `${OLAI_ACP_AGENT-…}` (an empty value
 *     is still a value), which is what makes it the explicit way to say no.
 *
 * Spelled HERE rather than in either of them for this module's whole reason:
 * the plugin and core both need the word and neither may import the other.
 */
export const AGENT_ENV = "OLAI_ACP_AGENT"

/**
 * WHAT TO SPAWN to reach one agent, or the absence of one.
 *
 * The value is a command line rather than a bare path, because an adapter is
 * often `node /path/to/index.js` and demanding a wrapper script for that would
 * be demanding one for the common case.
 */
export interface Adapter {
  readonly command: string
  readonly args: ReadonlyArray<string>
  /** Extra environment for the SPAWN, merged over olai's own — the one door an
   *  adapter has for being pointed at something that is not on olai's PATH. An
   *  adapter that WRAPS an agent (pi-acp spawns `pi`) puts the found agent here,
   *  because olai's PATH is not your shell's and the adapter's own lookup would
   *  read a third one, its child's. Omitted for adapters that want nothing, so a
   *  child inherits exactly what olai has. */
  readonly env?: Readonly<Record<string, string>>
}

/**
 * An adapter out of one environment variable, or `null` for "not here".
 *
 * Split on whitespace: a path with a space in it is a thing somebody can work
 * around with a wrapper, and a shell is a thing nobody can take back.
 */
export const adapterFrom = (value: string | undefined): Adapter | null => {
  const words = (value ?? "").trim().split(/\s+/).filter((word) => word !== "")
  const [command, ...args] = words
  return command === undefined ? null : { command, args }
}

/**
 * WHAT A PROBE IS GIVEN: the environment to read, the directory the agent would
 * work in, and how to look on the search path.
 *
 * HANDED IN rather than reached for, so an engine's {@link Engine.at} is a pure
 * function of them and a test needs no machine. `found` in particular is core's:
 * olai's PATH is not your shell's — run as a systemd user service it inherits
 * neither your profile nor your login shell — so where the probes look is a
 * decision about the SERVE (`OLAI_AGENT_PATH`) rather than one each engine
 * makes for itself.
 */
export interface Where {
  readonly env: { readonly [name: string]: string | undefined }
  readonly cwd: string
  /** The first RUNNABLE file of that name on the agent search path, or `null`. */
  readonly found: (name: string) => string | null
}

/**
 * WHERE A STANDING PROMPT GOES on this engine's wire.
 *
 * olai teaches a node agent's session one standing instruction, once
 * (`@olai/chat`'s `teaching.ts`, which argues both the words and the channel).
 * The TEXT of it is core's and is versioned with the binary — one contract, one
 * spelling, and a reader comparing two agents' first turns sees one law. WHICH
 * CHANNEL it rides is not: it is a fact about the engine, so the engine's own
 * plugin says it.
 *
 * ONE ARM TODAY, and the arm is the ruling rather than a placeholder. ACP has no
 * system prompt — `session/new` carries a cwd and a list of MCP servers and
 * nothing else a client may put words in — so every engine olai ships rides the
 * first turn: the lines go under the first message a person sends, which puts
 * them IN THE TRANSCRIPT where the person can read what their agent was told,
 * costs a turn only where somebody says something, and survives a `/clear` by
 * construction because "has this session been taught" is written down per
 * session.
 *
 * A SECOND ARM IS A `tsc` ERROR UNTIL CORE HANDLES IT, which is the whole point
 * of the field being data rather than an assumption: `@olai/chat` switches on
 * this exhaustively, so an engine that grows a real system-prompt slot adds an
 * arm here and the compiler names every place that has to learn it — instead of
 * core growing a branch on an engine's id.
 */
export type PromptChannel =
  /** Under the first message of the session, as lines a person can read. */
  { readonly kind: "first-turn" }

/**
 * ONE ENGINE, AS ITS PLUGIN REGISTERS IT.
 *
 * NO `id`. The id is the FIBER'S WORD — the row's `id` in `olai.yml`, which is
 * the sibling key, the word `--plugins` takes, the address of its docs page and
 * the stamp every other keyed service reads off the registry binding. A plugin
 * cannot spell another's, because there is no field here to spell one in.
 */
export interface Registering {
  /** WHAT A PERSON READS — in the picker, and in the header beside the model.
   *
   *  The plugin's, because it is a name rather than an identifier: "Claude Code"
   *  is not the word `claude` with a capital letter, and a core table mapping
   *  one to the other would be the thing this whole phase deleted. */
  readonly name: string
  /** How to read this agent's wire — {@link ./leg.ts}. */
  readonly leg: Leg
  /** How to start it HERE, or `null` when this machine has no install of it.
   *
   *  `null` IS NOT A FAULT. A machine that simply is not running the tool has
   *  had nothing go wrong; what a person is owed in that case is
   *  {@link missing}, which is a different sentence and is answered whether or
   *  not anybody looked. */
  readonly at: (where: Where) => Adapter | null
  /** Which channel this engine's standing prompt rides —
   *  {@link PromptChannel}. */
  readonly prompt: PromptChannel
}

/**
 * ...AND AS THE REGISTRY HOLDS IT — the registration with the word the fiber
 * was bound under stamped on it.
 *
 * A separate type from {@link Registering} rather than an optional field, for
 * the reason every keyed door in this tree keeps the two apart: a plugin writes
 * the first and can never write the second, and core reads the second and never
 * has to trust the first about whose it is.
 */
export interface Engine extends Registering {
  readonly id: string
}
