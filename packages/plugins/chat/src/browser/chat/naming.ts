import type { Place } from "olai-plugin-search/ui/place.ts"
import type { NodeHit } from "@olai/format"

import { dirOf, folded, matchFiles, nameOf } from "@olai/web/client/file/matching.ts"
import { LIMIT } from "olai-plugin-search/reading"
import { nodeMatches, type NodeMatch } from "./nodes.ts"


const RESERVE = 4

export interface Offer {
  readonly kind: "file" | "node"
  readonly section: string
  readonly value: string
  readonly label: string
  readonly from?: string
  readonly hint: string
  readonly place?: Place
}

export const offers = (
  files: ReadonlyArray<string>,
  hits: ReadonlyArray<NodeHit>,
  query: string,
): ReadonlyArray<Offer> => {
  const paths = matchFiles(folded(files), query, LIMIT).map((file) => file.path)
  const nodes = nodeMatches(hits)
  const forFiles = Math.min(paths.length, Math.max(RESERVE, LIMIT - nodes.length))
  const forNodes = Math.min(nodes.length, LIMIT - forFiles)
  return [
    ...paths.slice(0, forFiles).map((path): Offer => ({
      kind: "file",
      section: "files",
      value: path,
      label: nameOf(path),
      hint: dirOf(path),
    })),
    ...nodes.slice(0, forNodes).map((node): Offer => ({
      kind: "node",
      section: "nodes",
      value: node.id,
      label: node.label,
      from: node.from,
      hint: hintFor(node),
      place: node.place,
    })),
  ]
}

const hintFor = (node: NodeMatch): string => {
  const why = node.note ? " (in the note)" : ""
  return `@${node.id}${why}`
}
