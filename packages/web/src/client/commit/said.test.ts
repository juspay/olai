/**
 * Which face the one indicator wears, what it wears, and what it says.
 *
 * Two bugs meet in this table and both are about a page that told a reader
 * nothing. `git-invisible` (#108) was a write that came back `committed: false`
 * on a directory its owner knew was a repository, with the reason in the server
 * log: "git is fine", "this is not a repository" and "git is broken here" were
 * one blank space. `one-git-indicator` is the human's screenshot of the fix
 * having grown a second chip — `● git` beside `✓ committed · 3m ago`, two
 * controls answering one question.
 *
 * So the assertions here are the ones the retired readout's own test made,
 * moved to where the states live now: nothing #108 fought for may regress, and
 * the healthy case must stay quiet enough that a reader still scans the place
 * the news appears.
 */

import { NOTHING_PENDING, type Pending, type RepoState } from "@olai/format"
import { GIT_OFF, type GitState } from "@olai/surface"
import { expect, test } from "bun:test"

import { because, DETAIL, explain, faceOf, isInert, MARK, verbatim } from "./said.ts"

/** A survey of a directory in one repository state, with nothing waiting unless
 *  a test says otherwise. */
const surveyed = (repo: RepoState, over: Partial<Pending> = {}): Pending => ({
  ...NOTHING_PENDING,
  repo,
  ...over,
})

const READY: RepoState = { _tag: "Ready", branch: "main" }
const gitSaid = (said: string): GitState => ({ status: "error", said })

// ── which face ─────────────────────────────────────────────────────────

test("a page that has not been told anything claims nothing about the directory", () => {
  // The alternative is what the pill used to do: draw the default value's
  // `off`, which is a SETTING somebody could go and change — a claim a page has
  // no business making about a server it has not heard from.
  expect(faceOf(surveyed(READY), false, GIT_OFF)).toBe("unknown")
})

test("the opt-out and the directory that is no work tree are told apart", () => {
  expect(faceOf(surveyed({ _tag: "Off" }), true, GIT_OFF)).toBe("off")
  expect(faceOf(surveyed({ _tag: "NoRepo" }), true, { status: "none", said: null }))
    .toBe("no-repo")
})

test("a git that failed is NOT a directory without a repository", () => {
  // #108's whole finding. Every way of failing used to read as "you have no
  // repository", so a service with no git on its PATH told a reader their notes
  // were not under version control.
  const said = "fatal: detected dubious ownership in repository"
  const face = faceOf(surveyed({ _tag: "Unusable", said }), true, gitSaid(said))
  expect(face).toBe("error")
  expect(face).not.toBe("no-repo")
})

test("a commit git REFUSED reads as a fault, even though the directory looks fine", () => {
  // The one thing no survey can see: a repository with no `user.email` answers
  // `rev-parse` happily and fails every commit. The server remembers the
  // refusal and publishes it on the git cell — so the pill has to read that
  // cell, not just the repository state beside it.
  const said = "fatal: unable to auto-detect email address"
  expect(faceOf(surveyed(READY), true, gitSaid(said))).toBe("error")
})

test("a serve that never asks git cannot report a git fault", () => {
  // `off` is decided before the fault is, and it has to be: nothing was asked,
  // so there is nothing that could have failed.
  expect(faceOf(surveyed({ _tag: "Off" }), true, gitSaid("stale"))).toBe("off")
})

test("what is waiting outranks what was last recorded, and a busy repository says so", () => {
  const one = { changes: [], unreadable: ["garden.jsonl"] }
  expect(faceOf(surveyed(READY, one), true, GIT_OFF)).toBe("waiting")
  expect(
    faceOf(
      surveyed({ _tag: "Blocked", reason: "rebase", said: "" }, one),
      true,
      GIT_OFF,
    ),
  ).toBe("blocked")
  // A busy repository with nothing waiting is not a problem anybody has: there
  // is nothing the block is stopping, so it reads as what it is — a clean tree
  // olai has not committed in.
  expect(faceOf(surveyed({ _tag: "Blocked", reason: "rebase", said: "" }), true, GIT_OFF))
    .toBe("never")
})

