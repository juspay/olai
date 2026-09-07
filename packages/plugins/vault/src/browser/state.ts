/**
 * WHAT A SERVED DIRECTORY IS, as a type — and nothing live.
 *
 * There was a Solid signal here holding this row's directory, with a
 * `holdDirectory` its activation called and a `directory` accessor
 * `olai-plugin-capture` read across the wall. `vault.files` — the service this
 * row already offers, and the one `./contract.ts` names — carries the same
 * value, so what crossed as a module variable now crosses as a declared
 * dependency and leaves with the provider (the audit's §2 and §12).
 *
 * The type stays here because `./contract.ts` spells the service with it and a
 * consumer narrows its reading against it.
 */
import type { createDirectory } from "./directory.ts"
export type Directory = ReturnType<typeof createDirectory>
