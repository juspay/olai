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

export interface Adapter {
  readonly command: string
  readonly args: ReadonlyArray<string>
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
 * Why there is no agent, as a line for the log.
 *
 * The two cases read differently on purpose: an EMPTY variable is somebody
 * saying "not this time", and an absent one is a launch path that did not go
 * through the wrapper or the justfile — which is worth pointing at, because
 * every documented path bakes the default in.
 */
export const whyNoAgent = (value: string | undefined): string =>
  value === undefined
    ? `no ACP agent: ${AGENT_ENV} is unset and nothing baked one in — the packaged binary and ` +
      `\`just serve\` both default to the pinned Claude Code adapter, so this is a hand-rolled start. ` +
      `The outlines are served as usual and the chat panel says the same thing.`
    : `no ACP agent: ${AGENT_ENV} is set to the empty string, which is the explicit off switch. ` +
      `The outlines are served as usual and the chat panel says so.`
