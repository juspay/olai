/**
 * @olai/chat — one conversation with one ACP agent, and what it did.
 *
 * Four exports and no more, because the composition root should be able to say
 * "an agent, wired to the surface" in a handful of lines:
 *
 *   - {@link roster} and its companions answer WHICH AGENTS this machine has —
 *     a PATH probe per agent olai knows, plus the one `OLAI_ACP_AGENT` names.
 *     Detecting them is the caller's move (it owns the process); deciding what
 *     a detected one looks like is this package's;
 *   - {@link make} builds the conversation over an agent factory it is handed,
 *     and everything else — the transcript, the protocol, the session — is
 *     behind it;
 *   - `Change` is exported because the surface collection is seeded from the
 *     transcript this package keeps, and a caller that publishes what changed
 *     has to be able to name it. The `Transcript` itself is NOT exported —
 *     nothing above this line writes rows, it only forwards what came out;
 *   - {@link cadence} is the other half of that change — what a row that is
 *     still GROWING costs the wire. A caller publishes changes through it
 *     instead of straight onto the collection, and what comes back is frames
 *     on a clock ({@link ./cadence.ts}). Exported for the same reason `Change`
 *     is: the composition root is what owns a socket, so the cadence has to be
 *     nameable there.
 *
 * `agent.ts` is deliberately NOT exported. Nothing above this line should be
 * able to spell `session/update`.
 *
 * `Probe` and what it answers are TYPES only, and they are here because the
 * composition root is what fills that list: an optional MCP server this host
 * might be running is something only the root knows about, so this package
 * declares the SHAPE of the question and never an answer to it
 * ({@link ./probes.ts}).
 */

export { type Adapter, AGENT_ENV, whyNoAgent } from "./adapter.ts"
export { type Installed, roster } from "./agents/roster.ts"
export { type Chat, make, type Options, type ToolServer } from "./chat.ts"
export type { Probe, Probed, StdioServer } from "./probes.ts"
export type { Change } from "./transcript.ts"
export { type Cadence, cadence, type Frame, type Pieces } from "./cadence.ts"
