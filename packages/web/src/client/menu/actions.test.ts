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
 *
 * The two CLIPBOARD verbs are here for the same question asked the other way
 * round: they are the entries that must NOT answer with nothing, since their
 * destination is outside the app and a copy leaves no trace on the page. What
 * they say is a fact about `run`, so it is held here rather than only in the
 * browser — `features/menu_verbs.feature` walks the same two verbs end to end.
 *
 * The WRITE arm is stubbed at `applying`, not fire-and-forget on the live
 * wire: a real `edit.apply` never settles here (`wire.ts` dials
 * `olai.invalid` and retries forever), and a promise left hanging is a retry
 * fiber still running while later tests in this file — and every later file
 * in bun's one shared process — run.
 */

import { derive, rowsOf, type Row } from "@olai/format"
import { recordsOf, setOf } from "@olai/format/testlib"
import { NO_PINS } from "@olai/surface"
import { expect, spyOn, test } from "bun:test"

import type { Relation } from "../edges/relation.ts"
import { flatten } from "../edit/order.ts"
import * as writes from "../writes.ts"
import { nodeMenuActions } from "./actions.ts"

const HOUSE = [
  `{"id":"kitchen","ord":"a0","title":"kitchen remodel","doing":true}`,
  `{"id":"install","parent":"kitchen","ord":"a1","title":"install them"}`,
  `{"id":"echo","ord":"a2","mirror":"install"}`,
].join("\n")

const derived = derive(recordsOf(setOf({ "house.olai": HOUSE })))

const row = (id: string): Row => {
  const found = flatten(rowsOf(derived, "house.olai"), new Set())
    .find((one) => one.at.node.id === id)
  if (found === undefined) throw new Error(`no row for \`${id}\` in the fixture`)
  return found
}

/** The catalog, over a row, with the impure half stubbed — and both openers
 *  answering with a value, which is what a `setPicking(true)` does. */
