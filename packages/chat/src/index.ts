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
 *     nothing above this line writes rows, it only forwards what came out.
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
export {
  AGENT_PATH_ENV,
  type Installed,
  onPath,
  roster,
  rosterOf,
} from "./agents/roster.ts"
export { type Chat, make, type Options, type ToolServer } from "./chat.ts"
export type { Change } from "./transcript.ts"
