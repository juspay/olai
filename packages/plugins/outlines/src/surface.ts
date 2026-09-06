import { defineSurface } from "@kolu/surface/define"
import { surface as legacy } from "@olai/surface"
import { MARKS } from "@olai/format"

/** Static compatibility contract; live handlers belong to this capability. */
export const surface = defineSurface({
  collections: { outlines: legacy.spec.collections.outlines },
  streams: { page: legacy.spec.streams.page, narrowing: legacy.spec.streams.narrowing, searchResults: legacy.spec.streams.searchResults, tagCompletions: legacy.spec.streams.tagCompletions, moving: legacy.spec.streams.moving },
  procedures: {
    edit: legacy.spec.procedures.edit,
    search: { nodes: legacy.spec.procedures.search.nodes },
    vocabulary: { tags: legacy.spec.procedures.vocabulary.tags },
    nodes: { named: legacy.spec.procedures.nodes.named, homes: legacy.spec.procedures.nodes.homes },
    ops: { outlines: legacy.spec.procedures.ops.outlines, node: legacy.spec.procedures.ops.node, subtree: legacy.spec.procedures.ops.subtree, run: legacy.spec.procedures.ops.run },
  },
})
export const dispatch = {
  "surface/edit/apply": { field: "verb", cases: ["add", "move", "under", "toggle", "walk", "title", "desc", "date", "repeat", "prop", "split", "merge", "unmirror", "mirror", "trash", "duplicate", "see", "after", "place", "mark", "remove"] },
  "surface/ops/run": { field: "op", cases: [...MARKS, "add", "title", "desc", "date", "repeat", "prop", "move", "split", "merge", "trash", "duplicate", "see", "mirror", "unmirror", "after", "update", "apply"] },
} as const
export const faces = {
  "browser": {
    "page": "resource",
    "narrowing": "resource",
    "searchResults": "resource",
    "tagCompletions": "resource",
    "moving": "resource",
    "edit.apply": "tool",
    "search.nodes": "tool",
    "vocabulary.tags": "tool",
    "nodes.named": "tool",
    "nodes.homes": "tool"
  },
  "agent": {
    "outlines": "resource",
    "search.nodes": "tool",
    "ops.outlines": "tool",
    "ops.node": "tool",
    "ops.subtree": "tool",
    "ops.run": "tool"
  }
} as const
