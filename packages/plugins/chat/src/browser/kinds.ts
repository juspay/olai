/**
 * THE MARK A KIND OF FILE WEARS, as the files plugin's declared `fileKinds`
 * location says it — read so a chat about a note can wear its file's own mark
 * wherever the chat is named.
 *
 * Held for chat's activation, which declares the renderer it reads through
 * (`../browser.tsx`). With no renderer nothing is contributed anywhere, and a
 * chat about a note is named without a mark rather than with a guess.
 */
import { forFileClaim } from "@olai/plugin-api/file-kinds"
import type { Locations } from "@olai/plugin-api/contracts"
import { heldService } from "@olai/ui-primitives/held.ts"
import { fileKinds } from "olai-plugin-files/contract"
import type { JSX } from "solid-js"
import { servedDirectory } from "./vault.ts"

const reader = heldService<Locations["read"]>()

/** Told by `../browser.tsx` for chat's activation. */
export const holdKindReader = reader.hold

/** The mark the kind of file at `path` wears, or `undefined` where nobody
 *  claims the file or no kind plugin draws one. */
export const fileMark = (path: string): (() => JSX.Element) | undefined => {
  const directory = servedDirectory()
  const kind = directory?.kindOf(path)
  if (directory === undefined || kind == null) return undefined
  return forFileClaim(directory.claims().byKind.get(kind), (reader.read()?.(fileKinds) ?? []).map(entry => entry.value))?.glyph
}

