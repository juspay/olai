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

import {
  commitFrozen,
  commitSetBy,
  pinnedCommit,
  pinnedPush,
  pushFrozen,
  pushSetBy,
  setPinned,
} from "./pinned.ts"

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
 *  not silently ruled on pushing. */
test("pinning one row leaves the other one live", () => {
  const commitOnly = { commit: "auto", push: null } as const
  expect(pinnedCommit(commitOnly)).toBe(true)
  expect(pinnedPush(commitOnly)).toBeNull()
})

/** WHETHER A ROW IS FROZEN and WHAT IT SAYS are read off the one pin, so they
 *  cannot come apart — a row drawn frozen whose line named a flag nobody gave
 *  is the failure this pairing exists to make unspellable. */
test("a row is frozen exactly when it has something to say about who set it", () => {
  try {
    setPinned(NO_PIN)
    expect(commitFrozen()).toBe(false)
    expect(commitSetBy()).toBeNull()
    expect(pushFrozen()).toBe(false)
    expect(pushSetBy()).toBeNull()

    setPinned({ commit: "auto", push: null })
    expect(commitFrozen()).toBe(true)
    expect(commitSetBy()).not.toBeNull()
    // ... and the other row is untouched by it.
    expect(pushFrozen()).toBe(false)
    expect(pushSetBy()).toBeNull()
  } finally {
    setPinned(NO_PIN)
  }
})

/**
 * The FLAG is named, and that is the difference between a control a reader can
 * do something about and one that has simply stopped working: "set by the
 * server" alone leaves somebody hunting for a setting that is not anywhere,
 * while the flag is the thing they hand whoever runs the instance.
 */
test("the line names the flag that set the row, and says a browser cannot", () => {
  try {
    setPinned({ commit: "auto", push: "off" })
    expect(commitSetBy()).toContain("--commit=auto")
    expect(pushSetBy()).toContain("--push=off")
    for (const said of [commitSetBy(), pushSetBy()]) {
      expect(said).toContain("cannot be changed")
    }
    // `--no-commit` reaches here as the flag it IS — one flag, two spellings,
    // and nothing on the wire remembers which one was typed.
    setPinned({ commit: "off", push: "auto" })
    expect(commitSetBy()).toContain("--commit=off")
    expect(pushSetBy()).toContain("--push=auto")
  } finally {
    setPinned(NO_PIN)
  }
})
