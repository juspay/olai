import { describe, expect, test } from "bun:test"
import type { AgentItem } from "@olai/format"

import { lostOf, type WasTied } from "./lost.ts"

const NOTE: AgentItem = { kind: "note", path: "notes/plan.md" }
const NODE: AgentItem = { kind: "node", id: "install" }
const WAS: WasTied = { agent: "claude", session: "sess-1" }

describe("a note a chat page has lost", () => {
  test("a note the directory does not hold is gone", () => {
    expect(lostOf({ item: NOTE, standing: "loaded", held: false, tied: true, was: WAS }))
      .toEqual({ kind: "gone" })
    expect(lostOf({ item: NOTE, standing: "loaded", held: false, tied: false, was: null }))
      .toEqual({ kind: "gone" })
  })

  test("a held note with no tie, read by a pane that was reading one, is untied", () => {
    expect(lostOf({ item: NOTE, standing: "loaded", held: true, tied: false, was: WAS }))
      .toEqual({ kind: "untied", was: WAS, path: "notes/plan.md" })
  })

  test("a note that still names its chat has lost nothing", () => {
    expect(lostOf({ item: NOTE, standing: "loaded", held: true, tied: true, was: WAS })).toBeNull()
  })

  test("a note nobody has chatted about in this pane keeps its door", () => {
    expect(lostOf({ item: NOTE, standing: "loaded", held: true, tied: false, was: null })).toBeNull()
  })

  test("nothing is said before the directory has spoken", () => {
    for (const standing of ["reading", undefined] as const) {
      expect(lostOf({ item: NOTE, standing, held: false, tied: false, was: WAS })).toBeNull()
    }
  })

  test("a directory that never loaded says nothing either", () => {
    expect(lostOf({ item: NOTE, standing: "never", held: false, tied: false, was: WAS })).toBeNull()
  })

  test("a node is not asked", () => {
    expect(lostOf({ item: NODE, standing: "loaded", held: false, tied: false, was: WAS })).toBeNull()
  })
})
