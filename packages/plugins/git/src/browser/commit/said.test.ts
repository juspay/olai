import { NOTHING_PENDING, type Pending, type RepoState } from "@olai/format"
import { GIT_OFF, type GitState } from "@olai/format"
import { expect, test } from "bun:test"

import {
  wroteOf,
  WHO,
  AUTO_PAUSED,
  AUTO_STOPPED,
  because,
  commitRefused,
  DETAIL,
  explain,
  faceOf,
  gitStatusOf,
  HOW,
  saysOf,
  isInert,
  isNews,
  LOCK_HELD,
  lockRefused,
  lockSays,
  localOf,
  FACE_TONE,
  readingOf,
  newsSays,
  unpushedIn,
  PUSH_REFUSED,
  scopeOf,
  unpushedOf,
  verbatim,
  waitingIn,
  willRecord,
} from "./said.ts"

const surveyed = (repo: RepoState, over: Partial<Pending> = {}): Pending => ({
  ...NOTHING_PENDING,
  repo,
  ...over,
})

const READY: RepoState = { _tag: "Ready", branch: "main" }

const git = (over: Partial<GitState> = {}): GitState => ({
  ...GIT_OFF,
  status: "repo",
  ...over,
})

const gitSaid = (said: string): GitState => git({ status: "error", said })

const stopped = (said: string): GitState => git({ paused: said })

const waiting = (count: number): Pending =>
  surveyed(READY, { unreadable: Array.from({ length: count }, (_, at) => `f${at}.olai`) })

const behind = (count: number): Pending =>
  surveyed(READY, { unpushed: { upstream: "origin/main", commits: count } })

test("a page that has not been told anything claims nothing about the directory", () => {
  expect(faceOf(surveyed(READY), false, GIT_OFF)).toBe("unknown")
})

test("the opt-out and the directory that is no work tree are told apart", () => {
  expect(faceOf(surveyed({ _tag: "Off" }), true, GIT_OFF)).toBe("off")
  expect(faceOf(surveyed({ _tag: "NoRepo" }), true, git({ status: "none" })))
    .toBe("no-repo")
})

test("a git that failed is NOT a directory without a repository", () => {
  const said = "fatal: detected dubious ownership in repository"
  const face = faceOf(surveyed({ _tag: "Unusable", said }), true, gitSaid(said))
  expect(face).toBe("error")
  expect(face).not.toBe("no-repo")
})

test("a commit git REFUSED reads as a fault, even though the directory looks fine", () => {
  const said = "fatal: unable to auto-detect email address"
  expect(faceOf(surveyed(READY), true, gitSaid(said))).toBe("error")
})