test("never committed is not the same as committed, on the same empty tree", () => {
  const last = {
    sha: "abc1234",
    message: "olai: the mint is split",
    writer: "web" as const,
    at: "2026-08-11T09:00:00Z",
  }
  expect(faceOf(surveyed(READY), true, GIT_OFF)).toBe("never")
  expect(faceOf(surveyed(READY, { last }), true, GIT_OFF)).toBe("committed")
})

// ── what it wears ──────────────────────────────────────────────────────

test("the two settings and the page that has not heard wear no mark, and cannot be pressed", () => {
  for (const face of ["unknown", "off", "no-repo"] as const) {
    expect(MARK[face]).toBeNull()
    expect(isInert(face)).toBe(true)
  }
})

test("a healthy repository is quiet, and not a second green claim", () => {
  // The retired readout's rule, and it outlives it: the connection dot beside
  // this pill is the page's one green claim, and a second one lit permanently
  // in the ordinary case dilutes the thing a reader actually scans for.
  expect(MARK.committed?.tone).not.toContain("done")
  expect(MARK.never).toBeNull()
  expect(MARK.waiting).toBeNull()
})

test("the two a person can act on are marked, and told apart by tone", () => {
  // A repository mid-rebase will take a commit once they finish; a git that
  // failed will not. Same glyph, different news.
  expect(MARK.blocked).toEqual({ glyph: "⚠", tone: "text-doing" })
  expect(MARK.error).toEqual({ glyph: "⚠", tone: "text-alarm" })
})

test("the fault is reachable, because its whole point is the reason on it", () => {
  // Inert means `aria-disabled`, which means no focus — and a reason a keyboard
  // cannot reach is a reason half the readers do not get.
  expect(isInert("error")).toBe(false)
})

// ── what it says ───────────────────────────────────────────────────────

test("a git failure hands over git's own words", () => {
  const said = "fatal: detected dubious ownership in repository at '/srv/notes'"
  expect(explain("error", surveyed(READY), gitSaid(said))).toContain(said)
  // And from the survey's own side, when the cell has nothing to quote.
  expect(explain("error", surveyed({ _tag: "Unusable", said }), { status: "error", said: null }))
    .toContain(said)
})

test("a fault that arrived with nothing to say still reads as a sentence", () => {
  expect(explain("error", surveyed(READY), { status: "error", said: "" }))
    .toBe(DETAIL.error)
})

test("the sentence counts what the label counts", () => {
  const waiting = surveyed(READY, { unreadable: ["garden.jsonl"] })
  expect(explain("waiting", waiting, GIT_OFF)).toStartWith("1 change is")
  const two = surveyed(READY, { unreadable: ["garden.jsonl", "shed.jsonl"] })
  expect(explain("waiting", two, GIT_OFF)).toStartWith("2 changes are")
})

test("a busy repository says which interruption it is in", () => {
  const busy = surveyed({ _tag: "Blocked", reason: "rebase", said: "" }, {
    unreadable: ["garden.jsonl"],
  })
  expect(explain("blocked", busy, GIT_OFF)).toContain("a rebase is in progress")
})

test("a state with nothing to quote reads as its own sentence", () => {
  expect(explain("no-repo", surveyed({ _tag: "NoRepo" }), GIT_OFF)).toBe(DETAIL["no-repo"])
  expect(explain("never", surveyed(READY), GIT_OFF)).toBe(DETAIL.never)
})

test("the panel's line about a broken git is not the line about an absent one", () => {
  // Same rule as the pill's, one layer down: "there is nowhere to commit to"
  // over a git that FAILED would be the collapse #108 exists to have ended.
  const said = "fatal: detected dubious ownership in repository"
  expect(because({ _tag: "Unusable", said })).toContain("could not be asked")
  expect(verbatim({ _tag: "Unusable", said })).toBe(said)
  expect(because({ _tag: "NoRepo" })).toBe("there is nowhere to commit to")
})
