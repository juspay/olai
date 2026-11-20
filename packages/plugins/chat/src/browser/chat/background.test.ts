import { describe, expect, test } from "bun:test"

import { armedOf, endedOf, stillOf, watchOf } from "./background.ts"
import { armedTask } from "../../outings.testlib.ts"
import { toolRow as row } from "./rows.testlib.ts"

describe("which rows left something running", () => {
  test("a call that armed nothing has no face at all", () => {
    expect(armedOf(row({ status: "in_progress" }))).toBeNull()
    expect(watchOf(row({ status: "in_progress" }))).toBeNull()
    expect(stillOf(row({ status: "in_progress" }))).toBeNull()
    expect(endedOf(row({ status: "completed" }))).toBeNull()
  })

  test("a row that has not arrived yet has none either", () => {
    expect(armedOf(undefined)).toBeNull()
    expect(watchOf(undefined)).toBeNull()
    expect(stillOf(undefined)).toBeNull()
    expect(endedOf(undefined)).toBeNull()
  })
})

describe("what it is watching", () => {
  test("the description the task was armed with, in the harness's own words", () => {
    expect(
      watchOf(row({
        text: "Monitor",
        status: "in_progress",
        armed: armedTask({ task: "bu13xz2ie", description: "kolu fleet watch" }),
      })),
    ).toBe("kolu fleet watch")
  })

  test("a task nobody described says nothing, rather than a category", () => {
    expect(watchOf(row({ text: "Monitor", armed: armedTask({ task: "bu13xz2ie" }) }))).toBeNull()
  })

  test("... and goes on saying it after the task has died", () => {
    expect(
      watchOf(row({
        status: "failed",
        armed: armedTask({ task: "bu13xz2ie", description: "kolu fleet watch", ended: "killed" }),
      })),
    ).toBe("kolu fleet watch")
  })
})

describe("whether it is still out there", () => {
  test("an armed task the wire still calls running says so", () => {
    expect(
      stillOf(row({
        status: "in_progress",
        armed: armedTask({ task: "bu13xz2ie", description: "kolu fleet watch" }),
      })),
    ).toBe("Still running…")
  })

  test("a task the harness has reported the end of does not", () => {
    expect(
      stillOf(row({
        status: "failed",
        armed: armedTask({ task: "bu13xz2ie", description: "kolu fleet watch", ended: "stopped" }),
      })),
    ).toBeNull()
    expect(
      stillOf(row({
        status: "completed",
        armed: armedTask({ task: "bu13xz2ie", ended: "completed" }),
      })),
    ).toBeNull()
  })

  test("nor does one whose call the SERVER says was abandoned", () => {
    expect(
      stillOf(row({
        status: "in_progress",
        stranded: true,
        armed: armedTask({ task: "bu13xz2ie", description: "kolu fleet watch" }),
      })),
    ).toBeNull()
  })

  test("an ANNOUNCED call that armed a task counts as running", () => {
    expect(stillOf(row({ status: "pending", armed: armedTask({ task: "t1" }) }))).toBe("Still running…")
  })
})

describe("how it ended", () => {
  test("the harness's own word, which ACP's status cannot spell", () => {
    for (const ended of ["completed", "failed", "killed", "stopped"]) {
      expect(endedOf(row({ status: "failed", armed: armedTask({ task: "t1", ended }) }))).toBe(ended)
    }
  })

  test("nothing at all while it is still running", () => {
    expect(endedOf(row({ status: "in_progress", armed: armedTask({ task: "t1" }) }))).toBeNull()
  })
})
