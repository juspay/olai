import { declarationsOf } from "@olai/format"
import { readingOf, setOf } from "@olai/format/testlib"
import { expect, test } from "bun:test"

import { boardedIn } from "./boarded.ts"
import { ownKinds, RUN_TYPE } from "./kinds.ts"

const rec = (id: string, title: string, fields: Record<string, string> = {}): string =>
  `{"id":${JSON.stringify(id)},"ord":"a0","title":${JSON.stringify(title)}${
    Object.keys(fields).length === 0 ? "" : `,"custom":${JSON.stringify(fields)}`
  }}`

const declaring = (type = RUN_TYPE, key = "run"): string =>
  rec(`prop-${key}`, key, { type })

const vault = (files: Record<string, string>) => readingOf(setOf(files)).derived

test("an enabled odu claims odu-run with nothing declared", () => {
  const derived = vault({
    "board.olai": rec("node-a", "the seam", { "odu-run": "m1kb0e11-2c8d" }),
  })
  expect([...boardedIn(derived)].map((one) => one.id)).toEqual(["m1kb0e11-2c8d"])
})

test("first writer wins among two nodes naming one run", () => {
  const derived = vault({
    "_olai/Properties.olai": declaring(),
    "board.olai": [
      rec("node-a", "first", { run: "m1kb0e11-2c8d" }),
      rec("node-b", "second", { run: "m1kb0e11-2c8d" }),
    ].join("\n"),
  })
  expect([...boardedIn(derived)].map((one) => one.node)).toEqual(["node-a"])
})

test("a vault that declared odu-run as text boards nothing", () => {
  const derived = vault({
    "_olai/Properties.olai": rec("prop-run", "odu-run", { type: "text" }),
    "board.olai": rec("node-a", "the seam", { "odu-run": "m1kb0e11-2c8d" }),
  })
  expect([...boardedIn(derived)]).toEqual([])
  expect(declarationsOf(derived, ownKinds)).toBeTruthy()
})
