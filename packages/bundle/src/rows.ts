import type { Plugin } from "@olai/plugin-api"

export { BROWSER_ROWS } from "./rows.generated.ts"

export interface BrowserHalf {
  readonly surface?: { readonly spec: unknown }
  readonly default: Plugin
  readonly components?: Readonly<Record<string, Plugin>>
}

export interface BrowserRow {
  readonly id: string
  readonly specifier: string
  readonly load: () => Promise<BrowserHalf>
}

export interface BundleRow {
  readonly browserOnly?: boolean
  readonly id: string
  readonly name: string
  readonly disabled?: boolean
  readonly profiles?: ReadonlyArray<string>
  readonly switchHint?: string
  readonly section: string
  readonly label?: string
  readonly quiet?: boolean
}

export { ROWS } from "./rows.generated.ts"

import { ROWS } from "./rows.generated.ts"

export const BUNDLE_NAMES: ReadonlyArray<string> = ROWS.map((row) => row.id)

const RANKS: ReadonlyMap<string, number> = new Map(BUNDLE_NAMES.map((id, at) => [id, at]))

export const bundleRank = (name: string): number => RANKS.get(name) ?? BUNDLE_NAMES.length

export const inBundleOrder = <A>(
  items: Iterable<A>,
  keyOf: (one: A) => string,
): ReadonlyArray<A> => [...items].sort((one, other) => bundleRank(keyOf(one)) - bundleRank(keyOf(other)))

export const DEFAULT_BUNDLE_NAMES: ReadonlyArray<string> = ROWS
  .flatMap((row) => row.disabled === true ? [] : [row.id])
