/**
 * olai-plugin-chat — node-scoped ACP conversations and what they did.
 *
 * Four exports and no more, because the composition root should be able to say
 * "an agent, wired to the surface" in a handful of lines:
 *
 *   - {@link roster} and its companions answer WHICH AGENTS this machine has —
 *     a PATH probe per agent olai knows, plus the one `OLAI_ACP_AGENT` names.
 *     Detecting them is the caller's move (it owns the process); deciding what
 *     a detected one looks like is this package's;
 *   - {@link make} builds the scheduler over an agent factory it is handed;
 *     each acquired node owns one lower-level panel and Effect scope;
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
 *   - {@link sessionsIn} is the sixth and is here for {@link scopesIn}'s reason
 *     read one question over: what olai OVERHEARD a conversation do — that it
 *     was taught its node agent's contract, and what it last said — is half of
 *     an answer whose other half is the vault, and the composition root is the
 *     only thing that holds both ({@link ./sessions.ts}). It is built there and
 *     handed to {@link make} as `Options.overheard`, with the vault's half
 *     arriving as `Options.agentAt`.
 *   - {@link scopesIn} is the fifth, and it is here for the third of those
 *     reasons: WHICH conversations a person pointed a plugin's doorbell at is
 *     a record about a plugin, and the composition root is the only thing that
 *     has plugins ({@link ./scopes.ts}). It is built there and handed to
 *     {@link make} as `Options.scoping`.
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

export { AGENT_ENV, whyNoAgent } from "./adapter.ts"
export {
  type Conversing,
  forLocalState as sessionsIn,
  type Overheard,
  type Said,
  type Sessions,
} from "./sessions.ts"
export { type Installed, roster, type Roster } from "./agents/roster.ts"
export { type ToolServer } from "./chat.ts"
export { type Chat, DEFAULT_CAPACITY, DEFAULT_IDLE, type LiveSession, make, type Options, type ToolTicket } from "./scoped.ts"
export type { Probe, Probed, StdioServer } from "./probes.ts"
export { type Fault, type Faulted, forLocalState as scopesIn, type Scoped, type Scopes } from "./scopes.ts"
export type { Change } from "./transcript.ts"
export { type Cadence, cadence, type Frame, type Pieces } from "./cadence.ts"
