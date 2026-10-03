import { expect, test } from "bun:test"
import { createRoot, createSignal } from "solid-js"
import { Result } from "effect"
import type { Row } from "@olai/format"
import { row } from "../frame.testlib.ts"
import { createUndo, holdUndo } from "../edit/undoing.ts"
import { createSelection } from "./selection.ts"

test("selection relocates records once per frame and never revives removed endpoints", () => {
  const release = holdUndo(createUndo(async () => Result.succeed({ id: "a", title: "a", file: "house.olai" })))
  let stop = () => {}
  try {
    let walks = 0
    const state = createRoot(dispose => {
      stop = dispose
      const [rows, setRows] = createSignal<ReadonlyArray<Row>>([row("/a", "a", "a"), row("/b", "b", "b")])
      const selection = createSelection({ rows: () => { walks++; return rows() }, collapsed: () => new Set() })
      return { setRows, selection }
    })
    expect(walks).toBe(0)
    state.selection.across(["/a", "/b"], "/a", "/b")
    expect(walks).toBe(1)
    state.setRows([row("/parent/a", "a", "a"), row("/parent/b", "b", "b")])
    expect([...state.selection.keys()]).toEqual(["/parent/a", "/parent/b"])
    expect(state.selection.rows().length).toBe(2)
    expect(walks).toBe(2)
    state.setRows([])
    expect(state.selection.keys().size).toBe(0)
    state.setRows([row("/a", "a", "a"), row("/b", "b", "b")])
    expect(state.selection.keys().size).toBe(0)
    state.selection.grow(1)
    expect(state.selection.keys().size).toBe(0)
    const idle = walks
    state.setRows([row("/c", "c", "c")])
    expect(walks).toBe(idle)
  } finally { stop(); release() }
})
