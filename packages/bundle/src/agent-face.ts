/**
 * THE AGENT FACE, AS THE CLI REACHES IT — a re-export, and nothing else.
 *
 * `olai surface <verb>` DIALS `/mcp`. So the contract it addresses and the
 * expose map it resolves URIs from must be the very ones the served face
 * publishes, or the CLI names a resource nobody answers. Those two values
 * belong to the row that serves them (`olai-plugin-mcp`'s `client.ts`), and
 * this file exists only to carry them across a wall.
 *
 * THE WALL IS THE REGISTRY'S OWN. `@olai/server` is a general package, and
 * `./fence.test.ts`'s "general production packages name no plugins" refuses a
 * plugin specifier in one of its production files — a rule with no exception
 * for a door that happens to be a contract, because a general package that can
 * name one plugin can name any. The registry is the one member allowed to, and
 * composing plugin-owned declarations for a general consumer is what it is
 * FOR: `./assets.ts`, `./policy.ts` and `./tools.ts` are the same move.
 *
 * IT REPLACED A COMPOSITION rather than a forwarding. This door used to be
 * `./surface.ts`'s flat aggregate of every row's members plus `./faces.ts`'s
 * hand-written `MCP` map — the second place a permission was typed, which is
 * #546's whole finding. Nothing here decides anything now; the decision is one
 * file, in the row that serves it.
 */
export { AGENT_EXPOSE, mcpContract } from "olai-plugin-mcp/face"
