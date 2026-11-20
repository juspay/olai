import Include from "@cordisjs/plugin-include"
import type { Entry } from "@cordisjs/plugin-loader"
import Loader from "@cordisjs/plugin-loader"
import { FiberState } from "cordis"
import { Effect } from "effect"

import { pluginModule } from "./module.ts"
import { interrupt } from "./lifecycle.ts"
import { ctxOf, type Host } from "./host.ts"

export interface Row {
  readonly id: string
  readonly disabled?: boolean
  readonly config?: unknown
}

/**
 * Under bun's isolated linker the loader's own bare `import()` cannot see a
 * workspace member, so the resolver is the caller's and is assigned into
 * `loader.internal` — upstream's slot for Node's `ModuleLoader`, cast down to the
 * one method `EntryTree.import` calls. Verified against
 * `@cordisjs/plugin-loader@1.0.0-rc.7` (the pinned revision — `npins/sources.json`,
 * name `cordis`); a revision that renames or reshapes the slot fails at RUNTIME
 * rather than at typecheck.
 */
export const mountRows = (host: Host, options: {
  readonly baseUrl: string
  readonly path: string
  readonly patches: ReadonlyArray<Partial<Row> & { readonly id: string }>
  readonly resolve: (specifier: string) => Promise<unknown>
}): Effect.Effect<void> =>
  Effect.promise(async () => {
    const ctx = ctxOf(host)
    ctx.baseUrl = options.baseUrl
    await ctx.plugin(Loader)
    ;(ctx.loader as unknown as { internal: unknown }).internal = {
      version: "v1",
      import: async (specifier: string) => pluginModule(await options.resolve(specifier)),
    }
    // THE ROWS, AS THE INCLUDE MAKES THEM — registered BEFORE the include, which
    // is the whole of why this line is here and not further down: the event
    // fires from the `Entry` constructor, so a listener attached afterwards
    // would hear about every row this build adds LATER and none of the ones it
    // has.
    const rows: Array<Entry> = []
    ctx.on("loader/entry-init", (entry: Entry) => void rows.push(entry))
    ;(ctx as unknown as Record<symbol, Array<Entry>>)[ROWS] = rows
    await ctx.plugin(Include, {
      path: options.path,
      patches: [...options.patches],
    })
    await ctx.loader.await()
  })

const ROWS: unique symbol = Symbol.for("olai.effect-cordis.rows")

const entriesOf = (host: Host): ReadonlyArray<Entry> =>
  (ctxOf(host) as unknown as Record<symbol, Array<Entry> | undefined>)[ROWS] ?? []

export const patchRow = (host: Host, id: string, patch: { readonly disabled?: boolean; readonly config?: unknown }, force = false): Effect.Effect<boolean> =>
  Effect.gen(function*() {
    const entry = entriesOf(host).find((one) => one.options.id === id)
    if (entry === undefined) return false
    // Decoded structs arrive in schema key order, so serialization compares
    // canonical policy values here rather than authored property order.
    const configMoved = patch.config !== undefined
      && JSON.stringify(patch.config) !== JSON.stringify(entry.options.config)
    const changed = configMoved
      || (patch.disabled !== undefined && patch.disabled !== (entry.options.disabled ?? false))
    if (!changed && !force) return true
    if (configMoved) {
      yield* Effect.annotateLogs(
        Effect.logInfo(`plugins: config change restarts row "${id}"`),
        { keys: changedKeys(patch.config, entry.options.config).join(", ") },
      )
    }
    yield* Effect.promise(async () => {
      const going = patch.disabled === true || patch.config !== undefined ? entry.fiber : undefined
      if (going !== undefined) interrupt(going)
      await entry.update(patch).catch((cause: unknown) => {
        if (entry.fiber?.state !== FiberState.FAILED) throw cause
      })
      for (let pass = 0; pass < PASSES && going?.inertia !== undefined; pass += 1) await going.inertia
    })
    return true
  })

const changedKeys = (next: unknown, before: unknown): ReadonlyArray<string> => {
  const fields = (value: unknown): Readonly<Record<string, unknown>> =>
    value !== null && typeof value === "object" && !Array.isArray(value)
      ? value as Readonly<Record<string, unknown>>
      : {}
  const after = fields(next)
  const was = fields(before)
  return [...new Set([...Object.keys(after), ...Object.keys(was)])]
    .filter((key) => JSON.stringify(after[key]) !== JSON.stringify(was[key]))
    .sort()
}

export const flipRow = (host: Host, id: string, disabled: boolean): Effect.Effect<boolean> => patchRow(host, id, { disabled }, true)

const PASSES = 100

export const rowConfigs = (
  host: Host,
): ReadonlyMap<string, Readonly<Record<string, unknown>>> => {
  const table = new Map<string, Readonly<Record<string, unknown>>>()
  for (const entry of entriesOf(host)) {
    const id = entry.options.id
    const config = (entry.options as { readonly config?: unknown }).config
    if (
      typeof id === "string"
      && config !== undefined
      && config !== null
      && typeof config === "object"
      && !Array.isArray(config)
    ) {
      table.set(id, config as Readonly<Record<string, unknown>>)
    }
  }
  return table
}
