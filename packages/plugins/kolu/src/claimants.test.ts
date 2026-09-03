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
 * (`olai-plugin-odu`'s `worktrees.ts`), and there is deliberately no fallback
 * to the name beside it.
 */

import { declarationsOf, NO_KINDS } from "@olai/format"
import { readingOf, setOf } from "@olai/format/testlib"
import { expect, test } from "bun:test"

import { claimantsIn } from "./claimants.ts"
import { ownKinds, TERMINAL_TYPE } from "./kinds.ts"

/** One record, as a file writes it. */
const rec = (id: string, title: string, custom?: Record<string, string>): string =>
  `{"id":${JSON.stringify(id)},"ord":"a0","title":${JSON.stringify(title)}${
    custom === undefined ? "" : `,"custom":${JSON.stringify(custom)}`
  }}`

/** The declarations file, saying what a key is — the key NAMED here is
 *  incidental, and two cases below name a different one on purpose. */
const declaring = (type: string, key = "terminal"): string =>
  rec(`prop-${key}`, key, { type })

/** The walk, over declarations folded the way the server folds them: this
 *  plugin's own claim underneath, whatever the vault says on top
 *  (`@olai/format`'s `withClaims`). `ownKinds` is what `./server.ts` hands the
 *  same reader, so what these cases measure is what a serve running kolu does. */
const claimantsOf = (files: Record<string, string>) => {
  const at = readingOf(setOf(files)).derived
  return [...claimantsIn(declarationsOf(at, ownKinds), at.nodes)]
}

/** ...and the same walk on a serve that did NOT compose kolu — no kind, so no
 *  claim, so nothing this plugin owns is declared at all. */
const withoutKolu = (files: Record<string, string>) => {
  const at = readingOf(setOf(files)).derived
  return [...claimantsIn(declarationsOf(at, NO_KINDS), at.nodes)]
}

test("a vault that declares the kind yields the nodes carrying it", () => {
  expect(
    claimantsOf({
      "_olai/Properties.olai": declaring(TERMINAL_TYPE),
      "lanes.olai": rec("step", "implement", { terminal: "11111111" }),
    }),
  ).toEqual([{ id: "step", title: "implement", file: "lanes.olai", terminal: "11111111" }])
})

test("a vault that declares NOTHING gets the claim, on the key that carries kolu's name", () => {
  // THE HUMAN'S RULING, as the case that fails without it: a person who enables
  // a plugin must not then hand-write a row in `_olai/Properties.olai` before
  // anything draws. The kind claims the key equal to its own composed word, and
  // a vault that has said nothing about that key is declaring it — with nothing
  // written to that vault, ever.
  expect(
    claimantsOf({ "lanes.olai": rec("step", "implement", { [TERMINAL_TYPE]: "11111111" }) }),
  ).toEqual([{ id: "step", title: "implement", file: "lanes.olai", terminal: "11111111" }])
})

test("...and a PERSON'S OWN `terminal` column is never captured by enabling a plugin", () => {
  // The other half of the ruling, and the reason the word is prefixed at all. A
  // built-in declaration can only ever claim a key carrying the plugin's own
  // name, so a board that has been using `terminal` for something of its own
  // since before kolu existed is untouched by a flag on the machine. Turning a
  // plugin on may add a face; it may not reinterpret somebody's data.
  expect(
    claimantsOf({ "lanes.olai": rec("step", "implement", { terminal: "11111111" }) }),
  ).toEqual([])
})

test("...and the SHORT key is one vault row away — the user's key, the plugin's kind", () => {
  // A board that wants the short column says so, in its own file, and gets the
  // door there. That row is the whole migration, and it is a row somebody writes
  // on purpose rather than one a plugin wrote for them.
  expect(
    claimantsOf({
      "_olai/Properties.olai": declaring(TERMINAL_TYPE, "terminal"),
      "lanes.olai": rec("step", "implement", { terminal: "11111111" }),
    }),
  ).toEqual([{ id: "step", title: "implement", file: "lanes.olai", terminal: "11111111" }])
})

test("...and a serve that did not compose kolu is byte-identical to an undeclared key", () => {
  // ENABLEMENT IS THE ONLY SWITCH. The claim rides the ENABLED vocabulary, so a
  // `--plugins=odu` serve has no kind, no claim, and therefore no declaration —
  // which is exactly the state of a vault that never heard of kolu. Built ≠
  // enabled needed no new rule to say so, and this is the case that proves it.
  expect(
    withoutKolu({ "lanes.olai": rec("step", "implement", { [TERMINAL_TYPE]: "11111111" }) }),
  ).toEqual([])
})

test("A VAULT ROW WINS over the claim, including a row that takes the door away", () => {
  // The precedence, on the claimed key itself: a directory that declares
  // `kolu-terminal` something else has said what it means, and the claim does
  // not argue. A default that overruled the person would be the plugin deciding
  // what somebody's vault holds.
  expect(
    claimantsOf({
      "_olai/Properties.olai": declaring("text", TERMINAL_TYPE),
      "lanes.olai": rec("step", "implement", { [TERMINAL_TYPE]: "11111111" }),
    }),
  ).toEqual([])
})

test("a key called anything at all is a terminal if the vault declares it one", () => {
  // The face follows the DECLARED KIND, so a board whose column is `pty` gets
  // the door and a decoy called `terminal` beside it does not.
  expect(
    claimantsOf({
      "_olai/Properties.olai": declaring(TERMINAL_TYPE, "pty"),
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
      "_olai/Properties.olai": declaring(TERMINAL_TYPE),
      "lanes.olai": [
        rec("step", "implement", { terminal: "11111111" }),
        `{"id":"m","ord":"a1","mirror":"step"}`,
      ].join("\n"),
    }).map((one) => one.id),
  ).toEqual(["step"])
})
