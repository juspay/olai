/**
 * A server-door half, as a Cordis plugin. The half is data — name, surface,
 * faces, serve, kinds — and this module never spells one.
 *
 * `inject` is the reactive coeffect. The fiber stays PENDING until those four
 * services exist, unloads when one leaves, re-applies when it returns.
 */

import type { Context } from "cordis"

import type { PluginServices, PropKind } from "@olai/plugin-api/server"

import { servicesOf } from "./services.ts"

export const inject = ["vault", "deliveries", "kinds", "surfaces"] as const

/** A server-door half as this spike consumes it. `revision` takes `never`
 *  so a tenant that narrowed the snapshot (the real halves) still assigns —
 *  the event payload is untyped and the cast is at the one call. */
export type TenantHalf = {
  readonly name: string
  readonly surface: { readonly spec: unknown }
  readonly faces: Readonly<Record<string, Readonly<Record<string, unknown>>>>
  readonly kinds?: ReadonlyArray<PropKind>
  readonly serve: (services: PluginServices) => {
    readonly deps: unknown
    readonly revision: (revision: never) => void
    readonly unloaded: () => void
  }
}

export const asFiber = (half: TenantHalf) => ({
  name: half.name,
  inject,
  apply(ctx: Context) {
    const served = half.serve(servicesOf(ctx, ctx.fiber.name))
    for (const kind of half.kinds ?? []) {
      ctx.kinds.register(kind)
    }
    ctx.surfaces.register({
      name: half.name,
      surface: half.surface,
      faces: half.faces,
      deps: served.deps,
    })
    ctx.on("vault/revision", (snapshot) => {
      served.revision(snapshot as never)
    })
    // `PluginServer.unloaded` is not teardown: it means the store failed to
    // publish. Registrations above are effects and unwind with the fiber.
    // Phase 2 needs a distinct dispose if a half has teardown beyond that;
    // this adapter does not call the wrong hook.
  },
})
