import { type Accessor, createEffect, createMemo } from "solid-js"
import { createDeclared } from "../references.ts"

export const createChipTitles = (
  ids: Accessor<ReadonlyArray<string>>,
): Accessor<ReadonlyMap<string, string>> => {
  const references = createDeclared()
  createEffect(() => references.want(ids()))
  return createMemo(() => new Map(ids().flatMap(id => {
    const title = references.title(id)
    return title === null ? [] : [[id, title] as const]
  })))
}
