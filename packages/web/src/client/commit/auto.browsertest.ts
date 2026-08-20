/**
 * The Auto-commit loop, wired to a Commit it can drive — the timer, the one
 * commit a flurry mints, and the stop.
 *
 * The `Commit` here is a stand-in built out of signals rather than the wire's:
 * what is under test is WHEN this file asks for a commit, and a real one would
 * put a server between the question and the answer. It follows the real one's
 * one composition — a recorded commit with Auto-push on is followed by the
 * push (`./record.ts`) — so "both preferences on" is a claim about the two
 * rules together rather than about a mock.
 *
 * The quiet window is handed in at a few milliseconds. The SPAN is a product
 * decision and is asserted where it is declared (`./flurry.test.ts`); what is
 * asserted here is that the window is waited out and that everything arriving
 * inside one starts it again.
 */

import type { Pending, PushResult } from "@olai/format"
import { NOTHING_PENDING } from "@olai/format"
import { GIT_OFF, type GitState } from "@olai/surface"
import { expect, test } from "bun:test"
import { type Accessor, createRoot, createSignal } from "solid-js"

import { createAuto } from "./auto.ts"
import { afterCommit } from "./record.ts"
import type { Attempt, Commit, PushAttempt } from "./state.ts"

const READY: GitState = { status: "repo", said: null }

/** One outline waiting, with `n` node changes in it — a flurry that grows. */
const waiting = (n: number): Pending => ({
  ...NOTHING_PENDING,
  repo: { _tag: "Ready", branch: "main" },
  outlines: [{ file: "garden.olai", path: "garden.olai", how: "modified", from: null }],
  changes: Array.from({ length: n }, (_, at) => ({
    file: "garden.olai",
    id: `node-${at}`,
    title: `row ${at}`,
    fields: ["title"] as ReadonlyArray<string>,
    sort: "title" as const,
  })),
})

const CLEAN: Pending = { ...NOTHING_PENDING, repo: { _tag: "Ready", branch: "main" } }

/** A Commit the test moves: what is waiting, what the two verbs answer, and a
 *  tally of how often each was asked for. */
interface Stub {
  readonly commit: Commit
  readonly edit: (n: number) => void
  readonly settle: () => void
  readonly commits: () => number
  readonly pushes: () => number
  readonly refuse: (said: string | null) => void
  readonly refusePush: (said: string | null) => void
}

const stub = (autoPush = false): Stub => {
  const [pending, setPending] = createSignal<Pending>(CLEAN)
  const [attempt, setAttempt] = createSignal<Attempt | null>(null)
  const [pushed, setPushed] = createSignal<PushAttempt | null>(null)
  const [working, setWorking] = createSignal(false)
  const [pushing, setPushing] = createSignal(false)
  let commits = 0
  let pushes = 0
  let refusal: string | null = null
  let pushRefusal: string | null = null

  const push = (): void => {
    pushes += 1
    setPushed(
      pushRefusal === null
        ? ({ _tag: "Pushed", upstream: "origin/main", commits: 1 } as PushResult)
        : ({ _tag: "Failed", said: pushRefusal } as PushResult),
    )
  }

  const commit: Commit = {
    pending,
    heard: () => true,
    git: () => READY,
    waiting: () => pending().changes.length,
    working,
    attempt,
    // The real one's shape: record, then follow with the push when this
    // browser asks for one (`./record.ts`).
    commit: () => {
      commits += 1
      const result: Attempt = refusal === null
        ? { _tag: "Committed", sha: "1a2b3c4", changes: 1, others: 0 }
        : { _tag: "Failed", said: refusal }
      setAttempt(result)
      if (refusal === null) setPending(CLEAN)
      afterCommit(autoPush, result._tag, push)
    },
    pushing,
    pushed,
    push,
  }

  return {
    commit,
    edit: (n) => setPending(waiting(n)),
    settle: () => {
      setWorking(false)
      setPushing(false)
    },
    commits: () => commits,
    pushes: () => pushes,
    refuse: (said) => {
      refusal = said
    },
    refusePush: (said) => {
      pushRefusal = said
    },
  }
}

const QUIET = 20

const rest = (ms: number): Promise<void> => new Promise((done) => setTimeout(done, ms))

/** One loop over one stand-in, disposed when the body is done — a Solid root is
 *  what a component's lifetime is. */
const loop = async (
  on: Accessor<boolean>,
  it: Stub,
  body: (auto: ReturnType<typeof createAuto>) => Promise<void>,
): Promise<void> => {
  let dispose = (): void => {}
  const auto = createRoot((stop) => {
    dispose = stop
    return createAuto({ on: on, alone: () => true, commit: it.commit, quiet: QUIET })
  })
  try {
    await body(auto)
  } finally {
    dispose()
  }
}

const ON: Accessor<boolean> = () => true

// ── the debounce ───────────────────────────────────────────────────────

