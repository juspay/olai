/**
 * What each git state looks like, and what it says.
 *
 * The bug this table exists for was an absence — a write that was not committed
 * and a page with nothing on it about that — so the assertions here are about
 * what is DRAWN and what is SAID, in the two directions that were wrong:
 * nothing at all is right for exactly one state, and the state that has git's
 * own words has to hand them over.
 */

import { expect, test } from "bun:test"

import { LOOK, sentence } from "./state.ts"

test("the opt-out draws nothing at all", () => {
  // An owner who said `--no-commit` did not ask for a badge about it, and a
  // chrome reporting a SETTING teaches a reader to ignore the place a
  // condition would appear.
  expect(LOOK.off).toBeNull()
})

test("a healthy repository is quiet, and not a second green claim", () => {
  const look = LOOK.repo
  expect(look).not.toBeNull()
  // Short: this is the default state of every repository-backed serve, and it
  // sits in a fixed-height bar beside the connection.
  expect(look?.label.length).toBeLessThanOrEqual(4)
  // The connection's dot is the page's one green claim. `bg-done` here would
  // dilute the thing a reader actually scans for.
  expect(look?.dot).not.toContain("done")
})

test("a directory that is not a repository says so in words", () => {
  expect(LOOK.none?.label).toBe("Not a Git repo")
  expect(LOOK.none?.detail).toContain("not committed")
})

test("a git failure says so, and hands over git's own words", () => {
  const look = LOOK.error
  expect(look?.label).toBe("Git error")
  expect(look).not.toBeNull()
  const said = "fatal: detected dubious ownership in repository at '/srv/notes'"
  expect(sentence({ status: "error", said }, look!)).toContain(said)
})

test("a state with nothing to quote reads as its own sentence", () => {
  expect(sentence({ status: "none", said: null }, LOOK.none!)).toBe(LOOK.none!.detail)
  // An error that somehow arrived with nothing to say still reads as a
  // sentence rather than as a dangling dash.
  expect(sentence({ status: "error", said: "" }, LOOK.error!)).toBe(LOOK.error!.detail)
})
