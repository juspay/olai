/** Contribution work follows the location and leaves with its activation,
 * regardless of how many file glyphs ask for a drawing. */
import { expect, test } from "bun:test"
import { createSignal } from "solid-js"
import type { Locations } from "@olai/plugin-api/contracts"
import { fileKinds } from "./contract.ts"
import { drawingOf, holdKindDrawings } from "./drawings.ts"

test("glyph lookups share one contribution reading and withdrawal stops it", () => {
  const [revision, setRevision] = createSignal(0)
  let reads = 0
  const read: Locations["read"] = location => {
    expect(location.name).toBe(fileKinds.name)
    revision()
    reads++
    return []
  }
  const stop = holdKindDrawings(read)
  try {
    expect(reads).toBe(1)
    for (let i = 0; i < 100; i++) drawingOf("unclaimed")
    expect(reads).toBe(1)
    setRevision(1)
    expect(reads).toBe(2)
  } finally { stop() }
  setRevision(2)
  drawingOf("unclaimed")
  expect(reads).toBe(2)
  const restart = holdKindDrawings(read)
  try {
    expect(reads).toBe(3)
    setRevision(3)
    expect(reads).toBe(4)
  } finally { restart() }
})
