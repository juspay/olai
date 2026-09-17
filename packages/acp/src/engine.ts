/**
 * WHAT IT TAKES TO SEAT AN ACP AGENT ON THIS HOST — the shape one ENGINE PLUGIN
 * hands over, and the shape core reads it back as.
 *
 * ## Why this is a module and not a table
 *
 * It was a table: `KINDS` in `olai-plugin-chat`'s `agents/roster.ts`, three rows deep,
 * each naming a leg, an id and a probe, with `@olai/surface`'s `AGENTS` beside
 * it as a closed union so that a fourth engine was a core PR in two packages.
 * The engines are PLUGINS now — one directory each, one row each in
 * `olai.yml`, each with its own adapter pin and its own release clock (the
 * Claude adapter's moved five times in a month; opencode's has never moved) —
 * so what used to be a table is a REGISTRATION, and this is what it carries.
 *
 * ## Why it lives in `@olai/acp`
 *
 * Engine plugins register these data and chat owns their detection and use.
 * Neither the protocol nor chat knows which engine plugins the bundle mounts.
 * The shared shape belongs below both owners, at the protocol boundary.
 *
 * AND HOW TO GET THE ENGINE, which is the one that came back. `NotHere`
 * lives below now ({@link NotHere}, beside the probe that answers one) and
 * rides {@link Registering.at} in the same direction: an engine hands over
 * EITHER the adapter to spawn OR the sentence a machine that has none is
 * owed, so `null` — the arm that silently dropped a row from every face — is
 * unspellable. `@olai/plugin-api`'s `contract.ts` re-exports the type for the
 * probes that answer one there; this is the canonical spelling because both
 * walls open this door and neither may open the other's package.
 */

import type { Leg } from "./leg.ts"

export * from "./leg.ts"

/**
 * Which executable speaks ACP, and what "none" means.
 *
 * **The default is the pinned Claude Code adapter, on every documented way of
 * starting olai** (the claude plugin's own `default.nix` declares the
 * `OLAI_ACP_AGENT` knob), baked into the packaged binary's wrapper with
 * `--set-default`; the dev-loop recipes resolve the same derivation on
 * demand. So a person who follows any documented path gets a
 * working chat panel and never has to know this variable exists.
 *
 * It names the adapter resource. An empty value makes that engine unavailable;
 * it does not suppress the other engines. Chat enablement belongs to the vault.
 * The static name lives here so consumers need not import another plugin.
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
 * SOMETHING THIS HOST DOES NOT HAVE, and what a person is owed about it.
 *
 * OWNED HERE AND NOWHERE ELSE, beside the {@link Registering.at} that answers
 * one: this is the shape an ENGINE hands back, and an engine already opens this
 * door for its leg and its adapter, so it needs no second one. A probe about
 * something that is not an ACP engine — an MCP server, a padi — spells the same
 * three fields itself (`@olai/plugin-api`'s `Probed.missing`) rather than
 * importing this name, because contravariance makes the narrower spelling the
 * stronger claim and a package that speaks the protocol has no business owning
 * another subject's absence. Keeping the canonical shape here also preserves
 * ACP's leaf dependency boundary.
 *
 * `where` is where the thing WOULD be, in whichever way makes sense for it: the
 * file a probe asked for, or the page a person downloads it from. `null` for
 * the ways of being absent that name no place at all.
 *
 * `why` is a WHOLE SENTENCE and nothing composes around it. The words belong to
 * whoever found out — the five ways a padi can fail are `olai-plugin-kolu`'s to
 * word, and where to get opencode is `olai-plugin-opencode`'s — because a
 * sentence built out of a core template with a plugin's noun dropped into it is
 * a debug log line on a screen. **Core displays a sentence and never composes
 * one.**
 */
export interface NotHere {
  readonly name: string
  readonly where: string | null
  readonly why: string
}

/**
 * An adapter out of one environment variable, or `null` for "not here".
 *
 * Split on whitespace: a path with a space in it is a thing somebody can work
 * around with a wrapper, and a shell is a thing nobody can take back.
 *
 * KEPT even though {@link Registering.at} answers `Adapter | NotHere` now:
 * "the variable names a command line or it does not" is a question half of its
 * own, and the two engines shipped rather than found ask it of their own
 * variable before composing the sentence the other answer carries.
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
 * (`olai-plugin-chat`'s `teaching.ts`, which argues both the words and the channel).
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
 * of the field being data rather than an assumption: `olai-plugin-chat` switches on
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
 * the sibling key, the settings namespace, the address of its docs page and
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
  /** How to start it HERE, or what a person is owed about its absence.
   *
   *  ONE ANSWER AND NO `null` ARM. A machine that simply is not running the
   *  tool has had nothing go wrong — that is the {@link NotHere} arm, the
   *  engine's own whole sentence (its `install.ts`, the same words its
   *  browser half used to hang), and it is answered whether or not anybody
   *  looked. `null` was the arm that made an absence invisible: the roster
   *  dropped the row and no face, log line or cell could say why, which is
   *  the defect this union exists to close. */
  readonly at: (where: Where) => Adapter | NotHere
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
