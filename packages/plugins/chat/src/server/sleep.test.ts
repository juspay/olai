/**
 * THE PASS, over a real chat scheduler and a real ACP subprocess.
 *
 * What is exercised is the pass's own judgement — who is a candidate, what a
 * finished turn writes, and what happens to a turn nobody is watching — and the
 * seam is the doors it is handed (`./sleep.ts`'s `Sleeping`). The write and the
 * commit are recorded rather than performed: what a commit LOOKS like is
 * `olai-plugin-git`'s business and is asserted where it lives, in that row's
 * own window tests and in `node_agent_sleeps.feature`.
 */
import type { NodeAgent, NodeAgents, OpFailure, WriteRequest } from "@olai/format"
import { UsageFailure } from "@olai/format"
import { readingOf, setOf } from "@olai/format/testlib"
import { afterEach, beforeEach, expect, test } from "bun:test"
import { Duration, Effect, Exit, Fiber, Scope } from "effect"
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import type { Installed } from "../agents/roster.ts"
import { seated } from "../agents/roster.testlib.ts"
import { QUEUES } from "../agents/legs.testlib.ts"
import type { Chat, LiveSession } from "../scoped.ts"
import { make } from "../scoped.ts"
import type { Sleeping } from "./sleep.ts"
import { makeSleeper } from "./sleep.ts"

const FIXTURE = join(import.meta.dirname, "..", "fixtures", "sleep-agent.ts")

const run = <A, E>(effect: Effect.Effect<A, E>): Promise<A> => Effect.runPromise(effect)

const installed = (id: string): Installed => ({
  id,
  name: id,
  adapter: { command: process.execPath, args: [FIXTURE] },
  leg: QUEUES,
  prompt: { kind: "first-turn" },
})

/** One node agent, bound to a session this fixture answers `session/load` for. */
const agent = (id: string, session: string | null, over: Partial<NodeAgent> = {}): NodeAgent => ({
  id,
  file: "Work.olai",
  title: id === "health" ? "Health" : id,
  engine: "claude",
  session,
  memory: 3,
  ...over,
})

/** The vault the pass reads: a stamped row under each node, so every node
 *  agent in these fixtures has memory that has moved and something to sleep
 *  over. */
const VAULT = {
  "Work.olai": [
    `{"id":"health","ord":"a0","title":"Health"}`,
    `{"id":"note","parent":"health","ord":"a0","title":"sleep was fine","changed":"2026-10-01T09:00:00+00:00"}`,
    `{"id":"shipping","ord":"a1","title":"Shipping"}`,
    `{"id":"ship-note","parent":"shipping","ord":"a0","title":"late again","changed":"2026-10-01T09:00:00+00:00"}`,
  ].join("\n") + "\n",
  // A CHILD OF `health` IN ANOTHER FILE, because a subtree is matched by id
  // across the corpus and can span files: the pass's commit must name every
  // file its memory lives in, not just the node's own.
  "Archive.olai": `{"id":"old-note","parent":"health","ord":"a0","title":"the old rows","changed":"2026-10-01T09:00:00+00:00"}\n`,
}

/**
 * WHAT THE LEDGER WOULD SAY IS WAITING — in the two names each file has, and
 * deliberately in a SERVED SUBDIRECTORY: the pass knows files by their served
 * names and a commit request takes them as git does, so a test that made the two
 * spellings equal would prove nothing about the mapping.
 *
 * `Notes.olai` is a person's own file, waiting and NOT part of the memory — the
 * one that must not end up in the commit.
 */
const WAITING = [
  { file: "Work.olai", path: "docs/Work.olai" },
  { file: "Archive.olai", path: "docs/Archive.olai" },
  { file: "Notes.olai", path: "docs/Notes.olai" },
]

const reading = () => Effect.succeed(readingOf(setOf(VAULT)))

/** WHICH NODES THE PASS WROTE TO, asked of the door's own union rather than
 *  asserted into one: `prop` is the only arm this pass ever uses. */
const passedThrough = (writes: ReadonlyArray<WriteRequest>): ReadonlyArray<string> =>
  writes.flatMap((one) => one.op === "prop" ? [one.id] : [])

