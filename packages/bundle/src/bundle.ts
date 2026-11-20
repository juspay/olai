import type { Host, PropKind, RowReport } from "@olai/plugin-api"
import { definePlugin, kindWordOf, rowReport } from "@olai/plugin-api"
import { BundleModules } from "@olai/plugin-api/services"
import { namedBy, offered, provide, settled } from "@olai/effect-cordis"

export { offered, provide, settled, serviceChanges } from "@olai/effect-cordis"
import { flipRow, patchRow, mountRows, rowConfigs } from "@olai/effect-cordis/loader"
import { Effect, Schema, type Scope } from "effect"

import { BUNDLE_NAMES, ROWS } from "./rows.ts"

const BASE_URL = new URL(".", import.meta.url).href

const BUNDLE = "../olai.yml"

export { BUNDLE_NAMES, type BundleRow, DEFAULT_BUNDLE_NAMES, ROWS } from "./rows.ts"

export type { RowReport, RowState } from "@olai/plugin-api"

export const declaredKinds: Effect.Effect<ReadonlyMap<string, PropKind>> = Effect.promise(
  async () => {
    const table = new Map<string, PropKind>()
    for (const row of ROWS) {
      const module = await importByName(row.name) as { readonly kinds?: ReadonlyArray<PropKind> }
      for (const kind of module.kinds ?? []) {
        table.set(kindWordOf(row.id, kind.kind), { ...kind, kind: kindWordOf(row.id, kind.kind) })
      }
    }
    return table
  },
)

const importByName = async (specifier: string): Promise<unknown> => {
  const row = ROWS.find((row) => row.name === specifier)
  if (row?.browserOnly) return { default: definePlugin({ name: row.id, needs: [], apply: Effect.void }) }
  return import(specifier)
}

export const reportBundle = (
  host: Host,
  also: ReadonlyArray<string> = [],
): Effect.Effect<ReadonlyMap<string, RowReport>> =>
  rowReport(host, also.length === 0 ? BUNDLE_NAMES : [...BUNDLE_NAMES, ...also])

export const rowsNaming = (host: Host, also: ReadonlyArray<string> = []): ReadonlyMap<string, ReadonlyArray<string>> =>
  namedBy(host, [...BUNDLE_NAMES, ...also])

export const configsOf = (
  host: Host,
): ReadonlyMap<string, Readonly<Record<string, unknown>>> => rowConfigs(host)

export const setRow = (
  host: Host,
  id: string,
  enabled: boolean,
): Effect.Effect<boolean> =>
  Effect.flatMap(
    flipRow(host, id, !enabled),
    (found) => found ? Effect.as(settled(host, BUNDLE_NAMES), true) : Effect.succeed(false),
  )

export const mountBundle = (
  host: Host,
  patches: ReadonlyArray<{ readonly id: string; readonly disabled?: boolean; readonly config?: unknown }> = [],
  profile: string = "web",
  prepare = false,
): Effect.Effect<void, never, Scope.Scope> => Effect.gen(function*() {
  yield* provide(host, BundleModules, () => ({
    read: Effect.promise(() => Promise.all(ROWS.map(async (row) => ({ name: row.id, exports: await importByName(row.name) })))),
  }))
  const defaults = yield* Effect.promise(async () => Promise.all(ROWS.map(async (row) => {
    const module = await importByName(row.name) as { default: { config?: Schema.ConstraintDecoder<unknown, never> } }
    const schema = module.default.config
    try { return schema === undefined ? [] : [{ id: row.id, config: Schema.decodeUnknownSync(schema)({}) }] }
    catch { return [] }
  })))
  yield* Effect.flatMap(
    mountRows(host, {
      baseUrl: BASE_URL,
      path: BUNDLE,
      patches: [...profilePatch(profile), ...defaults.flat(), ...patches, ...(prepare ? profilePatch("test-minimal") : [])],
      resolve: importByName,
    }),
    () => settled(host, BUNDLE_NAMES),
  )
})

export const profilePatch = (profile: string) => profile === "web" ? [] : ROWS.map((row) => ({
  id: row.id,
  disabled: row.disabled === true || !row.profiles?.includes(profile),
}))

export const patchBundleRows = (host: Host, patches: ReadonlyArray<{ readonly id: string; readonly disabled?: boolean; readonly config?: unknown }>) =>
  Effect.gen(function*() {
    const found: boolean[] = []
    for (const { id, ...patch } of patches) found.push(yield* patchRow(host, id, patch))
    yield* settled(host, BUNDLE_NAMES)
    return found
  })

export const patchBundleRow = (host: Host, id: string, patch: { readonly disabled?: boolean; readonly config?: unknown }) =>
  Effect.map(patchBundleRows(host, [{ id, ...patch }]), found => found[0] ?? false)
