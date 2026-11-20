import { TEST_CLAIMS } from "@olai/format/testlib"
import { derive, type Derived } from "./derive.ts"
import { matching, parseFilter, type Scope } from "./filter.ts"
import { median, timed } from "./fixtures.testlib.ts"
import type { Located } from "./node.ts"
import { referenceMatching } from "./scope.testlib.ts"

const FILES = 200
const PER_FILE = 100
const FANOUT = 4

const NOW = "2026-08-13T11:00:00-04:00"

const ASKED = ["kitchen", "walnut", `"a note about"`, "kitchen OR garden", "is:todo"]

const vault = (): ReadonlyArray<Located> => {
  const records: Array<Located> = []
  for (let file = 0; file < FILES; file++) {
    const path = `vault/${file}.olai`
    for (let which = 0; which < PER_FILE; which++) {
      const id = `n${file}-${which}`
      records.push({
        file: path,
        line: which + 1,
        node: {
          id,
          ord: `a${which}`,
          ...(which === 0 ? {} : { parent: `n${file}-${Math.floor((which - 1) / FANOUT)}` }),
          title: `the ${which % 3 === 0 ? "kitchen" : "garden"} job number ${which} #home`,
          ...(which % 4 === 0 ? { desc: `a note about walnut and the budget ${which}` } : {}),
          ...(which % 5 === 0 ? { todo: true } : {}),
        },
      } as Located)
    }
  }
  return records
}

const set: Derived = derive(TEST_CLAIMS, vault())

const asking = (
  matched: typeof matching,
  scope: Scope,
): (() => void) =>
() => {
  for (const text of ASKED) matched(set, parseFilter(text, NOW), scope)
}

const runs = (arm: () => void): number => {
  arm()
  return median(Array.from({ length: 5 }, () => timed(arm)))
}

const SCOPES: ReadonlyArray<readonly [string, Scope]> = [
  ["file: one of 200", { file: `vault/${Math.floor(FILES / 3)}.olai` }],
  ["under: a file's root", { under: `n${Math.floor(FILES / 3)}-0` }],
  ["under: a small subtree", { under: `n${Math.floor(FILES / 3)}-20` }],
  ["(no scope — control)", {}],
]

console.log(
  `${FILES * PER_FILE} records, ${FILES} files, ${ASKED.length} queries per arm`,
)
console.log(
  `${"scope".padEnd(24)}${"before".padStart(10)}${"after".padStart(10)}${"".padStart(4)}ratio` +
    `${"selected".padStart(11)}`,
)
for (const [what, scope] of SCOPES) {
  const before = runs(asking(referenceMatching, scope))
  const after = runs(asking(matching, scope))
  const selected = ASKED.reduce(
    (count, text) => count + matching(set, parseFilter(text, NOW), scope).length,
    0,
  )
  const walked = ASKED.reduce(
    (count, text) => count + referenceMatching(set, parseFilter(text, NOW), scope).length,
    0,
  )
  if (selected !== walked) {
    throw new Error(
      `${what}: the two arms are not answering the same question — ` +
        `the narrowing selected ${selected} records and the walk ${walked}. ` +
        `The ratio above it is meaningless until they agree (./scope.test.ts).`,
    )
  }
  console.log(
    `${what.padEnd(24)}${`${before.toFixed(1)}ms`.padStart(10)}` +
      `${`${after.toFixed(1)}ms`.padStart(10)}` +
      `${`${(before / after).toFixed(1)}×`.padStart(9)}` +
      `${`${selected}`.padStart(11)}`,
  )
}
