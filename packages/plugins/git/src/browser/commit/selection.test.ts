import { TEST_CLAIMS } from "@olai/format/testlib"
import type { Pending } from "@olai/format"
import { NOTHING_PENDING } from "@olai/format"
import { expect, test } from "bun:test"
import { createRoot, createSignal } from "solid-js"

import { createSelection } from "./selection.ts"

const WAITING: Pending = {
  ...NOTHING_PENDING,
  repo: { _tag: "Ready", branch: "main" },
  outlines: [
    { file: "roadmap.olai", path: "docs/roadmap.olai", how: "modified", from: null },
  ],
  changes: [{
    file: "roadmap.olai",
    id: "kolu",
    title: "Kolu integration",
    fields: ["done"],
    sort: "done",
  }],
  others: [
    { path: "README.md", how: "modified", from: null },
    { path: "notes/todo.md", how: "untracked", from: null },
  ],
  served: "docs/",
}

const over = <A>(
  value: Pending,
  use: (
    selection: ReturnType<typeof createSelection>,
    set: (next: Pending) => void,
  ) => A,
): A =>
  createRoot((dispose) => {
    const [pending, setPending] = createSignal(value)
    const answer = use(createSelection(() => TEST_CLAIMS, pending), setPending)
    dispose()
    return answer
  })

test("everything is ticked, and a full selection is no selection at all", () => {
  over(WAITING, (selection) => {
    expect(selection.ticked("docs/roadmap.olai")).toBe(true)
    expect(selection.ticked("README.md")).toBe(true)
    expect(selection.paths()).toEqual({ _tag: "FullSweep" })
    expect(selection.changes()).toHaveLength(1)
    expect(selection.others()).toHaveLength(2)
  })
})

test("unticking a file drops it, its node changes, and its name from the message", () => {
  over(WAITING, (selection) => {
    selection.toggle("docs/roadmap.olai")

    expect(selection.paths()).toEqual({ _tag: "Subset", paths: ["README.md", "notes/todo.md"] })
    expect(selection.changes()).toEqual([])
    expect(selection.message()).not.toContain("Kolu integration")
    expect(selection.message()).toContain("README.md")

    selection.toggle("README.md")
    expect(selection.paths()).toEqual({ _tag: "Subset", paths: ["notes/todo.md"] })
    expect(selection.message()).not.toContain("README.md")
    expect(selection.message()).toContain("notes/todo.md")
  })
})

test("unticking everything is an empty selection, which is not the same as no selection", () => {
  over(WAITING, (selection) => {
    for (const path of ["docs/roadmap.olai", "README.md", "notes/todo.md"]) {
      selection.toggle(path)
    }
    expect(selection.paths()).toEqual({ _tag: "Subset", paths: [] })
    expect(selection.message()).toBe("olai: nothing")
  })
})

test("a file that arrives while the panel is open is ticked", () => {
  over(WAITING, (selection, set) => {
    selection.toggle("README.md")
    set({
      ...WAITING,
      others: [...WAITING.others, { path: "later.md", how: "untracked", from: null }],
    })

    expect(selection.ticked("later.md")).toBe(true)
    expect(selection.ticked("README.md")).toBe(false)
    expect(selection.paths())
      .toEqual({ _tag: "Subset", paths: ["docs/roadmap.olai", "notes/todo.md", "later.md"] })
  })
})
