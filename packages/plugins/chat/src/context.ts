import { isTrashed } from "@olai/format"
import type { NodeContext } from "olai-plugin-chat/wire"
import { annotated } from "./prompt.ts"

export const lineFor = (node: NodeContext): string => {
  const under = node.path.length === 0 ? "" : `; under ${node.path.join(" › ")}`
  const away = node.trashed === true ? "; trashed" : ""
  return `Node in context: \`${node.id}\` — ${node.title} (${node.file}:${node.line}${under}${away})`
}

export const promptWith = (
  said: string,
  nodes: ReadonlyArray<NodeContext>,
): string => annotated(said, nodes.map(lineFor))