const actionsFor = (
  id: string,
  opens: (relation?: Relation) => unknown,
) =>
  nodeMenuActions({
    row: row(id),
    pins: NO_PINS,
    collapsed: false,
    foldable: [],
    go: () => {},
    record: () => {},
    // The lie: a setter answers with the new value, and this is what the
    // catalog does with it.
    pickDate: opens as () => void,
    // …and for the repeat picker, which is the fourth.
    pickRepeat: opens as () => void,
    // The same lie for the two edge verbs, which open the same kind of panel
    // — `setLinking("see")` answers with `"see"`, a perfectly truthy value the
    // panel would have drawn as a sentence.
    pickEdge: opens as (relation: Relation) => void,
    // And once more for the ADD-A-PROPERTY entry, which opens no panel at all
    // any more — it opens the chip run's own editor — but is the same chance to
    // hand the `•••` line whatever the opener happened to return.
    addProp: opens,
    // …and the fifth panel a menu entry opens, which is the move-to picker.
    pickMove: opens as () => void,
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

test("an edge verb says nothing either, and names the relation it opens", () => {
  // The same regression one arm over: `pickEdge` is a setter too, and the arm
  // that calls it must not hand the panel the relation it just stored.
  expect(entry("install", "Link to a node…").run()).toBeUndefined()
  let asked: Relation | undefined
  const actions = actionsFor("install", (relation) => {
    asked = relation as Relation
    return relation
  })
  actions.find((one) => one.label === "Wait for a node…")?.run()
  expect(asked).toBe("after")
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

test("a verb that WRITES still answers with a promise the panel can read", async () => {
  // The other arm of `Does`, so the block above cannot be "return nothing,
  // always": a mark goes to the write gate, and what it answers with is what
  // the panel puts beside the `•••`.
  //
  // `applying` is the event `run` actually waits on. A real write against
  // this process's dead wire never settles, and fire-and-forget left that
  // RPC in flight for whichever test bun ran next. Stubbed, `await` is
  // waiting on the write landing, not on time.
  const applying = spyOn(writes, "applying").mockImplementation(async () => ({
    tone: "aside",
    text: "kitchen remodel is done",
  }))
  try {
    const answer = entry("install", "Mark todo").run()
    expect(answer).toBeInstanceOf(Promise)
    expect(await answer).toEqual({
      tone: "aside",
      text: "kitchen remodel is done",
    })
  } finally {
    applying.mockRestore()
  }
})

/** The catalog run against a clipboard of the test's own. Node has none at
 *  all, and the two copy verbs are the only thing in here that reaches for
 *  one — restored afterwards, because a global left patched is a failure in
 *  whichever file `bun test` happens to run next.
 *
 *  ONLY `clipboard` is installed. Replacing the whole `navigator` was a
 *  second sharing: bun's one process keeps one Navigator, and a
 *  `{ clipboard }`-only object is a different global for every later file
 *  that still needs `userAgent` or `platform`. */
const withClipboard = async <T>(
  clipboard: { readonly writeText: (text: string) => Promise<void> },
  run: () => Promise<T>,
): Promise<T> => {
  const nav = globalThis.navigator
  const had = Object.getOwnPropertyDescriptor(nav, "clipboard")
  Object.defineProperty(nav, "clipboard", {
    configurable: true,
    enumerable: true,
    value: clipboard,
  })
  try {
    return await run()
  } finally {
    if (had === undefined) Reflect.deleteProperty(nav, "clipboard")
    else Object.defineProperty(nav, "clipboard", had)
  }
}

test("a copy that LANDED answers with a remark, so the ordinary case is not silent", async () => {
  // The clipboard is the one destination OUTSIDE this app: nothing in the
  // outline changes, so a copy that worked and one that never happened draw
  // the same page. The refusal already spoke; this is the other half, and it
  // is `aside` rather than `alarm` because it is news rather than a reason
  // nothing happened.
  const written: string[] = []
  const answers = await withClipboard(
    { writeText: (text) => (written.push(text), Promise.resolve()) },
    async () => ({
      link: await entry("install", "Copy link to node").run(),
      text: await entry("install", "Copy as text").run(),
    }),
  )
  expect(answers.link).toEqual({ tone: "aside", text: "link copied" })
  expect(answers.text).toEqual({ tone: "aside", text: "text copied" })
  // ...and each sentence is a report rather than an assumption: both reached
  // the clipboard before either of them said anything.
  expect(written).toHaveLength(2)
})

test("a copy the browser REFUSED answers with no remark at all — it throws", async () => {
  // The rule `actions.ts` is written to: nothing there catches a clipboard
  // denial, so a `run` that resolved with the remark anyway would be exactly
  // the swallowed failure this seam was fixed for — and the remark being added
  // beside it is when that could regress.
  const thrown = await withClipboard(
    { writeText: () => Promise.reject(new Error("denied")) },
    async () => {
      try {
        await entry("install", "Copy link to node").run()
        return null
      } catch (cause) {
        return cause as Error
      }
    },
  )
  // `null` would be the regression, and it is the one worth naming: a `run`
  // that RESOLVED here resolved with the remark, and the menu would draw
  // "link copied" over a clipboard that had refused.
  expect(thrown?.message).toBe("denied")
})

// TWO `Ask agent` CASES STOOD HERE — that it armed the composer with the node
// the row SHOWS rather than the record standing there, and that it opened the
// panel the chip lands in — and both have moved with their subject. The verb is
// `olai-plugin-chat`'s browser half now, hung in `outline.row.action`, and the
// arming and the opening are that plugin's to test.
//
// WHICH ID A PRESS IS HANDED did not move, and is what the deletion is safe
// against: the walk at the bottom of `./actions.ts` spends the mirror rule ONCE
// for every plugin's verb (`../fold/rows.ts`'s `foldIdOf`), so a tenant cannot
// get it wrong by not knowing the distinction exists — which is a stronger
// guarantee than the case above was, since it holds for verbs nobody has
// written yet. A case for it here would have to register into the slot from a
// unit process that mounts no plugins at all.
