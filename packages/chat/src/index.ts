/**
 * @olai/chat — one conversation with one ACP agent, and what it did.
 *
 * Four exports and no more, because the composition root should be able to say
 * "an agent, wired to the surface" in a handful of lines:
 *
 *   - {@link adapterFrom} and its two companions answer WHICH agent, out of the
 *     environment. Resolving it is the caller's move; deciding what a resolved
 *     one looks like is this package's;
 *   - {@link make} builds the conversation over an agent factory it is handed,
 *     and everything else — the transcript, the protocol, the session — is
 *     behind it;
 *   - {@link Transcript} and its `Change` are exported because the surface
 *     collection is seeded from the one this package keeps, and a caller that
 *     publishes changes has to be able to name them.
 *
 * `agent.ts` is deliberately NOT exported. Nothing above this line should be
 * able to spell `session/update`.
 */

export {
  type Adapter,
  adapterFrom,
  AGENT_ENV,
  whyNoAgent,
} from "./adapter.ts"
export { type Chat, make, type Options, type ToolServer } from "./chat.ts"
export type { Change } from "./transcript.ts"
