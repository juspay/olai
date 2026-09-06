import { expect, test } from "bun:test"
import { createRoot, createSignal, onCleanup } from "solid-js"
import { createDeclared, holdReferences } from "./references.ts"

test("reference consumers retract on departure and acquire fresh scoped readers on restoration", () => {
  let scopes = 0
  let released = 0
  const implementation = () => ({
    declare: () => {
      scopes++
      onCleanup(() => released++)
      const [ids, setIds] = createSignal<ReadonlyArray<string>>([])
      return { named: (id: string) => ids().includes(id) ? id : null, told: (id: string) => ids().includes(id) ? id : undefined, want: setIds }
    },
    showNode: () => (_id: string) => {},
    failure: () => null,
  })
  const first = holdReferences(implementation())
  createRoot(dispose => {
    const consumer = createDeclared()
    consumer.want(["first"])
    expect(consumer.named("first")).toBe("first")
    expect(scopes).toBe(1)
    first()
    expect(consumer.named("first")).toBeNull()
    expect(released).toBe(1)
    const second = holdReferences(implementation())
    expect(consumer.named("first")).toBeNull()
    expect(scopes).toBe(2)
    consumer.want(["next"])
    expect(consumer.named("next")).toBe("next")
    first() // an obsolete release cannot withdraw the replacement
    expect(consumer.named("next")).toBe("next")
    second()
    expect(released).toBe(2)
    dispose()
  })
})
