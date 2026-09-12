import { expect, test } from "bun:test"
import { Effect } from "effect"
import { createRoot, createSignal } from "solid-js"
import type { Directory } from "olai-plugin-vault/file-state"
import { createOutlineDiff } from "./outline.ts"
const turn = () => new Promise(resolve => setTimeout(resolve, 0))

test("the browser diff draws unreadable after vault withdrawal and cancels the retired request", async () => {
  let cancelled = 0
  const [vault, setVault] = createSignal<Pick<Directory, "outlineDiff"> | undefined>({ outlineDiff: () => Effect.onInterrupt(Effect.never, () => Effect.sync(() => { cancelled++ })) })
  const view = createRoot(dispose => ({ dispose, ...createOutlineDiff(vault, () => ({ path: "a.olai", oldText: null, newText: "new bytes" })) }))
  await turn()
  expect(view.line()).toBe("reading outline changes…")
  setVault(undefined)
  await turn()
  expect(cancelled).toBe(1)
  expect(view.read()).toBeUndefined()
  expect(view.line()).toBe("the outline is unreadable, so what changed in it cannot be told")
  setVault({ outlineDiff: () => Effect.succeed({ _tag: "Changes" as const, changes: [] }) })
  await turn()
  expect(view.read()).toEqual({ _tag: "Changes", changes: [] })
  view.dispose()
})

test("a disposed browser diff cancels its request and an absent vault never throws", async () => {
  let cancelled = 0
  const view = createRoot(dispose => ({ dispose, ...createOutlineDiff(() => ({ outlineDiff: () => Effect.onInterrupt(Effect.never, () => Effect.sync(() => { cancelled++ })) }), () => ({ path: "a.olai", oldText: null, newText: "" })) }))
  await turn(); view.dispose(); await turn()
  expect(cancelled).toBe(1)
  createRoot(dispose => {
    const absent = createOutlineDiff(() => undefined, () => ({ path: "a.olai", oldText: null, newText: "" }))
    // Effects settle as the root returns, so read on the following microtask.
    queueMicrotask(() => { expect(absent.line()).toContain("unreadable"); dispose() })
  })
  await turn()
})
