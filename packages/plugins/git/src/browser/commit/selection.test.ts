/**
 * What a piecemeal commit is going to name — the one piece of the panel that is
 * an argument rather than a layout.
 *
 * Three properties are worth holding here, and each is a way the panel could
 * lie about what pressing the button will do:
 *
 *   - everything is ticked by default, INCLUDING a file that arrives while the
 *     panel is open. What is stored is the exception, so the sweep the server
 *     recomputes every thirty seconds cannot quietly leave a new file out.
 *   - a full selection is `undefined` rather than the list. Those commit the
 *     same files and mean different things to the server: only the first is a
 *     full sweep, which is what clears the per-writer counters.
 *   - the message is composed from what is TICKED, by the same function the
 *     server composes with — so unticking a file rewrites the suggestion and
 *     the two faces cannot word one commit differently.
 */

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

/** One selection over a pending value a test can move. Rooted, because the
 *  memos inside are Solid's and a disposed root is what a component's lifetime
 *  is. */
const over = <A>(
  value: Pending,
  use: (
    selection: ReturnType<typeof createSelection>,
    set: (next: Pending) => void,
  ) => A,
): A =>
  createRoot((dispose) => {
    const [pending, setPending] = createSignal(value)
    const answer = use(createSelection(pending), setPending)
    dispose()
    return answer
  })

test("everything is ticked, and a full selection is no selection at all", () => {
  over(WAITING, (selection) => {
    expect(selection.ticked("docs/roadmap.olai")).toBe(true)
    expect(selection.ticked("README.md")).toBe(true)
    // `undefined`, not the list of all three: the server reads an omitted
    // selection as the full sweep it is.
    expect(selection.paths()).toBeUndefined()
    expect(selection.changes()).toHaveLength(1)
    expect(selection.others()).toHaveLength(2)
  })
})

test("unticking a file drops it, its node changes, and its name from the message", () => {
  over(WAITING, (selection) => {
    selection.toggle("docs/roadmap.olai")

    expect(selection.paths()).toEqual(["README.md", "notes/todo.md"])
    // An outline's node changes travel WITH it: a partial `.olai` write is not
    // a thing that exists, so a half-committed outline is not a thing to offer.
    expect(selection.changes()).toEqual([])
    expect(selection.message()).not.toContain("Kolu integration")
    expect(selection.message()).toContain("README.md")

    selection.toggle("README.md")
    expect(selection.paths()).toEqual(["notes/todo.md"])
    expect(selection.message()).not.toContain("README.md")
    expect(selection.message()).toContain("notes/todo.md")
  })
})

test("unticking everything is an empty selection, which is not the same as no selection", () => {
  over(WAITING, (selection) => {
    for (const path of ["docs/roadmap.olai", "README.md", "notes/todo.md"]) {
      selection.toggle(path)
    }
    // Empty rather than `undefined`: the panel reads this as a button with
    // nothing to do, where `undefined` would commit everything.
    expect(selection.paths()).toEqual([])
    expect(selection.message()).toBe("olai: nothing")
  })
})

/**
 * A file that arrives while the panel is open arrives TICKED.
 *
 * The server recomputes what is waiting on a timer of its own, so this is not a
 * rare case — it is what happens whenever somebody saves a file with the panel
 * up. Storing the ticks rather than the exceptions would have left the new file
 * out of a commit the button says is sweeping everything.
 */
test("a file that arrives while the panel is open is ticked", () => {
  over(WAITING, (selection, set) => {
    selection.toggle("README.md")
    set({
      ...WAITING,
      others: [...WAITING.others, { path: "later.md", how: "untracked", from: null }],
    })

    expect(selection.ticked("later.md")).toBe(true)
    // ... and the one somebody unticked STAYS unticked.
    expect(selection.ticked("README.md")).toBe(false)
    expect(selection.paths()).toEqual(["docs/roadmap.olai", "notes/todo.md", "later.md"])
  })
})
