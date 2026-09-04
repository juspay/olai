/**
 * Which rail a row hangs.
 *
 * No DOM: one function over one row, and what it pins is the thing neither
 * rule module can answer alone — a call can be BOTH a spawn and a background
 * task (an `Agent` launched asynchronously is exactly that), and the two faces
 * say different words under different names.
 */

import { describe, expect, test } from "bun:test"

import { TESTID } from "../../testids.ts"
import { railOf, sameRail } from "./rail.ts"
import { toolRow as row } from "./rows.testlib.ts"

describe("which rail a row hangs", () => {
  test("none at all for a row that sent nobody and armed nothing", () => {
    expect(railOf(row({ status: "in_progress" }))).toBeNull()
    expect(railOf(undefined)).toBeNull()
  })

  test("a spawn's rail says the agent is working", () => {
    expect(railOf(row({ status: "in_progress", spawned: { kind: "Explore" } })))
      .toEqual({ said: "working…", name: TESTID.chatSpawnWorking })
  })

  test("an armed task's rail says it is still running", () => {
    expect(railOf(row({ status: "in_progress", armed: { task: "bu13xz2ie" } })))
      .toEqual({ said: "still running…", name: TESTID.chatArmedStill })
  })

  test("A CALL THAT IS BOTH hangs the SPAWN's rail", () => {
    // An `Agent` launched asynchronously is a spawn and a background task at
    // once, and this is where that is decided rather than in the order two
    // reads happen to be written in: who was sent is the more specific thing
    // to say about a call than that something is still running.
    expect(
      railOf(row({
        status: "in_progress",
        spawned: { kind: "Explore" },
        armed: { task: "ad58764267416dc7e" },
      })),
    ).toEqual({ said: "working…", name: TESTID.chatSpawnWorking })
  })

  test("... and nothing once each of them is over", () => {
    expect(railOf(row({ status: "completed", spawned: { kind: "Explore" } }))).toBeNull()
    expect(
      railOf(row({ status: "completed", armed: { task: "bu13xz2ie", ended: "completed" } })),
    ).toBeNull()
    // ... including a task the harness has not spoken about whose CALL its
    // turn walked away from, which is what a dead agent leaves behind.
    expect(
      railOf(row({ status: "in_progress", stranded: true, armed: { task: "bu13xz2ie" } })),
    ).toBeNull()
  })
})

describe("whether two answers are the same rail", () => {
  test("the same words under the same name", () => {
    const rail = { said: "working…", name: TESTID.chatSpawnWorking }
    expect(sameRail(rail, { ...rail })).toBe(true)
    expect(sameRail(null, null)).toBe(true)
  })

  test("... and not otherwise, in either half", () => {
    // The half that matters: the WORDS can be equal while the face is not, and
    // an equality that compared only those would leave a spawn's rail wearing
    // a task's name on the row it changed into.
    expect(
      sameRail(
        { said: "still running…", name: TESTID.chatArmedStill },
        { said: "still running…", name: TESTID.chatSpawnWorking },
      ),
    ).toBe(false)
    expect(sameRail({ said: "working…", name: TESTID.chatSpawnWorking }, null)).toBe(false)
  })
})
