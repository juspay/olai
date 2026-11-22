/** The vault judges both copies against one claims snapshot, using the format
 * that owns this path. Browsers receive changes, never a parser.
 *
 * The diff asks no reading — `changesOf` compares records' fields — but the
 * format's one parse reads each record's prose as it decodes it
 * (`@olai/format/read`). So the after side is handed the before side as the
 * document it follows, and only the records the change touched are read twice:
 * a diff costs one read of the outline, not two. */
import { type Claims, changesOf, claimedOf, parserFor } from "@olai/format"
import { Result } from "effect"
import type { OutlineDiff } from "./file-surface.ts"

export const outlineDiffOf = (
  claims: Claims,
  diff: { readonly path: string; readonly oldText: string | null; readonly newText: string },
): OutlineDiff => {
  const path = claimedOf(claims, diff.path)
  const format = path === null ? null : parserFor(claims, path)
  if (format === null) return { _tag: "Unreadable", side: "before" }
  const before = format.parse(diff.path, diff.oldText ?? "", claims)
  if (Result.isFailure(before)) return { _tag: "Unreadable", side: "before" }
  const after = format.parse(diff.path, diff.newText, claims, before.success)
  if (Result.isFailure(after)) return { _tag: "Unreadable", side: "after" }
  return {
    _tag: "Changes",
    changes: changesOf(claims,
      new Map([[diff.path, before.success.nodes.map(located => located.node)]]),
      new Map([[diff.path, after.success.nodes.map(located => located.node)]])),
  }
}
