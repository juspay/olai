/**
 * Which executable speaks ACP, and what "none" means.
 *
 * **The default is Claude Code, on every documented way of starting olai.** The
 * adapter is pinned (`nix/acp-agent.nix`) and baked into the packaged binary's
 * wrapper with `--set-default`, exactly as the racket reference's `default.nix`
 * did; the dev-loop recipes (`just serve`, `just run`) resolve the same
 * derivation on demand. So a person who follows any documented path gets a
 * working chat panel and never has to know this variable exists.
 *
 * `OLAI_ACP_AGENT` is the override, and it has two shapes because the wrapper's
 * `${OLAI_ACP_AGENT-…}` substitutes only when the variable is UNSET:
 *
 *   - set to a command → that is the agent, pinned default ignored. This is how
 *     you point olai at a different ACP agent, and how the e2e suite points it
 *     at a scripted one;
 *   - set to the EMPTY string → deliberately no agent. It survives the wrapper
 *     (an empty value is still a value), so it is the explicit off switch;
 *   - unset → the pinned default, wherever one has been baked in. Unset AND
 *     nothing baked in — running `bun packages/server/src/main.ts` by hand — is
 *     the only way to reach "no agent" by accident.
 *
 * With no agent, olai serves the outlines exactly as it does with one: reading
 * a directory does not depend on an agent being installed. What it does NOT do
 * is hide the feature — the panel draws, and says there is no agent and which
 * variable would give it one. A missing capability the user can see explained
 * is worth more than a button that silently is not there.
 */

/** The variable, spelled once. */
export const AGENT_ENV = "OLAI_ACP_AGENT"

/** ... and the one saying where the OTHER agents are looked for, which the
 *  sentence below has to name. Its rules are {@link ./agents/roster.ts}'s;
 *  spelled here because a module that imported the roster for one string would
 *  be the roster importing itself (the roster reads this file). */
export const AGENT_PATH_ENV = "OLAI_AGENT_PATH"

/** Which executable speaks ACP FOR PI — the pi-acp adapter, pinned and baked
 *  into the packaged binary's wrapper beside the Claude Code one. One variable
 *  per adapter rather than a pair syntax on {@link AGENT_ENV}.
 *
 *  pi-acp is the second adapter olai SHIPS rather than finds — the npm world
 *  floats a new build under every `npx -y pi-acp`, and the wire facts the pi
 *  leg is written against are one revision's — so this variable is the row's
 *  whole door, exactly as {@link AGENT_ENV} is the claude row's. Spelled here
 *  for {@link AGENT_PATH_ENV}'s reason. */
export const PI_AGENT_ENV = "OLAI_ACP_PI"

export interface Adapter {
  readonly command: string
  readonly args: ReadonlyArray<string>
  /** Extra environment for the SPAWN, merged over olai's own — the one door an
   *  adapter has for being pointed at something that is not on olai's PATH.
   *  pi-acp's is the `pi` it is to wrap, which the roster found on the AGENT
   *  search path: olai's PATH is not your shell's (the roster says why), and
   *  without it the adapter would resolve the word `pi` against a third path,
   *  its child's. Omitted for adapters that want nothing, so a child inherits
   *  exactly what olai has. */
  readonly env?: Readonly<Record<string, string>>
}

/**
 * What to spawn, or `null` for "no agent".
 *
 * The value is a command line rather than a bare path, because an adapter is
 * often `node /path/to/index.js` and demanding a wrapper script for that would
 * be demanding one for the common case. Split on whitespace: a path with a
 * space in it is a thing somebody can work around with a wrapper, and a shell
 * is a thing nobody can take back.
 */
export const adapterFrom = (value: string | undefined): Adapter | null => {
  const words = (value ?? "").trim().split(/\s+/).filter((word) => word !== "")
  const [command, ...args] = words
  return command === undefined ? null : { command, args }
}

/**
 * Why the roster is EMPTY, as a line for the log.
 *
 * The two cases read differently on purpose: an EMPTY variable is somebody
 * saying "not this time" — and it is the whole off switch, so nothing else was
 * even looked for — while an absent one is a launch path that did not go
 * through the wrapper or the justfile, which is worth pointing at because every
 * documented path bakes the default in. The second line also names the other
 * variable, because "olai cannot see the opencode I installed" is a PATH
 * question and this is the line somebody greps.
 */
export const whyNoAgent = (value: string | undefined): string =>
  value === undefined
    ? `no agent: ${AGENT_ENV} is unset and nothing baked one in — the packaged binary and ` +
      `\`just serve\` both default to the pinned Claude Code adapter, so this is a hand-rolled start ` +
      `— and no other known agent was found on ${AGENT_PATH_ENV} (or PATH, where that is unset). ` +
      `The outlines are served as usual and the chat panel says the same thing.`
    : `no agent: ${AGENT_ENV} is set to the empty string, which is the explicit off switch — the ` +
      `whole panel, so nothing else was looked for either. The outlines are served as usual and the ` +
      `chat panel says so.`
