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

import {
  AUTO_PAUSED,
  AUTO_STOPPED,
  because,
  DETAIL,
  explain,
  faceOf,
  HOW,
  isInert,
  isNews,
  localOf,
  MARK,
  newsSays,
  pushTrouble,
  scopeOf,
  unpushedOf,
  verbatim,
  waitingIn,
} from "./said.ts"

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
  const one = { changes: [], unreadable: ["garden.olai"] }
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
  expect(MARK.committed?.glyph).toBe("✓")
  expect(MARK.never).toBeNull()
  expect(MARK.waiting).toBeNull()
})

test("the two a person can act on are marked", () => {
  // A repository mid-rebase will take a commit once they finish; a git that
  // failed will not. Same warning glyph; the faces themselves tell them apart.
  expect(MARK.blocked?.glyph).toBe("⚠")
  expect(MARK.error?.glyph).toBe("⚠")
})

test("the fault is reachable, because its whole point is the reason on it", () => {
  // Inert means `aria-disabled`, which means no focus — and a reason a keyboard
  // cannot reach is a reason half the readers do not get.
  expect(isInert("error")).toBe(false)
})

test("a phone only interrupts the page when git has news", () => {
  // The desktop pill is always drawn. A banner that vanished cannot be
  // trusted either — so the healthy faces stay off screen and the page
  // itself is the healthy state.
  expect(isNews("committed", 0)).toBe(false)
  expect(isNews("never", 0)).toBe(false)
  expect(isNews("off", 0)).toBe(false)
  expect(isNews("no-repo", 0)).toBe(false)
  expect(isNews("unknown", 0)).toBe(false)
  expect(isNews("waiting", 0)).toBe(true)
  expect(isNews("blocked", 0)).toBe(true)
  expect(isNews("error", 0)).toBe(true)
  expect(isNews("committed", 3)).toBe(true)
})

test("the phone banner is one line, and waiting outranks unpushed", () => {
  expect(newsSays("waiting", 6, 3)).toBe("6 uncommitted — tap to record")
  expect(newsSays("blocked", 2, 0)).toBe("2 uncommitted — repository busy")
  expect(newsSays("error", 0, 0)).toBe("git error — tap to see")
  expect(newsSays("committed", 0, 3)).toBe("3 unpushed — tap to push")
  expect(newsSays("committed", 0, 0)).toBe("")
})

// ── Auto-commit, which is a claim about the READER ─────────────────────
//
// It rides beside the faces rather than being one of them (the module's own
// argument, and `alsoUnpushed`'s): eight faces are eight things about the
// DIRECTORY, and whether this browser records on its own is true in one tab and
// false in the next. So what is asserted here is that it reaches a reader on
// EVERY face — including the healthy ones, which is the whole risk: a loop that
// stopped is silent by design.

test("a stopped loop reaches a reader on every face, healthy ones included", () => {
  const said = "gpg failed to sign the data"
  for (const face of ["committed", "never", "waiting", "error", "blocked"] as const) {
    expect(explain(face, surveyed(READY), GIT_OFF, said)).toContain(said)
  }
  // ... and a running loop adds nothing at all, so the ordinary sentence is
  // exactly what it was.
  expect(explain("committed", surveyed(READY), GIT_OFF, null))
    .toBe(explain("committed", surveyed(READY), GIT_OFF))
})

test("the sentence a stopped loop leaves says how to start it again", () => {
  // The one thing a reader cannot work out for themselves — and the panel's own
  // line says it too, so the two cannot drift on it.
  const said = explain("committed", surveyed(READY), GIT_OFF, "no upstream")
  expect(said).toContain("off and on again")
  expect(AUTO_STOPPED).toContain("off and on again")
})

test("a phone is interrupted by a stopped loop, on a face that is otherwise quiet", () => {
  expect(isNews("committed", 0, null)).toBe(false)
  expect(isNews("committed", 0, "no upstream")).toBe(true)
  expect(isNews("never", 0, "no upstream")).toBe(true)
})

