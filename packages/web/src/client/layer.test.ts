/**
 * The stacking plan's three claims (`./layer.ts`).
 *
 * A layering bug is the hardest kind of thing to test in a browser: it is one
 * box being drawn behind another, in one viewport, in one state, and a
 * scenario that did not think to look at that pair passes happily. So what is
 * checked here is the TABLE — that its order is the order it claims, that its
 * two bands cannot be confused for one another, and that it is the only place
 * in the client where a `z-index` is decided at all. The third is the one that
 * matters most: the numbers were never wrong before this file, they were
 * merely spread over twenty call sites, and nothing but a scan stops them from
 * spreading back.
 */

import { expect, test } from "bun:test"
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { LAYER, WITHIN } from "./layer.ts"

/** The number a Tailwind `z-*` utility sets, in the two spellings this table
 *  uses: `z-30` and the arbitrary `z-[45]`. Reading it back out is what makes
 *  the claims below claims about the CSS rather than about field order. */
const rank = (utility: string): number => {
  const found = /^z-(?:\[(\d+)\]|(\d+))$/.exec(utility)
  if (found === null) throw new Error(`\`${utility}\` is not a z-index utility`)
  return Number(found[1] ?? found[2])
}

test("the page's stack climbs in the order the table is written", () => {
  // The fields are the design, so the file reads top-to-bottom as
  // bottom-to-top of the page — a layer inserted in the wrong place, or a
  // number edited without moving the field, fails here rather than as a panel
  // behind a scrim in one viewport nobody screenshotted.
  const climbed = Object.values(LAYER).map(rank)
  expect(climbed).toEqual([...climbed].sort((a, b) => a - b))
  expect(new Set(climbed).size).toBe(climbed.length)
})

test("...and so does the band inside a box", () => {
  const climbed = Object.values(WITHIN).map(rank)
  expect(climbed).toEqual([...climbed].sort((a, b) => a - b))
  expect(new Set(climbed).size).toBe(climbed.length)
})

test("the two bands do not overlap, so the number says which question it answers", () => {
  // The whole reason `WITHIN` is single digits. `chat/Sessions.tsx` used to
  // draw its dropdown at the command palette's own `z-50` while meaning
  // something sealed inside a panel three layers down; nothing was broken and
  // nothing could be read either.
  const inside = Object.values(WITHIN).map(rank)
  const page = Object.values(LAYER).map(rank)
  expect(Math.max(...inside)).toBeLessThan(Math.min(...page))
})

test("no client file outside this module spells a z-index of its own", () => {
  // The claim that keeps the plan from becoming the twenty-first place to
  // look. Every `z-*` utility in the client comes from the table, so a new
  // surface has to answer "what does this cover" by picking a name — which is
  // the question, and which a bare number lets a person skip.
  //
  // PROSE is exempt (`z-[45]` is quoted in the header's own docstring, where
  // naming the layer would be less clear, not more): the scan reads code, so
  // it takes the line's comment off first.
  const allowed = new Set(["layer.ts", "layer.test.ts"])
  const client = import.meta.dir
  const offenders: Array<string> = []
  for (const entry of readdirSync(client, { recursive: true })) {
    const path = String(entry)
    if (!/\.(ts|tsx)$/.test(path) || allowed.has(path)) continue
    const code = readFileSync(join(client, path), "utf8")
      .split("\n")
      .map((line) => line.replace(/\/\/.*$|^\s*\*.*$|\/\*.*$/, ""))
      .join("\n")
    // Word-bounded on both ends so a bare layer utility is a hit and
    // `size-10` is not. Written without an example on purpose: Tailwind scans
    // this directory including its tests, so a utility quoted in a comment
    // here is a rule emitted into the bundle for nothing.
    if (/(?:^|[\s"'`])z-(?:\[\d+\]|\d+|auto)(?=$|[\s"'`])/m.test(code)) offenders.push(path)
  }
  expect(offenders).toEqual([])
})
