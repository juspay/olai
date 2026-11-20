import { declarationsOf, NO_KINDS } from "@olai/format"
import { readingOf, setOf } from "@olai/format/testlib"
import { expect, test } from "bun:test"

import { claimantsIn } from "./claimants.ts"
import { ownKinds, TERMINAL_TYPE } from "./kinds.ts"

const rec = (id: string, title: string, custom?: Record<string, string>): string =>
  `{"id":${JSON.stringify(id)},"ord":"a0","title":${JSON.stringify(title)}${
    custom === undefined ? "" : `,"custom":${JSON.stringify(custom)}`
  }}`

const declaring = (type: string, key = "terminal"): string =>
  rec(`prop-${key}`, key, { type })

const claimantsOf = (files: Record<string, string>) => {
  const at = readingOf(setOf(files)).derived
  return [...claimantsIn(declarationsOf(at, ownKinds), at.nodes)]
}

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
  expect(
    claimantsOf({ "lanes.olai": rec("step", "implement", { [TERMINAL_TYPE]: "11111111" }) }),
  ).toEqual([{ id: "step", title: "implement", file: "lanes.olai", terminal: "11111111" }])
})

test("...and a PERSON'S OWN `terminal` column is never captured by enabling a plugin", () => {
  expect(
    claimantsOf({ "lanes.olai": rec("step", "implement", { terminal: "11111111" }) }),
  ).toEqual([])
})

test("...and the SHORT key is one vault row away — the user's key, the plugin's kind", () => {
  expect(
    claimantsOf({
      "_olai/Properties.olai": declaring(TERMINAL_TYPE, "terminal"),
      "lanes.olai": rec("step", "implement", { terminal: "11111111" }),
    }),
  ).toEqual([{ id: "step", title: "implement", file: "lanes.olai", terminal: "11111111" }])
})

test("...and a serve that did not compose kolu is byte-identical to an undeclared key", () => {
  expect(
    withoutKolu({ "lanes.olai": rec("step", "implement", { [TERMINAL_TYPE]: "11111111" }) }),
  ).toEqual([])
})

test("A VAULT ROW WINS over the claim, including a row that takes the door away", () => {
  expect(
    claimantsOf({
      "_olai/Properties.olai": declaring("text", TERMINAL_TYPE),
      "lanes.olai": rec("step", "implement", { [TERMINAL_TYPE]: "11111111" }),
    }),
  ).toEqual([])
})

test("a key called anything at all is a terminal if the vault declares it one", () => {
  expect(
    claimantsOf({
      "_olai/Properties.olai": declaring(TERMINAL_TYPE, "pty"),
      "lanes.olai": rec("step", "implement", { pty: "22222222", terminal: "decoy" }),
    }),
  ).toEqual([{ id: "step", title: "implement", file: "lanes.olai", terminal: "22222222" }])
})

test("a MIRROR is skipped — its target carries the property and is in the same walk", () => {
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
