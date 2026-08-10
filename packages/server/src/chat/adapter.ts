/**
 * Which executable speaks ACP, and what to do when there is none.
 *
 * The adapter is PINNED (nix/acp-agent.nix bakes it into the binary's
 * environment, the way the racket reference's `olai-acp-agent` package did), so
 * a nix-built olai needs nothing ambient — no `npx`, no PATH lookup, no version
 * that drifts under you. `OLAI_ACP_AGENT` is the escape hatch: point it at
 * another ACP agent and that is what gets spawned.
 *
 * Unset, olai serves WITHOUT a chat panel rather than refusing to start. That
 * is the one place this differs from the racket reference, which made the
 * variable a usage error, and the reason is that olai's product is the outline:
 * reading it must not depend on an agent being installed. The panel says the
 * chat is off; everything else works.
 */

/** The variable, spelled once. */
export const AGENT_ENV = "OLAI_ACP_AGENT"

export interface Adapter {
  readonly command: string
  readonly args: ReadonlyArray<string>
}

/**
 * What to spawn, or `null` for "no agent configured".
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
