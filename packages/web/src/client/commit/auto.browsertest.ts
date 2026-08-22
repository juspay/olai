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
import { NO_PIN, NOTHING_PENDING } from "@olai/format"
import { GIT_OFF, type GitState } from "@olai/surface"
import { expect, test } from "bun:test"
import { type Accessor, createRoot, createSignal } from "solid-js"

import { type Auto, createAuto, pausedIn } from "./auto.ts"
import { createPause } from "./pause.ts"
import { afterCommit } from "./record.ts"
import type { Attempt, Commit, PushAttempt } from "./state.ts"

/** What a healthy repository publishes. A FUNCTION rather than a constant,
 *  because the point of {@link Stub.sweep} is a frame carrying a NEW object
 *  that says exactly what the last one did — which is what the server's
 *  thirty-second sweep puts on the wire (`server/runtime.ts`). */
const ready = (): GitState => ({ status: "repo", said: null, pinned: NO_PIN })

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
    sort: "renamed" as const,
  })),
})

const CLEAN: Pending = { ...NOTHING_PENDING, repo: { _tag: "Ready", branch: "main" } }

/** A Commit the test moves: what is waiting, what the two verbs answer, and a
 *  tally of how often each was asked for. */
interface Stub {
  readonly commit: Commit
  readonly edit: (n: number) => void
  /** Republish what is waiting with the COUNTERS moved and the work untouched
   *  — what a landed commit or push looks like from the browser. */
  readonly count: () => void
  /** Republish WHAT GIT IS DOING, unchanged — the server's thirty-second sweep,
   *  which recomputes the same answer and sets the cell again. */
  readonly sweep: () => void
  /** ... and the same cell saying something NEW: a commit git refused, which
   *  the server remembers and publishes and no probe of the directory can
   *  see. */
  readonly fault: (said: string) => void
  readonly commits: () => number
  readonly pushes: () => number
  readonly refuse: (said: string | null) => void
  readonly refusePush: (said: string | null) => void
}

const stub = (autoPush = false): Stub => {
  const [pending, setPending] = createSignal<Pending>(CLEAN)
  const [git, setGit] = createSignal<GitState>(ready())
  const [attempt, setAttempt] = createSignal<Attempt | null>(null)
  const [pushed, setPushed] = createSignal<PushAttempt | null>(null)
  // Never move: this stand-in answers both verbs synchronously, so nothing is
  // ever in flight when the loop looks.
  const idle = (): boolean => false
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
    git,
    waiting: () => pending().changes.length,
    working: idle,
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
    pushing: idle,
    pushed,
    push,
  }

  return {
    commit,
    edit: (n) => setPending(waiting(n)),
    sweep: () => setGit(ready()),
    fault: (said) => setGit({ status: "error", said, pinned: NO_PIN }),
    count: () =>
      setPending((was) => ({
        ...was,
        wrote: [{ writer: "web", ops: was.wrote.length + 1 }],
        unpushed: { upstream: "origin/main", commits: was.wrote.length + 1 },
      })),
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
  body: (auto: Accessor<Auto>) => Promise<void>,
  /** The two things a test moves about the loop's SURROUNDINGS rather than
   *  about the flurry: whether this is the tab that records, and a Commit
   *  answering from a repository nothing can be committed to. */
  around: { alone?: Accessor<boolean>; commit?: Commit } = {},
): Promise<void> => {
  let dispose = (): void => {}
  const auto = createRoot((stop) => {
    dispose = stop
    return createAuto({
      on,
      alone: around.alone ?? (() => true),
      commit: around.commit ?? it.commit,
      quiet: QUIET,
      // ITS OWN pause (`./pause.ts`). The app's is a module-level value,
      // because the Resume button that clears it is on the preferences panel
      // while the loop is on the header's pill — which in one test process
      // would carry a refusal from one case straight into the next.
      pause: createPause(),
    })
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
    expect(pausedIn(auto())).toBe("gpg failed to sign the data")
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
    expect(pausedIn(auto())).toBe("Updates were rejected (non-fast-forward)")
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
    expect(pausedIn(auto())).not.toBe(null)
    setOn(false)
    expect(pausedIn(auto())).toBe(null)
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
    expect(pausedIn(auto())).toBe(null)
  })
})

// ── one tab of this browser ────────────────────────────────────────────

test("a tab that is not the one recording keeps its hands off", async () => {
  const it = stub()
  await loop(ON, it, async () => {
    it.edit(1)
    await rest(QUIET * 3)
    expect(it.commits()).toBe(0)
  }, { alone: () => false })
})

// A page that has heard nothing, a repository that cannot take a commit, and a
// git that failed are three states the loop must not fire into. The pill wears
// each of them; the loop simply waits.
test("nothing is recorded into a repository that cannot take it", async () => {
  for (const git of [GIT_OFF, { status: "error", said: "no user.email", pinned: NO_PIN } as GitState]) {
    const it = stub()
    await loop(ON, it, async (auto) => {
      it.edit(1)
      await rest(QUIET * 3)
      expect(it.commits()).toBe(0)
      // ... and the panel's promise is not made either: the value says the
      // loop would NOT record, which is the one gate both read.
      const state = auto()
      expect(state._tag === "armed" && state.willRecord).toBe(false)
    }, { commit: { ...it.commit, git: () => git } })
  }
})

/**
 * THE SWEEP, which is the second way a frame arrives saying nothing new.
 *
 * The server recomputes what git is doing every thirty seconds whether or not
 * anything moved, and publishes it — so a healthy repository puts a fresh
 * `{ status: "repo" }` on the wire twice a minute. A window that restarted on
 * one would wait fifteen seconds from the last SWEEP rather than from the last
 * edit, which is not what the preference, the hint or `docs/git.md` promise.
 */
test("the git sweep does not start the window again", async () => {
  const it = stub()
  await loop(ON, it, async () => {
    it.edit(1)
    await rest(QUIET * 0.7)
    it.sweep()
    await rest(QUIET * 0.7)
    expect(it.commits()).toBe(1)
  })
})

// The other half of the same memo, and the half it must NOT swallow: the cell
// saying something new is a reason to hold off, and it takes effect inside the
// window rather than at the end of it. A git that refuses every commit is the
// state a probe of the directory cannot see at all.
test("a git that goes wrong inside the window disarms the loop", async () => {
  const it = stub()
  await loop(ON, it, async (auto) => {
    it.edit(1)
    await rest(QUIET * 0.5)
    it.fault("no user.email")
    await rest(QUIET * 2)
    expect(it.commits()).toBe(0)
    const state = auto()
    expect(state._tag === "armed" && state.willRecord).toBe(false)
  })
})

// The memo's whole job: a frame that moves the counters and not the work must
// not start the window again. Without it a repository that is pushed to often
// enough would never reach the end of one.
test("a frame that is not an edit does not start the window again", async () => {
  const it = stub()
  await loop(ON, it, async () => {
    it.edit(1)
    await rest(QUIET * 0.7)
    it.count()
    await rest(QUIET * 0.7)
    expect(it.commits()).toBe(1)
  })
})

