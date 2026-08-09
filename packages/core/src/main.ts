/**
 * The olai binary. Phase 1 prints a greeting and the wire tags its surface
 * claims — the smallest program that proves the whole stack runs: Bun
 * executing raw TypeScript, Effect's runtime, and an Effect RPC group
 * assembled from the @kolu/surface sources hydrated out of the Nix store.
 *
 * Phase 2 turns this into `olai serve <dir>`. There is no CLI product
 * (decision 3) — this entry point exists to become the server.
 */

import { Effect } from "effect"

import { GREETING, wireTags } from "./surface.ts"

const main = Effect.sync(() => {
  console.log(`${GREETING} — surface: ${wireTags().join(", ")}`)
})

Effect.runSync(main)
