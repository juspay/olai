import type { WaitingOutline } from "@olai/plugin-api/services"
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
import { QUEUES } from "@kolu/acp-client/testlib"
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

const agent = (id: string, session: string | null, over: Partial<NodeAgent> = {}): NodeAgent => ({
  kind: "node",
  beside: false,
  id,
  file: "Work.olai",
  title: id === "health" ? "Health" : id,
  engine: "claude",
  session,
  memory: 3,
  ...over,
})

const VAULT = {
  "Work.olai": [
    `{"id":"health","ord":"a0","title":"Health"}`,
    `{"id":"note","parent":"health","ord":"a0","title":"sleep was fine","changed":"2026-10-01T09:00:00+00:00"}`,
    `{"id":"shipping","ord":"a1","title":"Shipping"}`,
    `{"id":"ship-note","parent":"shipping","ord":"a0","title":"late again","changed":"2026-10-01T09:00:00+00:00"}`,
  ].join("\n") + "\n",
  "Archive.olai": `{"id":"old-note","parent":"health","ord":"a0","title":"the old rows","changed":"2026-10-01T09:00:00+00:00"}\n`,
}

const WAITING = [
  { file: "Work.olai", path: "docs/Work.olai" },
  { file: "Archive.olai", path: "docs/Archive.olai" },
  { file: "Notes.olai", path: "docs/Notes.olai" },
]

const reading = (vault: Record<string, string> = VAULT) => Effect.succeed(readingOf(setOf(vault)))

const passedThrough = (writes: ReadonlyArray<WriteRequest>): ReadonlyArray<string> =>
  writes.flatMap((one) => one.op === "prop" ? [one.id] : [])

interface Bench {
  readonly chat: Chat
  readonly nodes: () => NodeAgents
  readonly writes: ReadonlyArray<WriteRequest>
  readonly commits: ReadonlyArray<{ readonly message: string; readonly paths: ReadonlyArray<string> }>
  readonly warnings: Array<string>
  readonly events: Array<string>
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
    readonly after?: number
    readonly write?: (request: WriteRequest) => Effect.Effect<unknown, OpFailure>
    readonly deliver?: (to: { readonly agent: string; readonly session: string }) => Effect.Effect<void>
    readonly start?: number
    readonly vault?: Record<string, string>
    readonly reread?: Record<string, string>
    readonly waiting?: ReadonlyArray<WaitingOutline>
  },
  body: (bench: Bench) => Promise<void>,
): Promise<void> => {
  const nodes = over.nodes ?? [agent("health", "sess-1")]
  const writes: Array<WriteRequest> = []
  const commits: Array<{ message: string; paths: ReadonlyArray<string> }> = []
  const warnings: Array<string> = []
  const events: Array<string> = []
  let reads = 0
  const chat = await run(make({
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
      sleeps: () => true,
      live: over.live ?? (() => chat.live()),
      deliver: (to, say) => over.deliver === undefined
        ? Effect.tap(
          chat.doorFor("sleep").deliver(to, say, { sleep: true }),
          () => Effect.sync(() => void events.push("delivered")),
        )
        : over.deliver(to),
      withdraw: () => Effect.sync(() => void events.push("withdrawn")),
      watch: (to, observer) =>
        Effect.flatMap(chat.reading(to, observer), (panel) => panel === null
          ? Effect.fail(new UsageFailure({ reason: "the conversation changed; nothing to watch" }))
          : Effect.succeed({ cancel: panel.cancel })),
      read: Effect.suspend(() => {
        reads += 1
        return reading(reads === 1 ? over.vault : (over.reread ?? over.vault))
      }),
      reading: () => readingOf(setOf(over.vault ?? VAULT)).derived,
      write: over.write ?? ((request) => Effect.sync(() => {
        writes.push(request)
        return {}
      })),
      waiting: Effect.succeed(over.waiting ?? WAITING),
      commit: (message, paths) => Effect.sync(() => {
        events.push("committed")
        commits.push({ message, paths })
        return null
      }),
      hold: Effect.acquireRelease(
        Effect.sync(() => void events.push("hold")),
        () => Effect.sync(() => void events.push("released")),
      ),
      after: Duration.millis(over.after ?? 0),
      floor: 1,
      latest: Duration.days(7),
      tick: Duration.minutes(10),
      question: Duration.millis(400),
      limit: Duration.minutes(10),
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
    expect(bench.marked(".sleep-asked")).toBe(true)
    expect(bench.writes).toEqual([{
      op: "prop",
      id: "health",
      key: "chat-agent-slept",
      value: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/),
    }])
    expect(bench.commits).toEqual([{
      message: "sleep: Health",
      paths: ["docs/Work.olai", "docs/Archive.olai"],
    }])
    expect(bench.warnings).toEqual([])
    expect(bench.chat.live().get("health")?.status).toBe("idle")
    expect(bench.events).toEqual(["hold", "delivered", "committed", "withdrawn", "released"])
  })
})

