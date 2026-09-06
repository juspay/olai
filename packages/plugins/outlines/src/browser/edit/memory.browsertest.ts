import { expect, test } from "bun:test"
import { clearEditorMemory, editorMemory } from "./memory.ts"

test("departed outline activation cannot send an already queued edit or a removal blur", async () => {
  const old = editorMemory()
  let release!: () => void
  const held = new Promise<void>(resolve => { release = resolve })
  const writes: string[] = []
  old.enqueue(() => held)
  await Promise.resolve()
  old.enqueue(() => writes.push("queued"))
  clearEditorMemory()
  old.enqueue(() => writes.push("removal blur"))
  release()
  await new Promise(resolve => setTimeout(resolve, 0))
  expect(writes).toEqual([])
  const fresh = editorMemory()
  fresh.enqueue(() => writes.push("fresh"))
  await new Promise(resolve => setTimeout(resolve, 0))
  expect(writes).toEqual(["fresh"])
})
