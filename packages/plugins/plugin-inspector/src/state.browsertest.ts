import { expect, test } from "bun:test"
import { createEffect, createRoot } from "solid-js"
import { createInspectorState } from "./state.ts"

test("one inspector row changes without notifying another row's readers", () => {
  const runs = { a: 0, b: 0 }
  const owner = createRoot(dispose => {
    const state = createInspectorState()
    for (const name of ["a", "b"] as const) createEffect(() => {
      state.read().get(name)
      state.opened()[name]
      state.expanded()[name]
      runs[name]++
    })
    return { state, dispose }
  })
  try {
    expect(runs).toEqual({ a: 1, b: 1 })
    owner.state.nowRead("a", "source-v2")
    owner.state.setGroupOpen("a", true)
    owner.state.setExpanded("a", true)
    expect(runs).toEqual({ a: 4, b: 1 })
    owner.state.setExpanded("a", true)
    expect(runs.a).toBe(4)
  } finally { owner.state.close(); owner.dispose() }
})
