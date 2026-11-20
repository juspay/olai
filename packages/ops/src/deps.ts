import type { Reading, Verdict } from "@olai/format"
import type * as StoreModule from "@olai/store"

export type Store = StoreModule.Store<Reading, Verdict>

export interface Directory {
  readonly root: string
  readonly store: Store
}

export interface RuntimePaths {
  readonly home: () => string
  readonly canonical: (root: string) => string
  readonly digest: (canonicalRoot: string) => string
}

export interface VaultSettings {
  readonly claims: { readonly current: import("@olai/format").Claims }
  readonly runtime: RuntimePaths
  readonly root: string
  readonly kinds: import("@olai/format").KindVocabulary
  readonly ledger: import("./ops.ts").Ledger
  readonly search: import("./ops.ts").Search
}
