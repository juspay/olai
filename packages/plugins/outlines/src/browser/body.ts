import type { RegularNode } from "@olai/format"

export const hasBody = (node: RegularNode): boolean =>
  (node.desc !== undefined && node.desc !== "") || (node.see?.length ?? 0) > 0
