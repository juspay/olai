/**
 * The rules Auto-commit runs on, on their own — no timer, no Solid, no wire.
 *
 * Three of them, and each is a way the loop could misbehave without anything
 * failing: what counts as the flurry still arriving, whether an attempt may be
 * made at all, and what stops the loop rather than being retried at it.
 */

import type { Pending } from "@olai/format"
import { BusyFailure, isReady, NO_PIN, NOTHING_PENDING, type RepoState } from "@olai/format"
import { GIT_OFF, type GitState } from "@olai/surface"
import { expect, test } from "bun:test"

import { flurryOf, mayRecord, QUIET_MS, type Standing, stoppedBy, stoppedByPush } from "./flurry.ts"

const WAITING: Pending = {
  ...NOTHING_PENDING,
  repo: { _tag: "Ready", branch: "main" },
  outlines: [
    { file: "roadmap.olai", path: "roadmap.olai", how: "modified", from: null },
  ],
  changes: [{
    file: "roadmap.olai",
    id: "kolu",
    title: "Kolu integration",
    fields: ["done"],
    sort: "done",
  }],
}

const CLEAN: Pending = { ...NOTHING_PENDING, repo: { _tag: "Ready", branch: "main" } }

/** The standing a loop that may record is in, so each test moves one thing. */
const GOING: Standing = {
  armed: true,
  paused: null,
  alone: true,
  heard: true,
  flurry: flurryOf(WAITING),
  ready: true,
  sound: true,
  working: false,
  pushing: false,
}

// ── the quiet window ───────────────────────────────────────────────────

test("the quiet window is in the band the ruling named", () => {
  expect(QUIET_MS).toBeGreaterThanOrEqual(10_000)
  expect(QUIET_MS).toBeLessThanOrEqual(30_000)
})

// ── what the flurry IS ─────────────────────────────────────────────────

test("nothing waiting is no flurry at all", () => {
  expect(flurryOf(NOTHING_PENDING)).toBe("")
  expect(flurryOf(CLEAN)).toBe("")
})

test("the same waiting work reads as the same flurry", () => {
  expect(flurryOf(WAITING)).toBe(flurryOf({ ...WAITING }))
})

test("a further edit is a new flurry, so the window starts again", () => {
  const more: Pending = {
    ...WAITING,
    others: [{ path: "README.md", how: "modified", from: null }],
  }
  expect(flurryOf(more)).not.toBe(flurryOf(WAITING))
})

// The pill's own counters move on a commit and on a push, and neither is an
// edit: a window that restarted on them would be a window a busy repository
// could hold open forever.
test("what is not waiting work does not restart the window", () => {
  const counted: Pending = {
    ...WAITING,
    wrote: [{ writer: "web", ops: 3 }],
    unpushed: { upstream: "origin/main", commits: 2 },
    last: { sha: "1a2b3c4", message: "olai: something", at: "2026-08-20T10:00:00Z", writer: "web" },
  }
  expect(flurryOf(counted)).toBe(flurryOf(WAITING))
})

// ── whether an attempt may be made ─────────────────────────────────────

test("an armed loop with work waiting in a healthy repository records", () => {
  expect(mayRecord(GOING)).toBe(true)
})

test("every reason to hold off holds off", () => {
  const held: ReadonlyArray<Partial<Standing>> = [
    { armed: false },
    { paused: "git refused the commit" },
    { alone: false },
    { heard: false },
    { flurry: "" },
    { ready: false },
    { sound: false },
    { working: true },
    { pushing: true },
  ]
  for (const one of held) {
    expect(mayRecord({ ...GOING, ...one })).toBe(false)
  }
})

// `sound` is the git cell's four states, read the one way the loop reads them:
// a repository nothing has refused in, and everything else. It is a BOOLEAN in
// the standing rather than the state itself, because the cell is republished by
// the server's sweep whether or not anything moved — see {@link Standing.sound}.
test("git is sound only where it is a repository that has refused nothing", () => {
  const soundIn = (git: GitState): boolean => git.status === "repo"
  expect(soundIn({ status: "repo", said: null, pinned: NO_PIN })).toBe(true)
  expect(soundIn(GIT_OFF)).toBe(false)
  expect(soundIn({ status: "none", said: null, pinned: NO_PIN })).toBe(false)
  expect(soundIn({ status: "error", said: "no user.email", pinned: NO_PIN })).toBe(false)
})

// ... and `ready` is the repository's own three refusals, through the one
// predicate the whole app judges them by rather than a fourth reading of the
// state here.
test("a repository that cannot take a commit is not recorded into", () => {
  const cannot: ReadonlyArray<RepoState> = [
    { _tag: "Blocked", reason: "rebase", said: "mid-rebase" },
    { _tag: "NoRepo" },
    { _tag: "Off" },
  ]
  for (const repo of cannot) {
    expect(mayRecord({ ...GOING, ready: isReady(repo) })).toBe(false)
  }
  expect(mayRecord({ ...GOING, ready: isReady({ _tag: "Ready", branch: "main" }) })).toBe(true)
})

// ── what stops the loop ────────────────────────────────────────────────

test("a commit git refused stops the loop, in git's own words", () => {
  expect(stoppedBy({ _tag: "Failed", said: "gpg failed to sign the data" }))
    .toBe("gpg failed to sign the data")
  expect(stoppedBy({
    _tag: "Refused",
    failure: new BusyFailure({ reason: "the server would not take the call" }),
  })).toBe("the server would not take the call")
})

// A busy repository is not a fault to stop over: it is a state that ends, the
// loop never attempts while it lasts, and the pill already wears it.
test("a state that ends does not stop the loop", () => {
  expect(stoppedBy(null)).toBe(null)
  expect(stoppedBy({ _tag: "Committed", sha: "1a2b3c4", changes: 1, others: 0 })).toBe(null)
  expect(stoppedBy({ _tag: "NothingToCommit" })).toBe(null)
  expect(stoppedBy({ _tag: "Blocked", repo: { _tag: "Blocked", reason: "merge", said: "mid-merge" } }))
    .toBe(null)
})

test("a push git refused stops the loop too — the divergence is the conflict", () => {
  expect(stoppedByPush({ _tag: "Failed", said: "Updates were rejected (non-fast-forward)" }))
    .toBe("Updates were rejected (non-fast-forward)")
  expect(stoppedByPush({
    _tag: "Refused",
    failure: new BusyFailure({ reason: "the server would not take the call" }),
  })).toBe("the server would not take the call")
})

test("a push that landed, or had nothing to send, leaves the loop running", () => {
  expect(stoppedByPush(null)).toBe(null)
  expect(stoppedByPush({ _tag: "Pushed", upstream: "origin/main", commits: 1 })).toBe(null)
  expect(stoppedByPush({ _tag: "NothingToPush" })).toBe(null)
  expect(stoppedByPush({ _tag: "Blocked", repo: { _tag: "Blocked", reason: "merge", said: "mid-merge" } }))
    .toBe(null)
})