interface Bench {
  readonly chat: Chat
  readonly nodes: () => NodeAgents
  /** Every `prop` the pass asked for, in order. */
  /** Every `prop` the pass asked for, in order — the door's own union, so a
   *  reader is told which arm each one is. */
  readonly writes: ReadonlyArray<WriteRequest>
  /** Every commit the pass asked for, in order: the message and the paths it
   *  named. */
  readonly commits: ReadonlyArray<{ readonly message: string; readonly paths: ReadonlyArray<string> }>
  /** Every line the pass said at the operator's level. */
  readonly warnings: Array<string>
  /** WHAT THE PASS DID, IN ORDER — the seam's own account of itself, which is
   *  what the ordering claims are about: the hold spans the turn and the commit,
   *  and the delivery is withdrawn when the pass stops being there. */
  readonly events: Array<string>
  /** One pass of the loop, as the case under test drives it. */
  readonly tick: Effect.Effect<boolean>
  readonly marker: (name: string) => void
  readonly marked: (name: string) => boolean
}

let cwd = ""
const wasState = process.env["XDG_STATE_HOME"]

beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), "olai-sleep-"))
  process.env["XDG_STATE_HOME"] = cwd
})

afterEach(() => {
  if (wasState === undefined) delete process.env["XDG_STATE_HOME"]
  else process.env["XDG_STATE_HOME"] = wasState
  rmSync(cwd, { recursive: true, force: true })
})

/** Wait for a marker the fixture writes, or fail loudly — the pass's own
 *  progress is asynchronous, so every assertion about it is a wait. */
const until = async (what: string, ready: () => boolean, ms = 10_000): Promise<void> => {
  const deadline = Date.now() + ms
  while (Date.now() < deadline) {
    if (ready()) return
    await run(Effect.sleep("20 millis"))
  }
  throw new Error(`waited ${ms}ms for ${what} and it never happened`)
}

const withBench = async (
  over: {
    readonly nodes?: NodeAgents
    readonly sleptAt?: (node: string) => string | null
    readonly live?: () => ReadonlyMap<string, LiveSession>
    /** Milliseconds — the point of the overwrite is a test that cannot wait. */
    readonly after?: number
    /** The write door, for the case where the vault refuses the memo. */
    readonly write?: (request: WriteRequest) => Effect.Effect<unknown, OpFailure>
    /** The delivery door, for the case where the turn is never handed over at
     *  all — the one that leaves a body waiting somewhere. */
    readonly deliver?: (to: { readonly agent: string; readonly session: string }) => Effect.Effect<void>
    /** How long a turn may take to start, in milliseconds, for the test that
     *  wants that deadline reached. */
    readonly start?: number
  },
  body: (bench: Bench) => Promise<void>,
): Promise<void> => {
  const nodes = over.nodes ?? [agent("health", "sess-1")]
  const writes: Array<WriteRequest> = []
  const commits: Array<{ message: string; paths: ReadonlyArray<string> }> = []
  const warnings: Array<string> = []
  const events: Array<string> = []
  const chat = await run(make({
    // THE BENCH'S OWN RUNTIME, said out loud: `Options.fork` has no default.
    fork: (work) => Effect.runFork(work),
    roster: () => [seated(installed("claude"))],
    cwd,
    tools: () => null,
    nodes: () => nodes,
    nodeAt: (id) => nodes.find((one) => one.id === id) ?? null,
    seatableAt: (id) => nodes.some((one) => one.id === id),
    agentAt: ({ agent: engine, session }) =>
      nodes.find((one) => one.engine === engine && one.session === session) ?? null,
    wake: () => undefined,
    nearestAt: (id, candidates) => candidates.has(id) ? id : null,
    ticket: (node) => ({ bearer: `ticket-${node}`, release: () => {} }),
    onState: () => {},
    onTranscript: () => {},
  }))
  const scope = Scope.makeUnsafe()
  try {
    await run(chat.start)
    const sleeper = await run(Effect.provideService(makeSleeper({
      nodes: () => nodes,
      sleptAt: over.sleptAt ?? (() => null),
      sleptKey: () => "chat-agent-slept",
      live: over.live ?? (() => chat.live()),
      deliver: (to, say) => over.deliver === undefined
        ? Effect.tap(
          chat.doorFor("sleep").deliver(to, say),
          () => Effect.sync(() => void events.push("delivered")),
        )
        : over.deliver(to),
      withdraw: () => Effect.sync(() => void events.push("withdrawn")),
      watch: (to, observer) => chat.reading(to, observer),
      read: reading(),
      write: over.write ?? ((request) => Effect.sync(() => {
        writes.push(request)
        return {}
      })),
      waiting: Effect.succeed(WAITING),
      commit: (message, paths) => Effect.sync(() => {
        events.push("committed")
        commits.push({ message, paths })
        return null
      }),
      // THE HOLD, AS AN ACQUISITION — so the order it is taken and released in
      // is a thing this bench can assert rather than a thing it assumes.
      hold: Effect.acquireRelease(
        Effect.sync(() => void events.push("hold")),
        () => Effect.sync(() => void events.push("released")),
      ),
      after: Duration.millis(over.after ?? 0),
      // THE LOOP ITSELF IS NOT WHAT IS UNDER TEST: every case drives `tick` by
      // hand, so the fork sleeps for as long as the test could possibly run.
      tick: Duration.minutes(10),
      question: Duration.millis(400),
      start: Duration.millis(over.start ?? 5_000),
      log: () => Effect.void,
      warn: (line) => Effect.sync(() => void warnings.push(line)),
    }), Scope.Scope, scope))
    await body({
      chat,
      nodes: () => nodes,
      writes,
      commits,
      warnings,
      events,
      // THE BENCH'S OWN SCOPE, so a pass driven by hand runs (and is stopped)
      // with the bench rather than in a scope nobody owns.
      tick: Effect.provideService(sleeper.tick, Scope.Scope, scope),
      marker: (name) => writeFileSync(join(cwd, name), ""),
      marked: (name) => existsSync(join(cwd, name)),
    })
  } finally {
    await run(Scope.close(scope, Exit.void))
    await run(chat.stop)
  }
}