test("the banner says the loop stopped ahead of whatever else is true", () => {
  // It outranks every face, because it is the one line about a promise having
  // broken rather than about work waiting.
  expect(newsSays("waiting", 6, 3, "no upstream")).toContain(AUTO_PAUSED)
  expect(newsSays("committed", 0, 0, "no upstream")).toContain(AUTO_PAUSED)
  expect(newsSays("waiting", 6, 3, null)).toBe("6 uncommitted — tap to record")
})

// ... and it does not take the COUNT with it. A halted loop plus a later edit
// is exactly when how much is sitting here is worth knowing, and the desktop
// pill says both beside each other — a phone that had to tap through to find
// out is the same fact told to two readers differently.
test("a stopped loop on a phone still says how much is waiting", () => {
  expect(newsSays("waiting", 6, 0, "no upstream")).toContain("6 uncommitted")
  expect(newsSays("waiting", 6, 0, "no upstream")).toContain(AUTO_PAUSED)
  // Nothing waiting is nothing to count, and the line stays one line.
  expect(newsSays("committed", 0, 0, "no upstream")).toBe(`${AUTO_PAUSED} — tap to see`)
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
  const waiting = surveyed(READY, { unreadable: ["garden.olai"] })
  expect(explain("waiting", waiting, GIT_OFF)).toStartWith("1 change is")
  const two = surveyed(READY, { unreadable: ["garden.olai", "shed.olai"] })
  expect(explain("waiting", two, GIT_OFF)).toStartWith("2 changes are")
})

