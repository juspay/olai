/** Glyph contributions are derived once per location change, owned by the
 * sidebar activation. Claim lookup still reads the current vault snapshot. */
import { forFileClaim } from "@olai/plugin-api/file-kinds"
import type { Locations } from "@olai/plugin-api/contracts"
import { heldService } from "@olai/ui-primitives/held.ts"
import { createMemo, createRoot, type Accessor } from "solid-js"
import { fileKinds, type FileKindDrawing } from "./contract.ts"
import { servedDirectory } from "./vault.ts"

const drawings = heldService<Accessor<readonly FileKindDrawing[]>>()
export const holdKindDrawings = (read: Locations["read"]): (() => void) => createRoot(dispose => {
  const entries = createMemo(() => read(fileKinds).map(entry => entry.value))
  const release = drawings.hold(entries)
  return () => { release(); dispose() }
})
export const drawingOf = (kind: string) => forFileClaim(
  servedDirectory()?.claims().byKind.get(kind),
  drawings.read()?.() ?? [],
)
