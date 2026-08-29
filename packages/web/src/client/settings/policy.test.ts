/**
 * What the SERVER's git policy does to the two preference rows that read it.
 *
 * The rules are tiny and the reason they are a module at all is that the two
 * rows' values and the instance line under them are asked of the same cell.
 * Asked separately, a browser could be drawn a default whose line named a flag
 * nobody gave, which is a policy quietly not applying.
 *
 * There is no write half: the rows are always the instance's, always read-only.
 * A unit test asks these with a `GitState` built by hand.
 */

import { DEFAULT_POLICY, GIT_OFF, type GitState } from "@olai/format"
import { expect, test } from "bun:test"

import { commitOn, commitSetBy, commitsOff, pushOn, pushSetBy } from "./policy.ts"

/** What the server said, with the one field a case is about over a healthy
 *  repository. */
const said = (over: Partial<GitState> = {}): GitState => ({
  ...GIT_OFF,
  status: "repo",
  ...over,
})

test("a page that has heard nothing draws the defaults, as the instance's", () => {
  expect(GIT_OFF.policy).toEqual(DEFAULT_POLICY)
  expect(commitOn(GIT_OFF)).toBe(false)
  expect(pushOn(GIT_OFF)).toBe(false)
  expect(commitSetBy(GIT_OFF)).toContain("built-in default")
  expect(pushSetBy(GIT_OFF)).toContain("built-in default")
  expect(GIT_OFF.paused).toBeNull()
})

/**
 * `auto` is the only commit mode that turns the row ON, and the other two are
 * one answer for two reasons rather than by accident: `manual` is "a write
 * waits until somebody asks", which is exactly this row's Off, and `off` is a
 * directory olai never commits in, where a loop is not a thing that could
 * happen.
 */
test("the Git commit row is on for the window and off for both waits", () => {
  expect(commitOn(said({ policy: { commit: "auto", push: "off" } }))).toBe(true)
  expect(commitOn(said({ policy: { commit: "manual", push: "off" } }))).toBe(false)
  expect(commitOn(said({ policy: { commit: "off", push: "off" } }))).toBe(false)
})

test("the Git push row is on for auto and off for off", () => {
  expect(pushOn(said({ policy: { commit: "manual", push: "auto" } }))).toBe(true)
  expect(pushOn(said({ policy: { commit: "manual", push: "off" } }))).toBe(false)
})

/** WHETHER A ROW NAMES A FLAG and WHAT IT SAYS are read off the one pin, so
 *  they cannot come apart — a row whose line named a flag nobody gave is the
 *  failure this pairing exists to make unspellable. */
test("a given flag is named, and an omitted flag is the built-in default", () => {
  const live = said()
  expect(commitSetBy(live)).toContain("built-in default")
  expect(commitSetBy(live)).not.toContain("--commit=")
  expect(pushSetBy(live)).toContain("built-in default")
  expect(pushSetBy(live)).not.toContain("--push=")

  const pinned = said({ pinned: { commit: "auto", push: null } })
  expect(commitSetBy(pinned)).toContain("--commit=auto")
  // ... and the other row is untouched by it, so an operator who ruled on
  // committing has not silently ruled on pushing.
  expect(pushSetBy(pinned)).toContain("built-in default")
  expect(pushSetBy(pinned)).not.toContain("--push=")
})

/**
 * The FLAG is named, and that is the difference between a control a reader can
 * do something about and one that has simply stopped working: "set by the
 * server" alone leaves somebody hunting for a setting that is not anywhere,
 * while the flag is the thing they hand whoever runs the instance.
 */
test("the line names the flag that set the row, and says a browser cannot", () => {
  const both = said({ pinned: { commit: "auto", push: "off" } })
  expect(commitSetBy(both)).toContain("--commit=auto")
  expect(pushSetBy(both)).toContain("--push=off")
  for (const line of [commitSetBy(both), pushSetBy(both)]) {
    expect(line).toContain("cannot be changed")
  }
  // `--no-commit` reaches here as the flag it IS — one flag, two spellings, and
  // nothing on the wire remembers which one was typed.
  const off = said({ pinned: { commit: "off", push: "auto" } })
  expect(commitSetBy(off)).toContain("--commit=off")
  expect(pushSetBy(off)).toContain("--push=auto")
})

/**
 * `--commit=off` is not a third setting of the Git commit row — it is the row
 * having nothing to be about, and the hint has to say so.
 *
 * The row's Off sentence sends a reader to the Commit button, which is true for
 * `manual`. Under this one the pill is inert and olai never writes a commit in
 * this directory at all, so that sentence would be the row's permanent,
 * reader-can-do-nothing statement pointing at a door that will not open.
 */
test("--commit=off is told apart from the other way the row reads Off", () => {
  expect(commitsOff(said({ policy: { commit: "off", push: "off" } }))).toBe(true)
  expect(commitsOff(said({ policy: { commit: "manual", push: "off" } }))).toBe(false)
  expect(commitsOff(said({ policy: { commit: "auto", push: "off" } }))).toBe(false)
})
