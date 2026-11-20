import { expect, test } from "bun:test"
import { createRoot, createSignal, onCleanup } from "solid-js"

import { createDeclared, holdReferences } from "./references.ts"

test("the panel's references retract on departure and acquire fresh scoped readers on restoration", () => {
  let scopes = 0
  let released = 0
  const implementation = () => ({
    declare: () => {
      scopes++
      onCleanup(() => released++)
      const [ids, setIds] = createSignal<ReadonlyArray<string>>([])
      return { title: (id: string) => ids().includes(id) ? `Title of ${id}` : null, named: (id: string) => ids().includes(id) ? id : null, told: (id: string) => ids().includes(id) ? id : undefined, want: setIds }
    },
    reveal: () => false, home: () => () => undefined,
    failure: () => null,
    focused: () => null,
  })
  const first = holdReferences(implementation())
  createRoot(dispose => {
    const consumer = createDeclared()
    consumer.want(["first"])
    expect(consumer.named("first")).toBe("first")
    expect(consumer.title("first")).toBe("Title of first")
    expect(scopes).toBe(1)
    first()
    expect(consumer.named("first")).toBeNull()
    expect(consumer.title("first")).toBeNull()
    expect(released).toBe(1)
    const second = holdReferences(implementation())
    expect(consumer.named("first")).toBeNull()
    expect(consumer.title("first")).toBeNull()
    expect(scopes).toBe(2)
    consumer.want(["next"])
    expect(consumer.named("next")).toBe("next")
    expect(consumer.title("next")).toBe("Title of next")
    first()
    expect(consumer.named("next")).toBe("next")
    expect(consumer.title("next")).toBe("Title of next")
    second()
    expect(released).toBe(2)
    dispose()
  })
})
