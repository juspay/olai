/**
 * WHAT A SERVED DIRECTORY IS, as a type — and how a consumer holds one.
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
import type { Accessor } from "solid-js"

import { heldService } from "@olai/ui-primitives/held.ts"

import type { createDirectory } from "./directory.ts"
export type Directory = ReturnType<typeof createDirectory>

/** One consumer's readings of the served set: the directory itself, every
 *  served path, and which revision one file is at. */
export interface HeldFiles {
  /** Told by the consuming row's activation, and cleared when it stops. */
  readonly holdServed: (directory: Directory) => () => void
  /** The served directory itself, or nothing. */
  readonly servedDirectory: Accessor<Directory | undefined>
  /** Every served path, in directory order. */
  readonly useServed: () => Accessor<ReadonlyArray<string>>
  /** ...and which revision one served file is at — the question a reader asks
   *  when what it needs to know is that the file MOVED. */
  readonly useHead: (file: Accessor<string>) => Accessor<number | undefined>
}

/**
 * A HOLDER FOR ONE CONSUMER, minted where that consumer holds it.
 *
 * A FACTORY, so nothing here is state: five packages read `vault.files`, and
 * each held it in a private module of its own whose body was — byte for byte —
 * this one, under a header that restated this one. What is per-package is WHICH activation holds it, and a factory is
 * what keeps that while removing the four copies. Calling it twice gives two
 * holders, which is the same rule `@olai/ui-primitives`' `heldService` and
 * `@olai/plugin-api`'s `heldFaces` keep.
 *
 * They used to arrive as `useServed`/`useHead`: a module variable in this row's
 * own `./served.tsx`, installed by this row's activation and read by five other
 * packages with no dependency declared anywhere (the audit's §12).
 *
 * THE EMPTY ANSWERS ARE THE CONTRACT, not a fallback: every reader draws under
 * an activation that NAMES `vault.files`, so the absence is unreachable from a
 * face, and a component short of the service is left `waiting` with its row
 * running rather than throwing.
 */
export const heldFiles = (): HeldFiles => {
  const provider = heldService<Directory>()
  return {
    holdServed: provider.hold,
    servedDirectory: provider.read,
    useServed: () => () => provider.read()?.paths() ?? [],
    useHead: (file) => () => provider.read()?.head(file)(),
  }
}
