/**
 * THE DECLARATION LICENCES THE DOOR — the ownership walk's own bench.
 *
 * Every case is `claimantsIn` over a whole vault built out of JSONL the real
 * parser accepts, because the claim under test is about what a vault SAYS: a
 * value is a terminal olai will claim a fleet row with only where the
 * declarations file declares its key a `terminal` — the KIND this plugin
 * contributes ({@link ./kinds.ts}), not the key's NAME.
 *
 * IT USED TO READ THE KEY CALLED `terminal` AND NOTHING ELSE, so a vault that
 * declared nothing still got a door. That is the behaviour these cases pin the
 * end of: the licence is the same one the walk one appliance over already kept
 * (`@olai/plugin-odu`'s `worktrees.ts`), and there is deliberately no fallback
 * to the name beside it.
 */

import { declarationsOf } from "@olai/format"
import { readingOf, setOf } from "@olai/format/testlib"
import { expect, test } from "bun:test"

import { claimantsIn } from "./claimants.ts"

/** One record, as a file writes it. */
const rec = (id: string, title: string, custom?: Record<string, string>): string =>
  `{"id":${JSON.stringify(id)},"ord":"a0","title":${JSON.stringify(title)}${
    custom === undefined ? "" : `,"custom":${JSON.stringify(custom)}`
  }}`

/** The declarations file, saying what a key is — the key NAMED here is
 *  incidental, and two cases below name a different one on purpose. */
const declaring = (type: string, key = "terminal"): string =>
  rec(`prop-${key}`, key, { type })

const claimantsOf = (files: Record<string, string>) => {
  const at = readingOf(setOf(files)).derived
  return [...claimantsIn(declarationsOf(at), at.nodes)]
}

test("a vault that declares the kind yields the nodes carrying it", () => {
  expect(
    claimantsOf({
      "_olai/Properties.olai": declaring("terminal"),
      "lanes.olai": rec("step", "implement", { terminal: "11111111" }),
    }),
  ).toEqual([{ id: "step", title: "implement", file: "lanes.olai", terminal: "11111111" }])
})

test("a vault that declares NOTHING claims nothing, however many terminals it names", () => {
  // THE BEHAVIOUR CHANGE, stated as the case that fails on the old walk: a
  // property called `terminal` is not a terminal, because nobody said it was.
  expect(
    claimantsOf({ "lanes.olai": rec("step", "implement", { terminal: "11111111" }) }),
  ).toEqual([])
})

test("...and neither does one that declares the key something else", () => {
  expect(
    claimantsOf({
      "_olai/Properties.olai": declaring("text"),
      "lanes.olai": rec("step", "implement", { terminal: "11111111" }),
    }),
  ).toEqual([])
})

test("a key called anything at all is a terminal if the vault declares it one", () => {
  // The face follows the DECLARED KIND, so a board whose column is `pty` gets
  // the door and a decoy called `terminal` beside it does not.
  expect(
    claimantsOf({
      "_olai/Properties.olai": declaring("terminal", "pty"),
      "lanes.olai": rec("step", "implement", { pty: "22222222", terminal: "decoy" }),
    }),
  ).toEqual([{ id: "step", title: "implement", file: "lanes.olai", terminal: "22222222" }])
})

test("a MIRROR is skipped — its target carries the property and is in the same walk", () => {
  // A placement holds no properties of its own, so asking it would be asking
  // the wrong record; two rows claiming one terminal would also be two nodes
  // on one fleet row, which the mirror's first-writer-wins rule then resolves.
  expect(
    claimantsOf({
      "_olai/Properties.olai": declaring("terminal"),
      "lanes.olai": [
        rec("step", "implement", { terminal: "11111111" }),
        `{"id":"m","ord":"a1","mirror":"step"}`,
      ].join("\n"),
    }).map((one) => one.id),
  ).toEqual(["step"])
})
