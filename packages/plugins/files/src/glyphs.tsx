import { forFileClaim } from "@olai/plugin-api/file-kinds"
import type { Locations } from "@olai/plugin-api/contracts"
import { heldService } from "@olai/ui-primitives/held.ts"
import { Dynamic } from "solid-js/web"
import { fileKinds } from "./contract.ts"
import { servedDirectory } from "./vault.ts"
import { TESTID } from "./testids.ts"
import { FolderGlyph } from "./FolderGlyph.tsx"

const locations = heldService<Locations["read"]>()
export const holdKindDrawings = locations.hold
export const drawingOf = (kind: string) => forFileClaim(
  servedDirectory()?.claims().byKind.get(kind),
  (locations.read()?.(fileKinds) ?? []).map(entry => entry.value),
)
function PlainFile() {
  return <svg class="h-full w-full" viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden="true"><path d="M3 1.5h6l4 4v9H3zM9 1.5v4h4" /></svg>
}
export function Glyph(props: { readonly of: string; readonly size?: string }) {
  return <span class={`${props.size ?? "h-3.5 w-[calc(0.875rem*18/16)]"} inline-flex shrink-0`} data-testid={TESTID.fileGlyph} data-glyph={props.of}>
    <Dynamic component={props.of === "folder" ? FolderGlyph : drawingOf(props.of)?.glyph ?? PlainFile} />
  </span>
}
