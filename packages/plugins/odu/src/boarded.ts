/**
 * THE VAULT HALF of board-driven CI discovery — which nodes name a run id.
 *
 * The walk is today's worktree walk with the kind swapped: mirrors skipped
 * (the whole-vault sibling), first writer wins per run id. There is no
 * fallback, no path resolution, no `pr-url`.
 */

import {
  declarationsOf,
  declaresKind,
  type Derived,
  isRegular,
  textDeclaredAs,
} from "@olai/format"
import type { BoardedRun } from "olai-plugin-odu/appliance"

import { ownKinds, RUN_TYPE } from "./kinds.ts"

/**
 * Every node carrying a key this vault declares a `run`.
 *
 * FIRST WRITER WINS among nodes naming one run id: two nodes on one run is
 * one chip, and the second claim is the mistake.
 */
export function* boardedIn(derived: Derived): Generator<BoardedRun> {
  const declarations = declarationsOf(derived, ownKinds)
  if (!declaresKind(declarations, RUN_TYPE)) return
  const seen = new Set<string>()
  for (const located of derived.nodes) {
    if (!isRegular(located)) continue
    const value = textDeclaredAs(declarations, located.node, RUN_TYPE)
    if (value === undefined || value.trim() === "") continue
    if (seen.has(value)) continue
    seen.add(value)
    yield {
      id: value,
      node: located.node.id,
      title: located.node.title,
    }
  }
}
