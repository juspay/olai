/**
 * What a pinned git policy does to the two preference rows that read it.
 *
 * The rules are tiny and the reason they are a module at all is that FOUR
 * places ask them — the two preference accessors, the panel that draws the
 * rows frozen, and the commit pill's sentence about how to resume a stopped
 * loop. Asked separately, a browser could be drawn a read-only control whose
 * loop was still running on the reader's own answer, which is a team's policy
 * quietly not applying.
 *
 * `./autocommit.test.ts` and `./autopush.test.ts` hold the OTHER half: that a
 * pin overrules the stored preference without overwriting it.
 */

import { NO_PIN } from "@olai/format"
import { expect, test } from "bun:test"

import { pinnedCommit, pinnedPush, setBy } from "./pinned.ts"

test("nothing pinned leaves both rows to the browser", () => {
  expect(pinnedCommit(NO_PIN)).toBeNull()
  expect(pinnedPush(NO_PIN)).toBeNull()
})

/**
 * `auto` is the only commit mode that turns the row ON, and the other two are
 * one answer for two reasons rather than by accident: `manual` is "a write
 * waits until somebody asks", which is exactly this row's Off, and `off` is a
 * directory olai never commits in, where a browser recording on its own is not
 * a thing that could happen.
 */
test("a pinned --commit says which way the row is frozen", () => {
  expect(pinnedCommit({ commit: "auto", push: null })).toBe(true)
  expect(pinnedCommit({ commit: "manual", push: null })).toBe(false)
  expect(pinnedCommit({ commit: "off", push: null })).toBe(false)
})

test("a pinned --push says which way its row is frozen", () => {
  expect(pinnedPush({ commit: null, push: "auto" })).toBe(true)
  expect(pinnedPush({ commit: null, push: "off" })).toBe(false)
})

/** The two halves are independent, so an operator who ruled on committing has
 *  not silently ruled on pushing as well. */
test("pinning one row leaves the other one live", () => {
  const commitOnly = { commit: "auto", push: null } as const
  expect(pinnedCommit(commitOnly)).toBe(true)
  expect(pinnedPush(commitOnly)).toBeNull()
})

/**
 * The FLAG is named, and that is the difference between a control a reader can
 * do something about and one that has simply stopped working: "set by the
 * server" alone leaves somebody hunting for a setting that is not anywhere,
 * while the flag is the thing they hand whoever runs the instance.
 */
test("the line names the flag that set the row, and says a browser cannot", () => {
  expect(setBy("commit", "auto")).toContain("--commit=auto")
  expect(setBy("push", "off")).toContain("--push=off")
  for (const said of [setBy("commit", "off"), setBy("push", "auto")]) {
    expect(said).toContain("cannot be changed")
  }
})
