/** A result's file, then ancestors from the file down. Separate parts let
 * every search door keep the file and nearest ancestor while the middle shrinks.
 * These are existing hit fields; no new reading or ownership boundary. */
import type { NodeHit } from "@olai/format"

export interface Place {
  readonly file: string
  readonly middle?: string
  readonly nearest?: string
}

export const nodePlace = (hit: Pick<NodeHit, "file" | "path">): Place => ({
  file: hit.file,
  ...(hit.path.length > 1 ? { middle: hit.path.slice(0, -1).join(" · ") } : {}),
  ...(hit.path.length > 0 ? { nearest: hit.path[hit.path.length - 1]! } : {}),
})
