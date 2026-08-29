/**
 * THE NAMED GAP, at its bench.
 *
 * A lane writes `worktree .worktrees/live-properties` and does not say which
 * repository that is under. `./resolve.ts` argues the rule that closes it;
 * these are the cases, including the two a reader would ask about first —
 * what happens to a lane the rule cannot place, and what a value carrying
 * `..` does.
 */

import { expect, test } from "bun:test"

import { REPOS_DIR, repoIn, reposRootIn, worktreeAt } from "./resolve.ts"

// ── which repository a PR URL names ───────────────────────────────────────

test("a forge PR URL names its repository, and that is all this reads out of one", () => {
  expect(repoIn("https://github.com/juspay/odu/pull/94")).toBe("odu")
  expect(repoIn("https://github.com/juspay/olai/pull/433#issuecomment-1")).toBe("olai")
  // The host is not checked: a self-hosted forge has the same `<owner>/<repo>`
  // shape, and refusing one would be an opinion about where a team keeps code.
  expect(repoIn("https://git.example.test/team/thing/pull/7")).toBe("thing")
})

test("a value that is not a URL names no repository — the whole value has to BE one", () => {
  expect(repoIn(undefined)).toBeUndefined()
  expect(repoIn("")).toBeUndefined()
  expect(repoIn("juspay/odu#94")).toBeUndefined()
  // A URL INSIDE a sentence is a sentence. Pulling the address out of it would
  // be this module deciding which half of somebody's prose was the point —
  // the founding rule `@olai/format`'s `meaning.ts` states about doors.
  expect(repoIn("see https://github.com/juspay/odu/pull/94 — reported 12:45"))
    .toBeUndefined()
  // A URL with no repository segment.
  expect(repoIn("https://github.com/juspay")).toBeUndefined()
  // Not a forge scheme.
  expect(repoIn("ssh://git@github.com/juspay/odu")).toBeUndefined()
})

test("the URL parser normalises a traversal away before this reads a segment", () => {
  // Pinned because it is the reason there is no `..` guard in `repoIn`: `new
  // URL` collapses the pathname first, so what arrives is a different pair of
  // harmless segments and a guard here would be dead code. The fence that
  // actually matters is asked of the RESOLVED path, below.
  expect(repoIn("https://github.com/juspay/../pull/1")).toBe("1")
})

// ── where checkouts live ──────────────────────────────────────────────────

test("the repos root is the served vault's own parent — checkouts beside the board", () => {
  expect(reposRootIn({}, "/home/x/code/oss.olai")).toBe("/home/x/code")
})

test("...unless the machine says otherwise, and an EMPTY variable is an unset one", () => {
  expect(reposRootIn({ [REPOS_DIR]: "/srv/repos" }, "/home/x/code/oss.olai"))
    .toBe("/srv/repos")
  // A shell exporting `OLAI_REPOS_DIR=` has nothing to tell us; joining onto
  // `""` would resolve every relative worktree against the process's cwd.
  expect(reposRootIn({ [REPOS_DIR]: "" }, "/home/x/code/oss.olai"))
    .toBe("/home/x/code")
})

// ── the rule itself ───────────────────────────────────────────────────────

const ROOT = "/home/x/code"

test("a relative worktree joins onto the checkout its PR URL names", () => {
  expect(
    worktreeAt(
      { worktree: ".worktrees/thin-client", prUrl: "https://github.com/juspay/odu/pull/94" },
      ROOT,
    ),
  ).toBe("/home/x/code/odu/.worktrees/thin-client")
})

test("an ABSOLUTE worktree is used as written — the board's way out of the guessing", () => {
  // The line that makes "declare it absolutely" a real option rather than a
  // suggestion: no repo is consulted and no root is joined.
  expect(worktreeAt({ worktree: "/srv/checkout/odu" }, ROOT)).toBe("/srv/checkout/odu")
  expect(
    worktreeAt({ worktree: "/srv/checkout/odu", prUrl: "https://github.com/j/olai/pull/1" }, ROOT),
  ).toBe("/srv/checkout/odu")
})

test("a relative worktree with no repository resolves to NOTHING, and is not probed", () => {
  // Not a fallback: the two facts a lane must carry for a face are a path and
  // which tree it is in, and inventing the second is exactly the wrong door
  // this repo's display rules refuse everywhere else.
  expect(worktreeAt({ worktree: ".worktrees/a" }, ROOT)).toBeUndefined()
  expect(worktreeAt({ worktree: ".worktrees/a", prUrl: "not a url" }, ROOT)).toBeUndefined()
})

test("an empty worktree names nothing", () => {
  expect(worktreeAt({ worktree: "   " }, ROOT)).toBeUndefined()
})

test("a worktree cannot climb out of the repos root", () => {
  // `..` in the value is refused rather than sanitised on the way past: a
  // resolution that left the root is a path this rule never claimed to place.
  expect(
    worktreeAt(
      { worktree: "../../../etc", prUrl: "https://github.com/juspay/odu/pull/94" },
      ROOT,
    ),
  ).toBeUndefined()
  // ...and one that climbs only as far as a SIBLING checkout is still inside
  // the root, so it resolves — the fence is the root, not the checkout.
  expect(
    worktreeAt(
      { worktree: "../kolu/.worktrees/a", prUrl: "https://github.com/juspay/odu/pull/94" },
      ROOT,
    ),
  ).toBe("/home/x/code/kolu/.worktrees/a")
})
