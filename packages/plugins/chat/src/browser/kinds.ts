import { forFileClaim } from "@olai/plugin-api/file-kinds"
import type { Locations } from "@olai/plugin-api/contracts"
import { heldService } from "@olai/ui-primitives/held.ts"
import { fileKinds } from "olai-plugin-files/contract"
import type { JSX } from "solid-js"
import { servedDirectory } from "./vault.ts"

const reader = heldService<Locations["read"]>()

export const holdKindReader = reader.hold

export const fileMark = (path: string): (() => JSX.Element) | undefined => {
  const directory = servedDirectory()
  const kind = directory?.kindOf(path)
  if (directory === undefined || kind == null) return undefined
  return forFileClaim(directory.claims().byKind.get(kind), (reader.read()?.(fileKinds) ?? []).map(entry => entry.value))?.glyph
}