test("a busy repository says which interruption it is in", () => {
  const busy = surveyed({ _tag: "Blocked", reason: "rebase", said: "" }, {
    unreadable: ["garden.olai"],
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

// ── the whole repository, and what is not shared ───────────────────────

/**
 * The SCOPE the panel reports on, which is new because the scope is new: a
 * `README.md` two directories above the outlines is a row in this list, and a
 * reader who is not told that has to work out why it is there.
 */
test("the scope line says which part of the repository olai serves", () => {
  expect(scopeOf("docs/")).toBe("whole repository · olai serves docs/")
  // Served AT the root, where the two are the same directory and "serves " with
  // nothing after it would read as a rendering fault.
  expect(scopeOf("")).toContain("whole repository")
  expect(scopeOf("")).not.toEndWith("serves ")
})

/**
 * Where a rename came from, in the outline list's own spelling.
 *
 * The wire carries one unambiguous name — repo-root-relative, the namespace a
 * commit request ticks in — and this is the rendering the outline list does to
 * it, so that a rename inside `docs/` reads `a.olai → b.olai` rather than
 * spelling the served directory once on each side of the arrow.
 */
test("a rename's other half is shortened to the served spelling, and only there", () => {
  expect(localOf("docs/a.olai", "docs/")).toBe("a.olai")
  // Served AT the root, where the two spellings are already the same string.
  expect(localOf("a.olai", "")).toBe("a.olai")
  // From OUTSIDE the served root, where the repo-relative name is the only one
  // that names a file that exists. Shortening by prefix alone would have turned
  // `docsy/a.olai` into `a.olai` — a file one directory over, or none at all.
  expect(localOf("README.md", "docs/")).toBe("README.md")
  expect(localOf("docsy/a.olai", "docs/")).toBe("docsy/a.olai")
  // Nothing to say for a row that did not move.
  expect(localOf(null, "docs/")).toBe(null)
})

/**
 * What is committed here and nowhere else.
 *
 * `null` is drawn as nothing at all, and it covers the two cases that are not
 * the same fact: a branch already in sync, and a branch with no upstream — the
 * second is not something to fix by guessing a remote, and a Push button on
 * either would be one people learn to ignore.
 */
test("the unpushed line counts commits, and is absent when there is nothing to send", () => {
  const behind = (commits: number): Pending => ({
    ...NOTHING_PENDING,
    unpushed: { upstream: "origin/master", commits },
  })
  expect(unpushedOf(behind(2))).toBe("2 commits not on origin/master")
  expect(unpushedOf(behind(1))).toBe("1 commit not on origin/master")
  expect(unpushedOf(behind(0))).toBe(null)
  expect(unpushedOf(NOTHING_PENDING)).toBe(null)
})

/**
 * ... and it rides EVERY face's sentence, because it is a different question
 * from the one the face answers.
 *
 * A clean tree with three unpushed commits wears `committed`, which is true and
 * is the complacent half of the truth — and the sentence is what a reader with
 * no pointer gets, so leaving it on the pill's own text would be leaving it out
 * for half of them.
 */
test("the sentence says what is unpushed, whichever face is worn", () => {
  const shared: Pending = {
    ...NOTHING_PENDING,
    repo: READY,
    unpushed: { upstream: "origin/master", commits: 3 },
  }
  expect(explain("committed", shared, GIT_OFF)).toContain("3 commits not on origin/master")
  expect(explain("waiting", shared, GIT_OFF)).toContain("3 commits not on origin/master")
  // And nothing at all when there is nothing to say.
  expect(explain("committed", surveyed(READY), GIT_OFF)).toBe(DETAIL.committed)
})

/** A push that git refused is git's own words, verbatim — the one thing about
 *  pushing a person cannot find out any other way from inside the app. And a
 *  push that worked leaves nothing on screen, because what is waiting is
 *  republished under it. */
test("a refused push says what git said, and a successful one says nothing", () => {
  const said = "! [rejected] master -> master (non-fast-forward)"
  expect(pushTrouble({ _tag: "Failed", said })).toBe(said)
  expect(pushTrouble({ _tag: "Pushed", upstream: "origin/master", commits: 2 })).toBe(null)
  expect(pushTrouble(null)).toBe(null)
  expect(pushTrouble({ _tag: "NothingToPush" })).toContain("already pushed")
  expect(pushTrouble({ _tag: "Blocked", repo: { _tag: "NoRepo" } }))
    .toContain("nowhere to commit to")
})

/** Every status a dirty file can have wears a word. A table, so a sixth one
 *  the format grew would be a compile error here rather than a blank chip
 *  beside somebody's file. */
test("every status a file can be in has a word", () => {
  for (const how of ["modified", "added", "deleted", "renamed", "untracked"] as const) {
    expect(HOW[how]).not.toBe("")
  }
})

/**
 * A dirty outline whose bytes moved with NO node moving still counts.
 *
 * The reviewer's reproduction: add a blank line to a `.olai` and the file is
 * dirty, listed, and committable, while `changes` is empty — so a tally of node
 * changes read zero and the pill said `committed` over a panel offering to
 * commit it. `outlines` exists precisely so that reformat is not invisible, and
 * the count has to agree with the list it is a count of.
 */
test("an outline that changed no node is still something waiting", () => {
  const reformatted: Pending = {
    ...NOTHING_PENDING,
    repo: READY,
    outlines: [{ file: "garden.olai", path: "garden.olai", how: "modified", from: null }],
    last: { sha: "abc", message: "olai: earlier", writer: "web", at: "" },
  }
  expect(waitingIn(reformatted)).toBe(1)
  expect(faceOf(reformatted, true, GIT_OFF)).toBe("waiting")

  // ... and it is counted ONCE when its nodes did move, rather than twice.
  const changed: Pending = {
    ...reformatted,
    changes: [{
      file: "garden.olai",
      id: "mint",
      title: "split the mint",
      fields: ["done"],
      sort: "done",
    }],
  }
  expect(waitingIn(changed)).toBe(1)

  // An outline that does not parse is its own row and is not double-counted
  // with the file it names either.
  const broken: Pending = { ...reformatted, unreadable: ["garden.olai"] }
  expect(waitingIn(broken)).toBe(1)

  // A clean tree is still clean, which is the other half of the fence.
  expect(waitingIn(NOTHING_PENDING)).toBe(0)
})
