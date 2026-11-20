import {
  declaresKind,
  isRegular,
  type Located,
  type PropDeclarations,
  textDeclaredAs,
} from "@olai/format"
import type { Claimant } from "olai-plugin-kolu/appliance"

import { TERMINAL_TYPE } from "./kinds.ts"

export function* claimantsIn(
  declarations: PropDeclarations,
  nodes: ReadonlyArray<Located>,
): Generator<Claimant> {
  if (!declaresKind(declarations, TERMINAL_TYPE)) return
  for (const located of nodes) {
    if (!isRegular(located)) continue
    const terminal = textDeclaredAs(declarations, located.node, TERMINAL_TYPE)
    if (terminal === undefined) continue
    yield {
      id: located.node.id,
      title: located.node.title,
      file: located.file,
      terminal,
    }
  }
}
