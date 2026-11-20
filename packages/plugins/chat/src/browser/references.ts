import { heldService } from "@olai/ui-primitives/held.ts"
import { type Accessor, createMemo } from "solid-js"
import {
  declaredFrom,
  failureFrom,
  type Declared,
  type References,
} from "olai-plugin-outlines/references"

const provider = heldService<References>()

export const holdReferences = provider.hold

export const createDeclared = (
  failure?: (message: string, ids: ReadonlyArray<string>) => void,
): Declared => declaredFrom(provider.read, failure)

export const declaringFailure = failureFrom(provider.read)

export const createHome = (id: Accessor<string | null>): Accessor<string | null> => {
  const reading = createMemo(() => {
    const node = id()
    const outline = provider.read()
    return node === null || outline === undefined ? undefined : outline.home(node)
  })
  return () => {
    const answer = reading()?.()
    return typeof answer === "string" ? answer : null
  }
}

export const focusedNode = () => provider.read()?.focused() ?? null
