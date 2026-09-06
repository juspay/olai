/** A module's independently injected parts share the declaring row's lifetime
 * and authority. The container itself owns no services or feature state. */
import type { Context, Fiber } from "cordis"
import type { Plugin } from "./plugin.ts"

export const MODULE_OWNER = Symbol("effect-cordis/module-owner")
const children = new WeakMap<Fiber, ReadonlyArray<Fiber>>()
export const moduleFibers = (fiber: Fiber): ReadonlyArray<Fiber> => [fiber, ...(children.get(fiber) ?? []).flatMap(moduleFibers)]
export const moduleOwner = (ctx: Context): string =>
  (ctx as unknown as Record<symbol, string>)[MODULE_OWNER] ?? ctx.fiber.name

export const pluginModule = (value: unknown): unknown => {
  if (value === null || typeof value !== "object") return value
  const module = value as { default?: Plugin; components?: Record<string, Plugin> }
  if (!module.default || !module.components || Object.keys(module.components).length === 0) return value
  const main = module.default
  const parts = [["main", main], ...Object.entries(module.components)] as const
  for (const [local] of parts) {
    if (!/^[a-z][a-z0-9-]*$/.test(local)) throw new Error(`Invalid plugin component: ${local}`)
  }
  if ("main" in module.components) throw new Error("Plugin component name 'main' is reserved")
  const wrapper: Plugin = {
    name: main.name,
    inject: [],
    apply: async (ctx, config) => {
      ;(ctx as unknown as Record<symbol, string>)[MODULE_OWNER] = ctx.fiber.name
      const mounted: Fiber[] = []
      children.set(ctx.fiber, mounted)
      for (const [local, part] of parts) {
        mounted.push((ctx.plugin as (plugin: Plugin, config?: unknown) => Fiber)(
          { ...part, name: `${main.name}/${local}` }, local === "main" ? config : undefined,
        ))
      }
      // Cordis owns child disposal. Its scoped effects join those disposers;
      // keeping this map through cleanup also lets reports/settle see children.
      return async () => {}
    },
  }
  return { ...value, default: wrapper }
}
