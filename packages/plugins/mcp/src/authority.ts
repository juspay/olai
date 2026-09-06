/** Attribution is attached by the credential owner, outside RPC payloads. */
import { RequestAuthority } from "@olai/plugin-api/authority"
import type { SurfaceHandlers } from "@kolu/surface/server"
import type { ServedGeneration } from "@kolu/surface/expose"
import { Effect, Stream } from "effect"
export type Bound = Pick<ServedGeneration, "group" | "handlers"> & { readonly writes: readonly string[] }
export const writerAt = (bound: Bound, caller: { readonly writer: string; readonly fence?: unknown }): SurfaceHandlers => {
  const handlers: SurfaceHandlers = {}
  for (const [tag, handle] of Object.entries(bound.handlers)) handlers[tag] = !bound.writes.includes(tag) ? handle : input => {
    const result = handle(input)
    return Effect.isEffect(result)
      ? Effect.provideService(result, RequestAuthority, caller)
      : Stream.provideService(result, RequestAuthority, caller)
  }
  return handlers
}
