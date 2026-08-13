/**
 * What RUNNING a menu entry answers with — which is a question about one line
 * of `./actions.ts` and about a bug that has already shipped once.
 *
 * `MenuAction.run` is `() => void | Promise<Said | void>`, and the panel draws
 * whatever it answers with as a sentence beside the `•••`. So an entry that
 * means "nothing to say" has to answer with `undefined` and not merely be
 * WRITTEN as if it did: an expression-bodied arrow calling a Solid setter
 * answers with the setter's new value, `() => void` accepts any return, and the
 * panel drew an empty bordered box under the menu for a moment in this branch
 * because of it (caught in a screenshot, not by a type).
 *
 * The lie this file tells is the point: `pickDate` is handed back a value, the
 * way a setter would. Everything else here is a stub, because the only thing
 * under test is what comes back out.
 */

import { derive, rowsOf, type Row } from "@olai/format"
import { setOf } from "@olai/format/testlib"
import { expect, test } from "bun:test"

import { flatten } from "../edit/order.ts"
import { nodeMenuActions } from "./actions.ts"

const HOUSE = [
  `{"id":"kitchen","ord":"a0","title":"kitchen remodel","doing":true}`,
  `{"id":"install","parent":"kitchen","ord":"a1","title":"install them"}`,
].join("\n")

const derived = derive(setOf({ "house.jsonl": HOUSE }).nodes)

const row = (id: string): Row => {
  const found = flatten(rowsOf(derived, "house.jsonl"), new Set())
    .find((one) => one.at.node.id === id)
  if (found === undefined) throw new Error(`no row for \`${id}\` in the fixture`)
  return found
}

/** The catalog, over a row, with the impure half stubbed — and `pickDate`
 *  answering with a value, which is what a `setPicking(true)` does. */
const actionsFor = (id: string, pickDate: () => unknown) =>
  nodeMenuActions({
    row: row(id),
    derived,
    collapsed: false,
    foldable: [],
    view: {
      collapsed: () => new Set<string>(),
      toggle: () => {},
      collapseAll: () => {},
      expandAll: () => {},
      doneHidden: () => false,
      toggleDone: () => {},
      visible: (rows) => rows,
    },
    go: () => {},
    record: () => {},
    // The lie: a setter answers with the new value, and this is what the
    // catalog does with it.
    pickDate: pickDate as () => void,
  })

const entry = (id: string, label: string) => {
  const found = actionsFor(id, () => true).find((one) => one.label === label)
  if (found === undefined) throw new Error(`\`${id}\` offers no ${JSON.stringify(label)}`)
  return found
}

test("opening the picker says NOTHING, whatever the opener answers with", () => {
  // The regression: `run: () => args.pickDate()` hands the panel `true`, which
  // is not `undefined`, so the panel says it — and a `true` has no `.text`, so
  // what a reader gets is an empty bordered box under the `•••`.
  expect(entry("install", "Set date…").run()).toBeUndefined()
})

test("...and it still opens the picker", () => {
  // The other half, so a `run` that answered `undefined` by doing nothing at
  // all would not pass the test above.
  let opened = 0
  const actions = actionsFor("install", () => {
    opened += 1
    return true
  })
  actions.find((one) => one.label === "Set date…")?.run()
  expect(opened).toBe(1)
})

test("a verb that WRITES still answers with a promise the panel can read", () => {
  // The other arm of `Does`, so the block above cannot be "return nothing,
  // always": a mark goes to the write gate, and what it answers with is what
  // the panel puts beside the `•••`.
  const answer = entry("install", "Mark todo").run()
  expect(answer).toBeInstanceOf(Promise)
  // ...and it is swallowed here, because there is no server behind this test
  // and an unhandled rejection from a write nobody awaited is noise in every
  // other file's run.
  void (answer as Promise<unknown>).catch(() => {})
})
