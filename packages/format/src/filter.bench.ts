import { TEST_CLAIMS } from "@olai/format/testlib"
import { derive, type Derived } from "./derive.ts"
import { matching, parseFilter } from "./filter.ts"
import { median, timed } from "./fixtures.testlib.ts"
import type { Located } from "./node.ts"

const NODES = 20_000
const PER_FILE = 200

const TODAY = "2026-08-13"

const NOW = `${TODAY}T11:00:00-04:00`

const TYPED = ["k", "ki", "kit", "kitc", "kitch", "kitche", "kitchen"]

const vault = (): ReadonlyArray<Located> =>
  Array.from({ length: NODES }, (_, at) => ({
    file: `vault/${Math.floor(at / PER_FILE)}.olai`,
    line: (at % PER_FILE) + 1,
    node: {
      id: `n${at}`,
      ord: `a${at}`,
      title: `the ${at % 7 === 0 ? "kitchen" : "garden"} job number ${at} #home`,
      ...(at % 3 === 0
        ? { desc: `a note about brass and the budget, number ${at}` }
        : {}),
      created: `2026-08-${String((at % 14) + 1).padStart(2, "0")}T0${
        at % 10
      }:12:44-04:00`,
      changed: `2026-08-${String((at % 14) + 1).padStart(2, "0")}T1${
        at % 10
      }:02:00-04:00`,
    },
  })) as ReadonlyArray<Located>

const typedOver = (set: Derived): void => {
  for (const query of TYPED) matching(set, parseFilter(query, TODAY))
}

const warm = derive(TEST_CLAIMS, vault())
typedOver(warm)

const cold = Array.from({ length: 5 }, () => {
  const fresh = TYPED.map(() => derive(TEST_CLAIMS, vault()))
  return timed(() => {
    TYPED.forEach((query, at) => {
      matching(fresh[at] as Derived, parseFilter(query, TODAY))
    })
  })
})
const hot = Array.from({ length: 5 }, () => timed(() => typedOver(warm)))

const DATED = ["created:2026-08-07", "changed:this-week", "changed:1h", "created:yesterday..3h"]

const datedOver = (set: Derived): void => {
  for (const query of DATED) matching(set, parseFilter(query, NOW))
}

datedOver(warm)
const dated = Array.from({ length: 5 }, () => timed(() => datedOver(warm)))

const say = (
  what: string,
  runs: ReadonlyArray<number>,
  asked: number,
  each: string,
): void => {
  const ms = median(runs)
  console.log(
    `${what.padEnd(6)} ${ms.toFixed(1)}ms over ${asked} ${each} ` +
      `— ${(ms / asked).toFixed(2)}ms each`,
  )
}

console.log(`${NODES} nodes, ${Math.ceil(NODES / PER_FILE)} files`)
say("cold", cold, TYPED.length, "keystrokes")
say("warm", hot, TYPED.length, "keystrokes")
say("dated", dated, DATED.length, "date clauses")

