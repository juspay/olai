/**
 * What a call left running, over rows.
 *
 * No DOM: three functions over one row, and the row they are about is the one
 * the panel used to have nothing to say about at all — a call that arms a
 * background task and goes on being true for an hour. Most of what is claimed
 * below is about the stretch AFTER the turn ends, which is exactly the stretch
 * the old panel drew as a finished call.
 *
 * The rows here are the shapes the wire actually produces — a real `Monitor`
 * and a real `Bash(run_in_background)`, recorded 2026-08-24 through the pinned
 * adapter and its patch (`packages/plugins/claude/acp/patches/README.md`).
 */

import { describe, expect, test } from "bun:test"

import { armedOf, endedOf, stillOf, watchOf } from "./background.ts"
import { toolRow as row } from "./rows.testlib.ts"

describe("which rows left something running", () => {
  test("a call that armed nothing has no face at all", () => {
    expect(armedOf(row({ status: "in_progress" }))).toBeNull()
    expect(watchOf(row({ status: "in_progress" }))).toBeNull()
    expect(stillOf(row({ status: "in_progress" }))).toBeNull()
    expect(endedOf(row({ status: "completed" }))).toBeNull()
  })

  test("a row that has not arrived yet has none either", () => {
    // The transient the list has: a key is in `rows()` and its value is a
    // frame behind. Asked about nothing, the answer is nothing.
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
        armed: { task: "bu13xz2ie", description: "kolu fleet watch" },
      })),
    ).toBe("kolu fleet watch")
  })

  test("a task nobody described says nothing, rather than a category", () => {
    // The difference from a spawn, and it is deliberate. A spawn that named no
    // kind still started somebody, so *agent* is true and worth drawing. A task
    // nobody described has nothing to add to the row's own title, and a chip
    // reading "background task" beside a title reading `Monitor` is furniture.
    expect(watchOf(row({ text: "Monitor", armed: { task: "bu13xz2ie" } }))).toBeNull()
  })

  test("... and goes on saying it after the task has died", () => {
    // The row a person actually reads is the one at the moment of death, and
    // WHICH watch died is the whole question they are reading it with.
    expect(
      watchOf(row({
        status: "failed",
        armed: { task: "bu13xz2ie", description: "kolu fleet watch", ended: "killed" },
      })),
    ).toBe("kolu fleet watch")
  })
})

describe("whether it is still out there", () => {
  test("an armed task the wire still calls running says so", () => {
    expect(
      stillOf(row({
        status: "in_progress",
        armed: { task: "bu13xz2ie", description: "kolu fleet watch" },
      })),
    ).toBe("still running…")
  })

  test("a task the harness has reported the end of does not", () => {
    // The ending is the task's own, and it is what takes the rail out — not
    // the status, which for a monitor somebody stopped says `failed` and for
    // one whose stream ended says `completed`. Both are over.
    expect(
      stillOf(row({
        status: "failed",
        armed: { task: "bu13xz2ie", description: "kolu fleet watch", ended: "stopped" },
      })),
    ).toBeNull()
    expect(
      stillOf(row({
        status: "completed",
        armed: { task: "bu13xz2ie", ended: "completed" },
      })),
    ).toBeNull()
  })

  test("nor does one whose call the SERVER says was abandoned", () => {
    // The case the transcript's own exemption deliberately does not cover: an
    // armed row is not stranded while its task is alive, so a stranded armed
    // row is one whose AGENT died — and a rail that went on pulsing under a
    // process that no longer exists is the exact failure the live faces on this
    // panel exist against.
    expect(
      stillOf(row({
        status: "in_progress",
        stranded: true,
        armed: { task: "bu13xz2ie", description: "kolu fleet watch" },
      })),
    ).toBeNull()
  })

  test("an ANNOUNCED call that armed a task counts as running", () => {
    // `pending` is what the adapter announces every call with, so it is a
    // running state rather than a case to fall through — the same reading the
    // rail under a spawn makes, from the same module.
    expect(stillOf(row({ status: "pending", armed: { task: "t1" } }))).toBe("still running…")
  })
})

describe("how it ended", () => {
  test("the harness's own word, which ACP's status cannot spell", () => {
    // The fact this whole feature exists for. ACP has four statuses, so
    // `failed`, `killed` and `stopped` all reach the row as `failed`; a
    // monitor somebody STOPPED did not fail, and this is the row a person
    // reads to find out what happened to their watch.
    for (const ended of ["completed", "failed", "killed", "stopped"]) {
      expect(endedOf(row({ status: "failed", armed: { task: "t1", ended } }))).toBe(ended)
    }
  })

  test("nothing at all while it is still running", () => {
    // Which is what makes the presence of this readout the death itself.
    expect(endedOf(row({ status: "in_progress", armed: { task: "t1" } }))).toBeNull()
  })
})