test("a finished pass writes the memo and then commits it", async () => {
  await withBench({}, async (bench) => {
    expect(await run(bench.tick)).toBe(true)
    // The subprocess was really prompted, which is what makes the rest of this
    // an assertion about a turn rather than about a state machine.
    expect(bench.marked(".sleep-asked")).toBe(true)
    expect(bench.writes).toEqual([{
      op: "prop",
      id: "health",
      key: "chat-agent-slept",
      value: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/),
    }])
    // THE COMMIT NAMES THE FILES THAT MEMORY LIVES IN — both of them, in git's
    // spelling — and leaves the person's own waiting file exactly where it was.
    expect(bench.commits).toEqual([{
      message: "sleep: Health",
      paths: ["docs/Work.olai", "docs/Archive.olai"],
    }])
    expect(bench.warnings).toEqual([])
    // ... and the pass left the conversation idle rather than holding it open.
    expect(bench.chat.live().get("health")?.status).toBe("idle")
    // THE HOLD SPANS THE WHOLE PASS: taken before the turn is handed over,
    // released only after the memo has been committed — which is the one thing
    // that makes the commit the pass's own rather than the quiet window's. The
    // withdrawal comes between them because a scope's finalizers run in the
    // reverse of the order they were registered.
    expect(bench.events).toEqual(["hold", "delivered", "committed", "withdrawn", "released"])
  })
})

test("the memo is what keeps a quiet node from sleeping again", async () => {
  await withBench({ sleptAt: () => "2099-01-01T00:00:00+00:00" }, async (bench) => {
    expect(await run(bench.tick)).toBe(false)
    expect(bench.marked(".sleep-asked")).toBe(false)
  })
})

test("an unbound node, a working one and one with a question are left alone", async () => {
  await withBench({ nodes: [agent("health", null)] }, async (bench) => {
    expect(await run(bench.tick)).toBe(false)
  })
  // A CONVERSATION THAT IS UP IS NOT ASLEEP: working, booting and a question
  // are all somebody's business, and the last one is not a person's to answer
  // only because this pass suppresses the alert.
  for (const standing of [
    { status: "thinking" as const, asking: 0 },
    { status: "idle" as const, asking: 1 },
    { status: "booting" as const, asking: 0 },
    { status: "gone" as const, asking: 0 },
  ]) {
    await withBench(
      { live: () => new Map([["health", { ...standing, since: "2026-01-01T00:00:00.000Z" }]]) },
      async (bench) => {
        expect(await run(bench.tick)).toBe(false)
      },
    )
  }
})

test("a node that has not been left alone long enough waits", async () => {
  await withBench(
    {
      after: Duration.toMillis(Duration.hours(1)),
      live: () => new Map([["health", {
        status: "idle" as const,
        asking: 0,
        since: new Date().toISOString(),
      }]]),
    },
    async (bench) => {
      expect(await run(bench.tick)).toBe(false)
    },
  )
})

