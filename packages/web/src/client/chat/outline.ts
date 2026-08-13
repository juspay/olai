/**
 * A diff of an OUTLINE, read as nodes — because a text diff of one is the thing
 * this whole vocabulary exists to refuse.
 *
 * The rule is the commit panel's and it is about the FILE rather than about the
 * tool that wrote it: a `.jsonl` is one line per node, so a text diff of it is
 * one enormous line with everything on it changing at once. Olai's own writes
 * never produce one — they go through the ops layer, which answers with a
 * node-level story ({@link ./Wrote.tsx}) — but an agent's OWN `Edit` can name
 * any file it likes, and one aimed at an outline arrived here as an ordinary
 * `diff` block and was drawn as ordinary lines. That made the rule true of the
 * tool and not of the file, which is not what the design says.
 *
 * So an outline's two texts are PARSED and compared as records, with the same
 * `changesOf` the Commit panel's rows come from and the same words
 * ({@link ../changes.ts}). One classification of a change in this codebase,
 * whichever door the write came in by — which is the same argument that put
 * `Applied.sort` on the ops reply rather than a table beside it.
 *
 * `null` is the honest answer for a file this cannot read: an agent hand-editing
 * an outline is exactly how a `.jsonl` stops parsing, and inventing node changes
 * out of half a file would be worse than saying so. What the panel draws then
 * says which side would not read, and still never a text diff.
 */

import { changesOf, type Node, type NodeChange, parseOutline } from "@olai/format"
import type { FileDiff } from "@olai/surface"
import { Result } from "effect"

/** What a rewritten outline changed, or which side of it could not be read. */
export type OutlineDiff =
  | { readonly _tag: "Changes"; readonly changes: ReadonlyArray<NodeChange> }
  /** `side` is the text that would not parse — "before" for the copy that was
   *  there, "after" for the one the agent wrote. The second is the interesting
   *  one and the reason this is not a boolean: an agent that has just broken an
   *  outline by hand should be told which end broke. */
  | { readonly _tag: "Unreadable"; readonly side: "before" | "after" }

/**
 * The node-level reading of a diff whose path is an outline.
 *
 * A file that did not exist reads as an empty set on the `before` side rather
 * than as an unreadable one: every node in it is *created*, which is what
 * happened.
 */
export const outlineDiffOf = (diff: FileDiff): OutlineDiff => {
  const before = recordsIn(diff.path, diff.oldText ?? "")
  if (before === null) return { _tag: "Unreadable", side: "before" }
  const after = recordsIn(diff.path, diff.newText)
  if (after === null) return { _tag: "Unreadable", side: "after" }
  return {
    _tag: "Changes",
    changes: changesOf(
      new Map([[diff.path, before]]),
      new Map([[diff.path, after]]),
    ),
  }
}

/** One side's records, or `null` for a side that does not parse. The errors are
 *  not carried: what a reader needs here is that the file cannot be read as an
 *  outline, and the file's own page draws the validator's rows where they are
 *  pinned to lines. */
const recordsIn = (path: string, text: string): ReadonlyArray<Node> | null => {
  const parsed = parseOutline(path, text)
  return Result.isFailure(parsed) ? null : parsed.success.nodes.map((located) => located.node)
}
