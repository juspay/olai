/**
 * The olai surface — the typed reactive layer the web client and the MCP
 * tools will both speak (docs/brainstorming/typescript-rewrite.md, decision 6).
 *
 * Phase 1 declares exactly one read-only cell, so the scaffold has a real
 * surface to assemble rather than a mock: the greeting the binary prints.
 * Phase 2 replaces it with the snapshot stream, the ops procedures and the
 * error cell.
 */

import { defineSurface } from "@kolu/surface/define"
import { Schema } from "effect"

export const GREETING = "hello from olai"

export const surface = defineSurface({
  cells: {
    // Wire-read-only: nothing writes it, and a write verb the server never
    // serves would crash surface's boot walk.
    greeting: { schema: Schema.String, default: GREETING, verbs: ["get"] },
  },
})

/** The wire tags the surface claims, sorted. Reading them is how the smoke
 *  test proves the Effect RPC group actually assembled under Bun. */
export const wireTags: ReadonlyArray<string> = [...surface.group.requests.keys()].sort()
