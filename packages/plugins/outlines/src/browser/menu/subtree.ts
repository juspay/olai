import type { Row } from "@olai/format"

const INDENT = "\t"

export const asText = (row: Row): string => {
  const out: Array<string> = []
  write(row, 0, out)
  return out.join("\n")
}

const write = (row: Row, depth: number, out: Array<string>): void => {
  if (row.kind !== "node" && row.kind !== "mirror") return
  const pad = INDENT.repeat(depth)
  out.push(`${pad}${row.shows.node.title}`)
  for (const line of row.shows.node.desc?.split("\n") ?? []) {
    out.push(line === "" ? "" : `${pad}${INDENT}${line}`)
  }
  for (const child of row.children) write(child, depth + 1, out)
}
