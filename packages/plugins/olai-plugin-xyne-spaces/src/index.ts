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
 * ## The manifest is structural
 *
 * No `: OlaiPlugin` on the value: `@olai/plugin-api` imports this package,
 * and the fit is proved at the registry's `satisfies`. `olai-plugin-kolu`'s
 * header argues the direction in full.
 */

export { faces, name, surface } from "./wire.ts"
