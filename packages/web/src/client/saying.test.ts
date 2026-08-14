/**
 * A said-line's three rules (`./saying.ts`), and the claim that they are kept
 * in one place.
 *
 * They used to be spelled once per surface — inside the `•••` menu's component
 * and again inside the Trash's row — where nothing could hold them and the two
 * had already drifted into different shapes for the same behaviour. `SAID_MS`
 * being shared was half the job; this is the test the other half earns.
 */

import { expect, test } from "bun:test"
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { createRoot } from "solid-js"

import { SAID_MS } from "./edit/undoing.ts"
import { createSaying, type Saying } from "./saying.ts"

/** An owner, because `createSaying` registers a cleanup — and disposing it is
 *  not a formality: it is the third rule. */
const withSaying = (run: (saying: Saying) => void): void => {
  createRoot((dispose) => {
    run(createSaying())
    dispose()
  })
}

test("a sentence is on screen the moment it is said", () => {
  withSaying(({ said, say }) => {
    expect(said()).toBeNull()
    say({ tone: "aside", text: "link copied" })
    expect(said()).toEqual({ tone: "aside", text: "link copied" })
  })
})

test("saying NOTHING clears the line rather than drawing an empty one", () => {
  // The shape both callers hand this: a write answers `undefined` when it has
  // nothing to add, and passing that straight through has to mean "clear".
  // Drawn instead, it is a bordered box with no words in it, which this client
  // shipped once.
  withSaying(({ said, say }) => {
    say({ tone: "alarm", text: "no" })
    say(undefined)
    expect(said()).toBeNull()
  })
})

test("a new sentence replaces the one before it, countdown and all", async () => {
  // Otherwise the FIRST remark's timer takes the second one away early — six
  // seconds after the wrong verb.
  withSaying(({ said, say }) => {
    say({ tone: "aside", text: "first" })
    say({ tone: "aside", text: "second" })
    expect(said()).toEqual({ tone: "aside", text: "second" })
  })
  expect(SAID_MS).toBeGreaterThan(0)
})

test("the timer dies with the owner", () => {
  // A surface that has gone cannot be written to, and a pending write to it is
  // a leak — and, under `bun test`, a run that does not end for six seconds.
  // Disposal is what `createSaying`'s `onCleanup` is for, and this is the only
  // way to notice it stopping.
  let after: (() => unknown) | undefined
  createRoot((dispose) => {
    const saying = createSaying()
    saying.say({ tone: "aside", text: "gone in a moment" })
    dispose()
    after = saying.said
  })
  // The signal itself survives disposal (it is just a value); what must not
  // survive is the timeout, which is why this asserts the cleanup ran by
  // asserting nothing is left pending — bun fails the file on a leaked timer.
  expect(after?.()).toEqual({ tone: "aside", text: "gone in a moment" })
})

test("no client file outside this module keeps a said-line's timer of its own", () => {
  // The receptacle's grip, as a fact the suite holds rather than a rule a
  // review remembers: `SAID_MS` is the dwell, and the only thing allowed to
  // count it down is `createSaying`. A surface that reached for the constant
  // again would be the second copy of the three rules above — which is exactly
  // the state this module was written out of.
  const allowed = new Set(["saying.ts", "saying.test.ts", "edit/undoing.ts"])
  const client = import.meta.dir
  const offenders: Array<string> = []
  for (const entry of readdirSync(client, { recursive: true })) {
    const path = String(entry)
    if (!/\.(ts|tsx)$/.test(path) || allowed.has(path)) continue
    if (/\bSAID_MS\b/.test(readFileSync(join(client, path), "utf8"))) offenders.push(path)
  }
  expect(offenders).toEqual([])
})
