/**
 * THE PANEL'S HOLD ON THE OUTLINE'S NAMING OF A NODE, across a withdrawal.
 *
 * It was `olai-plugin-outlines`' own bench over a signal in that row's contract
 * door. The value crosses on a service now and the HOLD is this package's, so
 * the claim moved with it — and it is the same claim, plus the one the shape it
 * replaced could not make: what the panel reads is a value its OWN component
 * installed, so a reader in this package is the honest driver.
 *
 * Under the browser condition, because every claim here is about a memo
 * re-running and a scope being released — which a server-resolved Solid does
 * not do at all (`justfile`'s `test` leg argues the split).
 */
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
      return { named: (id: string) => ids().includes(id) ? id : null, told: (id: string) => ids().includes(id) ? id : undefined, want: setIds }
    },
    showNode: () => (_id: string) => {},
    failure: () => null,
    focused: () => null,
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
    // AN OBSOLETE RELEASE CANNOT WITHDRAW THE REPLACEMENT — the identity rule
    // `@olai/ui-primitives`' `heldService` keeps, spent by a real consumer.
    first()
    expect(consumer.named("next")).toBe("next")
    second()
    expect(released).toBe(2)
    dispose()
  })
})
