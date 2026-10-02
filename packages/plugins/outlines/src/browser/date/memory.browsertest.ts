import { expect, test } from "bun:test"
import { createComponent, createRoot, getOwner, runWithOwner } from "solid-js"
import { RowForms, useRowForms, type RowForm } from "./memory.tsx"

test("an outgoing row cannot discard a replacement row's forms", async () => {
  let first!: RowForm, replacement!: RowForm, current!: RowForm
  let releaseFirst = () => {}, releaseReplacement = () => {}
  let acquire!: () => RowForm
  const dispose = createRoot(dispose => {
    createComponent(RowForms, { get children() {
      first = createRoot(stop => { releaseFirst = stop; return useRowForms("row") })
      releaseFirst()
      replacement = createRoot(stop => { releaseReplacement = stop; return useRowForms("row") })
      // This closure enters the provider owner, as a later row mount would.
      const owner = requireOwner()
      acquire = () => runWithOwner(owner, () => createRoot(stop => {
        current = useRowForms("row")
        stop()
        return current
      }))!
      return null
    } })
    return dispose
  })
  try {
    expect(replacement).toBe(first)
    await Promise.resolve()
    expect(acquire()).toBe(first)
    releaseReplacement()
    await Promise.resolve()
    expect(acquire()).not.toBe(first)
  } finally { dispose() }
})

const requireOwner = () => {
  const owner = getOwner()
  if (!owner) throw new Error("provider owner missing")
  return owner
}