test("one pass sleeps one node, and the next waits its turn", async () => {
  // TWO CANDIDATES AND ONE WRITE is the whole of "one at a time": the loop
  // takes its pass a tick rather than a node, so a second sleeping agent is
  // never a second turn in the same breath.
  const slept = new Set<string>()
  await withBench(
    {
      nodes: [agent("health", "sess-1"), agent("shipping", "sess-2")],
      sleptAt: (node) => slept.has(node) ? "2099-01-01T00:00:00+00:00" : null,
    },
    async (bench) => {
      expect(await run(bench.tick)).toBe(true)
      expect(passedThrough(bench.writes)).toEqual(["health"])
      // ... and once the first has a memo, the pass moves on to the next.
      slept.add("health")
      expect(await run(bench.tick)).toBe(true)
      expect(passedThrough(bench.writes)).toEqual(["health", "shipping"])
    },
  )
})

test("a turn that sits on a question is cancelled, said out loud, and not retried", async () => {
  await withBench({ nodes: [agent("health", "sess-1")] }, async (bench) => {
    bench.marker(".sleep-ask")
    expect(await run(bench.tick)).toBe(true)
    // THE CANCEL IS ON THE WIRE BEFORE THE PASS RETURNS, but the agent reads it
    // in its own process a moment later — so this waits rather than assumes.
    await until("the stop to reach the agent", () => bench.marked(".sleep-cancelled"))
    expect(bench.writes).toEqual([])
    expect(bench.commits).toEqual([])
    expect(bench.warnings.join("\n")).toContain("asked a question nobody is there to answer")
    // THE RETRY RULE, in memory: a node that failed once is left alone, so the
    // very next pass is not a second turn.
    await until("the fixture to be quiet", () => true, 50)
    expect(await run(bench.tick)).toBe(false)
  })
})

test("a delivery the pass never saw handed is withdrawn when it stops", async () => {
  // THE HAZARD THIS CLOSES: a body the scheduler or a panel is still holding
  // would fire days later as a machine turn with no hold on the quiet window,
  // nobody observing it, no memo and no commit — work with no owner.
  await withBench(
    { deliver: () => Effect.void, start: 200 },
    async (bench) => {
      expect(await run(bench.tick)).toBe(true)
      expect(bench.events).toEqual(["hold", "withdrawn", "released"])
      expect(bench.writes).toEqual([])
      expect(bench.commits).toEqual([])
      expect(bench.warnings.join("\n")).toContain("the turn never started")
      // ... and the node is left alone for a day, like every other failure.
      expect(await run(bench.tick)).toBe(false)
    },
  )
})

test("a conversation that dies mid-turn is a failed pass, with no memo", async () => {
  await withBench({}, async (bench) => {
    bench.marker(".sleep-vanish")
    expect(await run(bench.tick)).toBe(true)
    expect(bench.writes).toEqual([])
    expect(bench.commits).toEqual([])
    expect(bench.warnings.length).toBe(1)
    expect(await run(bench.tick)).toBe(false)
  })
})

test("a memo that cannot be written is a failed pass, with no commit", async () => {
  await withBench(
    { write: () => Effect.fail(new UsageFailure({ reason: "the vault refused the write" })) },
    async (bench) => {
      // The turn finished and the RECORD of it did not, which is the other half
      // of "trouble": nothing was committed, so there is nothing to undo, and
      // the node is retried tomorrow rather than tonight.
      expect(await run(bench.tick)).toBe(true)
      expect(bench.commits).toEqual([])
      expect(bench.warnings.join("\n")).toContain("the memo could not be written")
      expect(await run(bench.tick)).toBe(false)
    },
  )
})

test("a pass that is stopped mid-turn cancels the turn it started", async () => {
  await withBench({}, async (bench) => {
    bench.marker(".sleep-hold")
    // FORKED INTO A SCOPE OF ITS OWN, so the pass outlives the `run` that
    // started it — what this test interrupts is the pass, and nothing else.
    const running = await run(Effect.provideService(
      Effect.forkScoped(bench.tick),
      Scope.Scope,
      Scope.makeUnsafe(),
    ))
    await until("the turn to be taken", () => bench.marked(".sleep-asked"))
    expect(bench.marked(".sleep-cancelled")).toBe(false)
    await run(Fiber.interrupt(running))
    await until("the stop to reach the agent", () => bench.marked(".sleep-cancelled"))
    // ... and the memo is NOT written: a pass that was stopped is not a pass
    // that tidied anything.
    expect(bench.writes).toEqual([])
    expect(bench.commits).toEqual([])
  })
})