test("a serve that never asks git cannot report a git fault", () => {
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

test("the two settings and the page that has not heard are quiet, and cannot be pressed", () => {
  for (const face of ["unknown", "off", "no-repo"] as const) {
    expect(FACE_TONE[face]).toBe("quiet")
    expect(isInert(face)).toBe(true)
  }
})

test("every face has its one tone", () => {
  expect(FACE_TONE).toEqual({
    unknown: "quiet",
    off: "quiet",
    "no-repo": "quiet",
    error: "alarm",
    blocked: "notice",
    waiting: "notice",
    committed: "healthy",
    never: "healthy",
  })
})

test("the row wears a tone for writes waiting, and the riders move it", () => {
  const cases = [
    ["waiting", waiting(2), git(), "notice"],
    ["committed", behind(2), git(), "notice"],
    ["committed", behind(1), git({ pushSaid: "rejected" }), "alarm"],
    ["waiting", waiting(1), stopped("conflict"), "alarm"],
    ["error", surveyed(READY), gitSaid("fatal: nope"), "alarm"],
    ["never", surveyed(READY), git(), "healthy"],
  ] as const
  for (const [face, pending, state, tone] of cases) {
    const row = readingOf(face, pending, state)
    expect(row.tone).toBe(tone)
    expect(gitStatusOf(face, pending, state)).toEqual({
      tone,
      label: [row.says, ...row.riders].join(" · "),
      detail: row.detail,
    })
  }
})

test("the fault is reachable, because its whole point is the reason on it", () => {
  expect(isInert("error")).toBe(false)
})

test("a phone only interrupts the page when git has news", () => {
  const quiet = surveyed(READY)
  for (const face of ["committed", "never", "off", "no-repo", "unknown"] as const) {
    expect(isNews(face, quiet, git())).toBe(false)
  }
  for (const face of ["waiting", "blocked", "error"] as const) {
    expect(isNews(face, quiet, git())).toBe(true)
  }
  expect(isNews("committed", behind(3), git())).toBe(true)
})

test("the phone banner is one line, and waiting outranks unpushed", () => {
  expect(newsSays("waiting", waiting(6), git())).toBe("6 uncommitted — tap to record")
  expect(newsSays("blocked", waiting(2), git())).toBe("2 uncommitted — repository busy")
  expect(newsSays("error", surveyed(READY), git())).toBe("Git error — tap to see")
  expect(newsSays("committed", behind(3), git())).toBe("3 unpushed — tap to push")
  expect(newsSays("committed", surveyed(READY), git())).toBe("")
})

test("a stopped loop reaches a reader on every face, healthy ones included", () => {
  const said = "gpg failed to sign the data"
  for (const face of ["committed", "never", "waiting", "error", "blocked"] as const) {
    expect(explain(face, surveyed(READY), stopped(said))).toContain(said)
  }
  expect(explain("committed", surveyed(READY), git()))
    .toBe(explain("committed", surveyed(READY), GIT_OFF))
})

test("the sentence a stopped loop leaves names Resume, on both sentences", () => {
  const said = explain("committed", surveyed(READY), stopped("no upstream"))
  expect(said).toContain("Resume")
  expect(said).not.toContain("off and on again")
  expect(AUTO_STOPPED).toContain("Resume")
  expect(AUTO_STOPPED).not.toContain("off and on again")
  expect(said).toContain("no upstream")
  expect(AUTO_STOPPED).toContain("Git's message is below")
})

test("a phone is interrupted by a stopped loop, on a face that is otherwise quiet", () => {
  expect(isNews("committed", surveyed(READY), git())).toBe(false)
  expect(isNews("committed", surveyed(READY), stopped("no upstream"))).toBe(true)
  expect(isNews("never", surveyed(READY), stopped("no upstream"))).toBe(true)
})

test("the banner says the loop stopped ahead of whatever else is true", () => {
  expect(newsSays("waiting", waiting(6), stopped("no upstream"))).toContain(AUTO_PAUSED)
  expect(newsSays("committed", surveyed(READY), stopped("no upstream")))
    .toContain(AUTO_PAUSED)
  expect(newsSays("waiting", waiting(6), git())).toBe("6 uncommitted — tap to record")
})

test("a stopped loop on a phone still says how much is waiting", () => {
  expect(newsSays("waiting", waiting(6), stopped("no upstream"))).toContain("6 uncommitted")
  expect(newsSays("waiting", waiting(6), stopped("no upstream"))).toContain(AUTO_PAUSED)
  expect(newsSays("committed", surveyed(READY), stopped("no upstream")))
    .toBe(`${AUTO_PAUSED} — tap to see`)
})

test("a git failure hands over git's own words", () => {
  const said = "fatal: detected dubious ownership in repository at '/srv/notes'"
  expect(explain("error", surveyed(READY), gitSaid(said))).toContain(said)
  expect(
    explain("error", surveyed({ _tag: "Unusable", said }), git({ status: "error" })),
  ).toContain(said)
  expect(commitRefused(gitSaid(said))).toBe(said)
  expect(commitRefused(git())).toBe(null)
})

test("a fault that arrived with nothing to say still reads as a sentence", () => {
  expect(explain("error", surveyed(READY), git({ status: "error", said: "" })))
    .toBe(DETAIL.error)
})

test("a lock file in the way reads as olai's sentence, aged only where a clock is", () => {
  const now = 1_760_000_000_000
  const left = { since: now - 12 * 60_000 }
  const stopped = git({
    status: "error",
    said: "fatal: Unable to create '/srv/notes/.git/index.lock': File exists.",
    lock: left,
  })

  expect(lockSays(left.since, now)).toBe(
    "A git lock file is in the way (left 12m ago). " +
      "If no git command is running, remove it and retry.",
  )
  expect(explain("error", surveyed(READY), stopped))
    .toBe("A git lock file is in the way. If no git command is running, remove it and retry.")

  expect(lockRefused(stopped)).toEqual(left)
  expect(lockRefused(git({ status: "error", said: "fatal: gpg failed" }))).toBe(null)
  expect(explain("error", surveyed(READY), gitSaid("fatal: gpg failed")))
    .toContain("fatal: gpg failed")
})

test("the answer when the lock is too young to remove says git may still be writing it", () => {
  expect(LOCK_HELD).toBe("A git process may still be writing; try again in a moment.")
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
  expect(explain("blocked", busy, GIT_OFF)).toContain("A rebase is in progress")
})

test("a state with nothing to quote reads as its own sentence", () => {
  expect(explain("no-repo", surveyed({ _tag: "NoRepo" }), GIT_OFF)).toBe(DETAIL["no-repo"])
  expect(explain("never", surveyed(READY), GIT_OFF)).toBe(DETAIL.never)
})

test("the panel's line about a broken git is not the line about an absent one", () => {
  const said = "fatal: detected dubious ownership in repository"
  expect(because({ _tag: "Unusable", said })).toContain("couldn't read this folder")
  expect(verbatim({ _tag: "Unusable", said })).toBe(said)
  expect(because({ _tag: "NoRepo" })).toBe("There is nowhere to commit to")
})

test("the scope line says which part of the repository olai serves", () => {
  expect(scopeOf("docs/")).toBe("Whole repository · olai shows docs/")
  expect(scopeOf("")).toBe("Whole repository")
  expect(scopeOf("")).not.toEndWith("shows ")
})

test("a rename's other half is shortened to the served spelling, and only there", () => {
  expect(localOf("docs/a.olai", "docs/")).toBe("a.olai")
  expect(localOf("a.olai", "")).toBe("a.olai")
  expect(localOf("README.md", "docs/")).toBe("README.md")
  expect(localOf("docsy/a.olai", "docs/")).toBe("docsy/a.olai")
  expect(localOf(null, "docs/")).toBe(null)
})

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

test("the sentence says what is unpushed, whichever face is worn", () => {
  const shared: Pending = {
    ...NOTHING_PENDING,
    repo: READY,
    unpushed: { upstream: "origin/master", commits: 3 },
  }
  expect(explain("committed", shared, GIT_OFF)).toContain("3 commits not on origin/master")
  expect(explain("waiting", shared, GIT_OFF)).toContain("3 commits not on origin/master")
  expect(explain("committed", surveyed(READY), GIT_OFF)).toBe(DETAIL.committed)
})

test("a refused push says what git said, and a successful one says nothing", () => {
  const said = "! [rejected] master -> master (non-fast-forward)"
  expect(git({ pushSaid: said }).pushSaid).toBe(said)
  expect(git().pushSaid).toBeNull()
})

test("a failing push turns the pill to alarm, whatever the face is saying", () => {
  const said = "! [rejected] master -> master (non-fast-forward)"
  expect(readingOf("committed", surveyed(READY), git()).tone).toBe("healthy")
  expect(readingOf("committed", surveyed(READY), git({ pushSaid: said }))).toMatchObject({
    tone: "alarm",
    riders: [PUSH_REFUSED],
  })
  expect(readingOf("waiting", waiting(1), git()).tone).toBe("notice")
  expect(readingOf("waiting", waiting(1), git({ pushSaid: said })).tone).toBe("alarm")
})

test("the sentence says the push was refused, and hands over git's words", () => {
  const said = "! [rejected] master -> master (non-fast-forward)"
  const shared: Pending = {
    ...NOTHING_PENDING,
    repo: READY,
    unpushed: { upstream: "origin/master", commits: 13 },
    last: { sha: "abc", message: "olai: earlier", writer: "auto", at: "" },
  }
  const sentence = explain("committed", shared, git({ pushSaid: said }))
  expect(sentence).toContain("13 commits not on origin/master")
  expect(sentence).toContain(PUSH_REFUSED)
  expect(sentence).toContain(said)
})

test("a phone is interrupted by a refused push, and the banner says which", () => {
  const said = "! [rejected] master -> master (non-fast-forward)"
  expect(isNews("committed", surveyed(READY), git({ pushSaid: said }))).toBe(true)
  expect(newsSays("committed", behind(13), git({ pushSaid: said })))
    .toContain(PUSH_REFUSED)
  expect(newsSays("committed", behind(13), git())).toBe("13 unpushed — tap to push")
})

test("every status a file can be in has a word", () => {
  for (const how of ["modified", "added", "deleted", "renamed", "untracked"] as const) {
    expect(HOW[how]).not.toBe("")
  }
})

test("an outline that changed no node is still something waiting", () => {
  const reformatted: Pending = {
    ...NOTHING_PENDING,
    repo: READY,
    outlines: [{ file: "garden.olai", path: "garden.olai", how: "modified", from: null }],
    last: { sha: "abc", message: "olai: earlier", writer: "web", at: "" },
  }
  expect(waitingIn(reformatted)).toBe(1)
  expect(faceOf(reformatted, true, GIT_OFF)).toBe("waiting")

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

  const broken: Pending = { ...reformatted, unreadable: ["garden.olai"] }
  expect(waitingIn(broken)).toBe(1)

  expect(waitingIn(NOTHING_PENDING)).toBe(0)
})

test("a refusal that stopped the loop is quoted once, not twice", () => {
  const words = "! [rejected] main -> main (fetch first)"
  const shared: Pending = {
    ...NOTHING_PENDING,
    repo: READY,
    unpushed: { upstream: "origin/main", commits: 2 },
    last: { sha: "abc", message: "olai: earlier", writer: "auto", at: "" },
  }
  const sentence = explain(
    "committed",
    shared,
    git({ pushSaid: words, paused: words }),
  )
  expect(sentence.split(words)).toHaveLength(2)
  expect(sentence).toContain("Auto-commit is paused")
  expect(sentence).toContain("Resume")
  expect(explain("committed", surveyed(READY), stopped(words))).toContain(words)
})

test("the panel promises to record only what there is to record", () => {
  const windowed = git({ policy: { commit: "auto", push: "off" } })
  expect(willRecord(waiting(2), windowed)).toBe(true)
  expect(willRecord(surveyed(READY), windowed)).toBe(false)
  expect(willRecord(waiting(2), git())).toBe(false)
  expect(willRecord(waiting(2), { ...windowed, paused: "no upstream" })).toBe(false)
  expect(willRecord(
    surveyed({ _tag: "Blocked", reason: "rebase", said: "" }, {
      unreadable: ["garden.olai"],
    }),
    windowed,
  )).toBe(false)
})

test("the move names its own writer and counts writes", () => {
  expect(WHO.move).toBe("olai moved chats onto their notes")
  expect(wroteOf("move", 1)).toBe("olai moved chats onto their notes · 1 write")
  expect(wroteOf("move", 3)).toBe("olai moved chats onto their notes · 3 writes")
  expect(WHO.auto).toBe("auto-commit")
})

test("the retired filer still has a sentence, in the past tense", () => {
  expect(WHO.filer).toBe("olai filed conversations into the Inbox")
  expect(WHO.filer).toContain("filed")
  expect(wroteOf("filer", 2)).toBe("olai filed conversations into the Inbox 2")
})

test("no repository and commits off are quiet: they never colour the dot", () => {
  const none = surveyed({ _tag: "NoRepo" })
  expect(gitStatusOf("no-repo", none, git({ status: "none" }))).toMatchObject({ tone: "quiet", label: "Not a git folder" })
  expect(gitStatusOf("off", surveyed({ _tag: "Off" }), GIT_OFF)).toMatchObject({ tone: "quiet", label: "Commits off" })
})

test("committed is healthy, writes waiting and unpushed commits are a notice", () => {
  expect(gitStatusOf("committed", surveyed(READY), git()).tone).toBe("healthy")
  expect(gitStatusOf("waiting", waiting(3), git())).toMatchObject({ tone: "notice", label: "3 uncommitted" })
  expect(gitStatusOf("committed", behind(2), git())).toMatchObject({ tone: "notice", label: "Committed · 2 unpushed" })
})

test("a git error, a refused push and a paused loop are alarms, in the row's own words", () => {
  expect(gitStatusOf("error", surveyed(READY), gitSaid("fatal: nope")).tone).toBe("alarm")
  expect(gitStatusOf("committed", behind(1), git({ pushSaid: "rejected" })))
    .toMatchObject({ tone: "alarm", label: `Committed · 1 unpushed · ${PUSH_REFUSED}` })
  expect(gitStatusOf("waiting", waiting(1), stopped("conflict")))
    .toMatchObject({ tone: "alarm", label: `1 uncommitted · ${AUTO_PAUSED}` })
})

test("the status's words are the row's words, and its sentence is the row's tip", () => {
  const pending = waiting(2)
  expect(saysOf("waiting", 2)).toBe("2 uncommitted")
  expect(gitStatusOf("waiting", pending, git()).detail).toBe(explain("waiting", pending, git()))
})

test("every face lands on the dot's tone its argument names", () => {
  expect(gitStatusOf("unknown", NOTHING_PENDING, GIT_OFF)).toMatchObject({ tone: "quiet", label: "…" })
  expect(gitStatusOf("never", surveyed(READY), git())).toMatchObject({ tone: "healthy", label: "No commits yet" })
  expect(gitStatusOf("committed", surveyed(READY), git())).toMatchObject({ tone: "healthy", label: "Committed" })
  const busy = surveyed({ _tag: "Blocked", reason: "merge", said: "" }, { unreadable: ["garden.olai"] })
  expect(gitStatusOf("blocked", busy, git())).toMatchObject({ tone: "notice", label: "1 uncommitted" })
  expect(gitStatusOf("error", surveyed(READY), gitSaid("fatal: nope")))
    .toMatchObject({ tone: "alarm", label: "Git error" })
})

test("a rider outranks a healthy face: a stopped loop over a clean tree is an alarm", () => {
  expect(gitStatusOf("committed", surveyed(READY), stopped("no upstream")))
    .toMatchObject({ tone: "alarm", label: `Committed · ${AUTO_PAUSED}` })
  expect(gitStatusOf("never", surveyed(READY), git({ pushSaid: "rejected" })))
    .toMatchObject({ tone: "alarm", label: `No commits yet · ${PUSH_REFUSED}` })
  expect(gitStatusOf("never", behind(1), git()))
    .toMatchObject({ tone: "notice", label: "No commits yet · 1 unpushed" })
})
