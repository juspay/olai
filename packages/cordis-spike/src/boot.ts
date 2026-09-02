/**
 * A Context with the four services mounted, ready for a tenant fiber.
 * Loader is optional — tests that only need `ctx.plugin` skip it.
 */

import Loader from "@cordisjs/plugin-loader"
import { Context } from "cordis"

import { DeliveriesService, Kinds, Surfaces, Vault } from "./services.ts"

export const boot = async (opts?: { loader?: boolean }): Promise<Context> => {
  const ctx = new Context()
  ctx.plugin(Vault)
  ctx.plugin(DeliveriesService)
  ctx.plugin(Kinds)
  ctx.plugin(Surfaces)
  if (opts?.loader) {
    ctx.plugin(Loader)
  }
  await ctx.fiber.await()
  return ctx
}
