import type { Edit } from "@olai/surface"

const MOVES: ReadonlySet<Edit["verb"]> = new Set<Edit["verb"]>([
  "move",
  "place",
  "split",
  "merge",
  "toggle",
  "walk",
  "mark",
  "remove",
  "trash",
  "untrash",
  "unmirror",
  "add",
  "under",
])

export const redraws = (edit: Edit): boolean => MOVES.has(edit.verb)

export const rekeys = (edit: Edit): boolean => {
  switch (edit.verb) {
    case "place":
    case "under":
      return true
    case "move":
      return edit.how === "in" || edit.how === "out"
    default:
      return false
  }
}
