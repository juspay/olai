/**
 * THE XYNE-SPACES PLUGIN — olai's own judgement ABOUT Xyne Spaces.
 *
 * Phase 1 is Mirror: doorbell digests and trimmed orchestrator replies go
 * outbound to a bound Spaces channel; `agentProgress` fires while a turn
 * runs; nothing comes back. The signed mention/DM path is unwired on
 * purpose (watch-only, the human's ruling).
 *
 * There is no appliance-client package one floor down. Spaces is reached
 * over HTTP with an installed-app JWT, and that dial lives here — the same
 * judgement-about-an-appliance this package exists to hold, without a
 * daemon to confine behind a second wall.
 *
 * ## The fit is structural, and it is proved where the values are SPENT
 *
 * No `: OlaiPlugin` on the value below, and nothing left to annotate it with:
 * the type retired with the manifest object it described — a browser half is a
 * plugin written as an Effect now (`./browser.tsx`) — and so did the compiled-in registry
 * whose `satisfies` proved the fit, because `@olai/bundle` is rows naming
 * modules a loader resolves rather than a list of imported halves.
 *
 * The direction the old argument was made of holds and only its far end moved:
 * it was `@olai/plugin-api` that imported every plugin, so a plugin could not
 * import back; the registry left for `@olai/bundle`, and this package imports
 * the interface now (`./server.ts` names `ConversationSeen` and the declaration
 * merging that types `ctx.surfaces`). What proves the fit is where these values
 * are spent — `ctx.surfaces.register` in `./server.ts`, whose `Sibling` types
 * `surface` and `faces`, and `ctx.slots.register` in `./browser.tsx`, which
 * refuses a slot the app does not declare — with this plugin's name on the file
 * either way. `olai-plugin-kolu`'s header argues the direction in full.
 */

export { faces, name, surface } from "./wire.ts"