test("a flurry of edits is ONE commit, not one per edit", async () => {
  const it = stub()
  await loop(ON, it, async () => {
    for (let n = 1; n <= 5; n += 1) {
      it.edit(n)
      await rest(QUIET / 2)
    }
    expect(it.commits()).toBe(0)
    await rest(QUIET * 3)
    expect(it.commits()).toBe(1)
  })
})

test("the quiet window is waited out, not answered on the edit", async () => {
  const it = stub()
  await loop(ON, it, async () => {
    it.edit(1)
    await rest(QUIET / 2)
    expect(it.commits()).toBe(0)
    await rest(QUIET * 3)
    expect(it.commits()).toBe(1)
  })
})

test("a clean tree is never committed, however long it stands", async () => {
  const it = stub()
  await loop(ON, it, async () => {
    await rest(QUIET * 3)
    expect(it.commits()).toBe(0)
  })
})

test("Auto-commit off leaves today's behaviour: nothing records itself", async () => {
  const it = stub()
  await loop(() => false, it, async () => {
    it.edit(1)
    await rest(QUIET * 3)
    expect(it.commits()).toBe(0)
  })
})

// ── with Auto-push ─────────────────────────────────────────────────────

test("both preferences on: the flurry is committed and then pushed", async () => {
  const it = stub(true)
  await loop(ON, it, async () => {
    it.edit(2)
    await rest(QUIET * 3)
    expect(it.commits()).toBe(1)
    expect(it.pushes()).toBe(1)
  })
})

test("Auto-commit alone records and leaves the commit unpushed", async () => {
  const it = stub(false)
  await loop(ON, it, async () => {
    it.edit(2)
    await rest(QUIET * 3)
    expect(it.commits()).toBe(1)
    expect(it.pushes()).toBe(0)
  })
})

// ── the stop ───────────────────────────────────────────────────────────

test("a commit git refused stops the loop and says so, and nothing retries", async () => {
  const it = stub()
  it.refuse("gpg failed to sign the data")
  await loop(ON, it, async (auto) => {
    it.edit(1)
    await rest(QUIET * 3)
    expect(it.commits()).toBe(1)
    expect(auto.paused()).toBe("gpg failed to sign the data")
    // The work is still waiting, and the loop does not go round again.
    it.edit(2)
    await rest(QUIET * 3)
    expect(it.commits()).toBe(1)
  })
})

test("a push git refused stops the loop too — the divergence is the conflict", async () => {
  const it = stub(true)
  it.refusePush("Updates were rejected (non-fast-forward)")
  await loop(ON, it, async (auto) => {
    it.edit(1)
    await rest(QUIET * 3)
    expect(it.commits()).toBe(1)
    expect(auto.paused()).toBe("Updates were rejected (non-fast-forward)")
    it.edit(2)
    await rest(QUIET * 3)
    expect(it.commits()).toBe(1)
  })
})

test("turning the preference off and on again is what resumes it", async () => {
  const it = stub()
  it.refuse("gpg failed to sign the data")
  const [on, setOn] = createSignal(true)
  await loop(on, it, async (auto) => {
    it.edit(1)
    await rest(QUIET * 3)
    expect(auto.paused()).not.toBe(null)
    setOn(false)
    expect(auto.paused()).toBe(null)
    it.refuse(null)
    setOn(true)
    it.edit(2)
    await rest(QUIET * 3)
    expect(it.commits()).toBe(2)
  })
})

test("a loop nobody armed keeps no pause, whatever a hand-pressed button did", async () => {
  const it = stub()
  it.refuse("gpg failed to sign the data")
  await loop(() => false, it, async (auto) => {
    it.commit.commit("by hand")
    await rest(QUIET)
    expect(auto.paused()).toBe(null)
  })
})

// ── one tab of this browser ────────────────────────────────────────────

test("a tab that is not the one recording keeps its hands off", async () => {
  const it = stub()
  let dispose = (): void => {}
  createRoot((stop) => {
    dispose = stop
    return createAuto({ on: ON, alone: () => false, commit: it.commit, quiet: QUIET })
  })
  try {
    it.edit(1)
    await rest(QUIET * 3)
    expect(it.commits()).toBe(0)
  } finally {
    dispose()
  }
})

// A page that has heard nothing, a repository that cannot take a commit, and a
// git that failed are three states the loop must not fire into. The pill wears
// each of them; the loop simply waits.
test("nothing is recorded into a repository that cannot take it", async () => {
  for (const git of [GIT_OFF, { status: "error", said: "no user.email" } as GitState]) {
    const it = stub()
    const held: Commit = { ...it.commit, git: () => git }
    let dispose = (): void => {}
    createRoot((stop) => {
      dispose = stop
      return createAuto({ on: ON, alone: () => true, commit: held, quiet: QUIET })
    })
    try {
      it.edit(1)
      await rest(QUIET * 3)
      expect(it.commits()).toBe(0)
    } finally {
      dispose()
    }
  }
})

