import type { Effect } from "effect"
import type { Body, OutlineDiff } from "../file-surface.ts"
import type { Accessor } from "solid-js"

import { heldService } from "@olai/ui-primitives/held.ts"

import type { createDirectory } from "./directory.ts"
export type Directory = ReturnType<typeof createDirectory> & {
  readonly bodyPage: (request: Accessor<import("@olai/format").DocumentPageRequest | null>) => Accessor<import("@olai/format").PageReading | undefined>
  readonly body: (path: string) => Effect.Effect<Body, unknown>
  readonly outlineDiff: (path: string, oldText: string | null, newText: string) => Effect.Effect<OutlineDiff, unknown>
}

export interface HeldFiles {
  readonly holdServed: (directory: Directory) => () => void
  readonly servedDirectory: Accessor<Directory | undefined>
  readonly useServed: () => Accessor<ReadonlyArray<string>>
  readonly useHead: (file: Accessor<string>) => Accessor<number | undefined>
}

export const heldFiles = (): HeldFiles => {
  const provider = heldService<Directory>()
  return {
    holdServed: provider.hold,
    servedDirectory: provider.read,
    useServed: () => () => provider.read()?.paths() ?? [],
    useHead: (file) => () => provider.read()?.head(file)(),
  }
}