test("the commit names a file the agent moved a record into during the pass", async () => {
  await withBench(
    {
      vault: {
        "Work.olai": [
          `{"id":"health","ord":"a0","title":"Health"}`,
          `{"id":"note","parent":"health","ord":"a0","title":"sleep was fine","changed":"2026-10-01T09:00:00+00:00"}`,
        ].join("\n") + "\n",
      },
      reread: {
        "Work.olai": `{"id":"health","ord":"a0","title":"Health"}\n`,
        "Archive.olai": `{"id":"note","parent":"health","ord":"a0","title":"moved out","changed":"2026-10-01T09:00:00+00:00"}\n`,
      },
    },
    async (bench) => {
      expect(await run(bench.tick)).toBe(true)
      expect(bench.commits).toEqual([{
        message: "sleep: Health",
        paths: ["docs/Work.olai", "docs/Archive.olai"],
      }])
    },
  )
})

test("a nested node agent's own file is not swept into the commit", async () => {
  await withBench(
    {
      vault: {
        "Work.olai": [
          `{"id":"health","ord":"a0","title":"Health"}`,
          `{"id":"note","parent":"health","ord":"a0","title":"sleep was fine","changed":"2026-10-01T09:00:00+00:00"}`,
          `{"id":"helper","parent":"health","ord":"a1","title":"Helper"}`,
        ].join("\n") + "\n",
        "Helper.olai":
          `{"id":"helper-note","parent":"helper","ord":"a0","title":"the helper's own","changed":"2026-10-01T09:00:00+00:00"}\n`,
      },
      nodes: [agent("health", "sess-1"), agent("helper", "sess-2", { file: "Helper.olai" })],
      waiting: [
        { file: "Work.olai", path: "docs/Work.olai" },
        { file: "Helper.olai", path: "docs/Helper.olai" },
      ],
    },
    async (bench) => {
      expect(await run(bench.tick)).toBe(true)
      expect(bench.commits).toEqual([{ message: "sleep: Health", paths: ["docs/Work.olai"] }])
    },
  )
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
  for (const standing of [
    { status: "thinking" as const, asking: 0 },
    { status: "idle" as const, asking: 1 },
    { status: "booting" as const, asking: 0 },
    { status: "idle" as const, asking: 0, unopened: true },
  ]) {
    await withBench(
      { live: () => new Map([["health", { ...standing, since: "2026-01-01T00:00:00.000Z" }]]) },
      async (bench) => {
        expect(await run(bench.tick)).toBe(false)
      },
    )
  }
})

test("a conversation that DIED is woken rather than left alone", async () => {
  await withBench(
    { live: () => new Map([["health", { status: "gone" as const, asking: 0 }]]) },
    async (bench) => {
      expect(await run(bench.tick)).toBe(true)
      expect(bench.marked(".sleep-asked")).toBe(true)
      expect(bench.commits).toHaveLength(1)
    },
  )
})

test("a subtree somebody is editing keeps its node awake", async () => {
  await withBench(
    {
      vault: {
        "Work.olai": [
          `{"id":"health","ord":"a0","title":"Health"}`,
          `{"id":"note","parent":"health","ord":"a0","title":"just edited","changed":"${new Date().toISOString()}"}`,
        ].join("\n") + "\n",
      },
      after: Duration.toMillis(Duration.hours(1)),
      live: () => new Map([["health", {
        status: "idle" as const,
        asking: 0,
        since: new Date(Date.now() - 2 * 3_600_000).toISOString(),
      }]]),
    },
    async (bench) => {
      expect(await run(bench.tick)).toBe(false)
    },
  )
})

test("a live conversation with no idle instant falls back to the memory", async () => {
  await withBench(
    { live: () => new Map([["health", { status: "idle" as const, asking: 0 }]]) },
    async (bench) => {
      expect(await run(bench.tick)).toBe(true)
      expect(bench.commits).toHaveLength(1)
    },
  )
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
  const slept = new Set<string>()
  await withBench(
    {
      nodes: [agent("health", "sess-1"), agent("shipping", "sess-2")],
      sleptAt: (node) => slept.has(node) ? "2099-01-01T00:00:00+00:00" : null,
    },
    async (bench) => {
      expect(await run(bench.tick)).toBe(true)
      expect(passedThrough(bench.writes)).toEqual(["health"])
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
    await until("the stop to reach the agent", () => bench.marked(".sleep-cancelled"))
    expect(bench.writes).toEqual([])
    expect(bench.commits).toEqual([])
    expect(bench.warnings.join("\n")).toContain("asked a question nobody is there to answer")
    expect(await run(bench.tick)).toBe(false)
  })
})

test("a delivery the pass never saw handed is withdrawn when it stops", async () => {
  await withBench(
    { deliver: () => Effect.void, start: 200 },
    async (bench) => {
      expect(await run(bench.tick)).toBe(true)
      expect(bench.events).toEqual(["hold", "withdrawn", "released"])
      expect(bench.writes).toEqual([])
      expect(bench.commits).toEqual([])
      expect(bench.warnings.join("\n")).toContain("the turn never started")
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
    const running = await run(Effect.provideService(
      Effect.forkScoped(bench.tick),
      Scope.Scope,
      Scope.makeUnsafe(),
    ))
    await until("the turn to be taken", () => bench.marked(".sleep-asked"))
    expect(bench.marked(".sleep-cancelled")).toBe(false)
    await run(Fiber.interrupt(running))
    await until("the stop to reach the agent", () => bench.marked(".sleep-cancelled"))
    expect(bench.writes).toEqual([])
    expect(bench.commits).toEqual([])
  })
})
