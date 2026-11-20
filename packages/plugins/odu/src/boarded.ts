import {
  declarationsOf,
  declaresKind,
  type Derived,
  isRegular,
  textDeclaredAs,
} from "@olai/format"

import { ownKinds, RUN_TYPE } from "./kinds.ts"

export function* boardedIn(derived: Derived): Generator<string> {
  const declarations = declarationsOf(derived, ownKinds)
  if (!declaresKind(declarations, RUN_TYPE)) return
  const seen = new Set<string>()
  for (const located of derived.nodes) {
    if (!isRegular(located)) continue
    const value = textDeclaredAs(declarations, located.node, RUN_TYPE)
    if (value === undefined || value.trim() === "") continue
    if (seen.has(value)) continue
    seen.add(value)
    yield value
  }
}
