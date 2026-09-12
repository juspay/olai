import type { Claim } from "@olai/format"

/** Inert keys shared by the two reader-owned locations. */
export type FileKindKey = { readonly kind: string } | { readonly holds: Claim["holds"] }
export const fileKindKey = (by: FileKindKey): string => "kind" in by ? `kind:${by.kind}` : `holds:${by.holds}`

/** A row-specific drawing overrides the general drawing for what it holds. */
export const forFileClaim = <T extends { readonly by: FileKindKey }>(claim: Pick<Claim, "kind" | "holds"> | undefined, entries: Iterable<T>): T | undefined => {
  if (claim === undefined) return undefined
  let held: T | undefined
  for (const entry of entries) {
    if ("kind" in entry.by) {
      if (entry.by.kind === claim.kind) return entry
    } else if (entry.by.holds === claim.holds) held = entry
  }
  return held
}
