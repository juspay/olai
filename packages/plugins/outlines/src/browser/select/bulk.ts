import type { Row } from "@olai/format"
import type { Edit } from "@olai/surface"

export type Bulk = "complete" | "in" | "out" | "up" | "down" | "trash"

const REVERSED: Record<Bulk, boolean> = {
  complete: false,
  in: false,
  up: false,
  out: true,
  down: true,
  trash: false,
}

const shown = (row: Row): string | undefined =>
  row.kind === "node" || row.kind === "mirror" ? row.shows.node.id : undefined

export const bulkEdits = (
  verb: Bulk,
  rows: ReadonlyArray<Row>,
): ReadonlyArray<Edit> => {
  const order = REVERSED[verb] ? [...rows].reverse() : rows
  return order.flatMap((row): ReadonlyArray<Edit> => {
    switch (verb) {
      case "in":
      case "out":
      case "up":
      case "down":
        return [{ verb: "move", id: row.at.node.id, how: verb }]
      case "complete": {
        const node = shown(row)
        return node === undefined ? [] : [{ verb: "toggle", id: node, mark: "done" }]
      }
      case "trash": {
        const node = row.kind === "node" ? row.shows.node.id : undefined
        return node === undefined ? [] : [{ verb: "trash", id: node }]
      }
    }
  })
}

export const archivable = (rows: ReadonlyArray<Row>): boolean =>
  rows.length > 0 && rows.every((row) => row.kind === "node")
