import { describe, expect, test } from "bun:test"

import { TESTID } from "../../testids.ts"
import { railOf, sameRail } from "./rail.ts"
import { armedTask, sentAgent } from "../../outings.testlib.ts"
import { toolRow as row } from "./rows.testlib.ts"

describe("which rail a row hangs", () => {
  test("none at all for a row that sent nobody and armed nothing", () => {
    expect(railOf(row({ status: "in_progress" }))).toBeNull()
    expect(railOf(undefined)).toBeNull()
  })

  test("a spawn's rail says the agent is working", () => {
    expect(railOf(row({ status: "in_progress", spawned: sentAgent({ kind: "Explore" }) })))
      .toEqual({ said: "Working…", name: TESTID.chatSpawnWorking })
  })

  test("an armed task's rail says it is still running", () => {
    expect(railOf(row({ status: "in_progress", armed: armedTask({ task: "bu13xz2ie" }) })))
      .toEqual({ said: "Still running…", name: TESTID.chatArmedStill })
  })

  test("A CALL THAT IS BOTH hangs the SPAWN's rail", () => {
    expect(
      railOf(row({
        status: "in_progress",
        spawned: sentAgent({ kind: "Explore" }),
        armed: armedTask({ task: "ad58764267416dc7e" }),
      })),
    ).toEqual({ said: "Working…", name: TESTID.chatSpawnWorking })
  })

  test("... and nothing once each of them is over", () => {
    expect(railOf(row({ status: "completed", spawned: sentAgent({ kind: "Explore" }) }))).toBeNull()
    expect(
      railOf(row({ status: "completed", armed: armedTask({ task: "bu13xz2ie", ended: "completed" }) })),
    ).toBeNull()
    expect(
      railOf(row({ status: "in_progress", stranded: true, armed: armedTask({ task: "bu13xz2ie" }) })),
    ).toBeNull()
  })
})

describe("whether two answers are the same rail", () => {
  test("the same words under the same name", () => {
    const rail = { said: "Working…", name: TESTID.chatSpawnWorking }
    expect(sameRail(rail, { ...rail })).toBe(true)
    expect(sameRail(null, null)).toBe(true)
  })

  test("... and not otherwise, in either half", () => {
    expect(
      sameRail(
        { said: "Still running…", name: TESTID.chatArmedStill },
        { said: "Still running…", name: TESTID.chatSpawnWorking },
      ),
    ).toBe(false)
    expect(sameRail({ said: "Working…", name: TESTID.chatSpawnWorking }, null)).toBe(false)
  })
})
