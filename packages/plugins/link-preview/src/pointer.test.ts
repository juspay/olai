import { expect, test } from "bun:test"
import { pointerEdges } from "./pointer.ts"
import { matchPreview } from "./matching.ts"

test("movement within one link does not rerun renderer matching", () => {
  let matches = 0
  const entries = [{ owner: "test", value: { priority: 0, matches: () => { matches++; return true }, Preview: () => null } }]
  const edges = pointerEdges(() => matchPreview(entries, { kind: "at", address: null }))
  const target = new EventTarget()
  edges.over({ target, clientX: 10, clientY: 10 })
  for (let clientX = 10; clientX < 100; clientX++) edges.move({ target, clientX, clientY: 10 })
  expect(matches).toBe(1)
  const replacement = new EventTarget()
  edges.over({ target: replacement, clientX: 99, clientY: 10 })
  expect(matches).toBe(1)
  edges.move({ target: replacement, clientX: 100, clientY: 10 })
  edges.move({ target: replacement, clientX: 101, clientY: 10 })
  expect(matches).toBe(2)
})
