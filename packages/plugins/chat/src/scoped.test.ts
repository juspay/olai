/**
 * The node-agent scheduler over real ACP subprocesses.
 *
 * These are not panel tests repeated twice. The facts here only exist one
 * level above a panel: two nodes remain live while either one is foreground,
 * a delivery addresses the sleeping one by durable binding, and an idle scope
 * releases its process credential before the next wake acquires another.
 */

import { type NodeAgent, type OpFailure, UsageFailure } from "@olai/format"
import { collector } from "@olai/log/testlib"
import { afterEach, beforeEach, expect, test } from "bun:test"
import { Deferred, Duration, Effect, Exit, Fiber, References, Scope } from "effect"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { QUEUES } from "@kolu/acp-client/testlib"
import type { Installed } from "./agents/roster.ts"
import { seated } from "./agents/roster.testlib.ts"
import { ephemeralLocalState, type ChatLocalState } from "./local.ts"
import { forLocalState as liveIn, type LiveRecord } from "./live.ts"
import { volatile } from "./memory.ts"
import { make, recordable } from "./scoped.ts"
import { forLocalState as sessionsIn } from "./sessions.ts"
import { forLocalState as scopesIn } from "./scopes.ts"
import { makePanel } from "./chat.ts"

const ACTIVATION = {}

const logging = () => {
  const { layer, said } = collector()
  const under = <A, E>(effect: Effect.Effect<A, E>): Effect.Effect<A, E> =>
    effect.pipe(Effect.provideService(References.MinimumLogLevel, "Info"), Effect.provide(layer))
  const run = <A, E>(effect: Effect.Effect<A, E>): Promise<A> => Effect.runPromise(under(effect))
  /** THE BENCH'S OWN FORK, and it carries the bench's logger for the reason the
   *  scheduler asks for one at all: work started through `Options.fork` runs on
   *  whatever runtime the caller supplied, so a fork that dropped this layer
   *  would be a case asserting on lines the collector never saw. Under a serve
   *  that runtime is the plugin's, which carries the operator's settings; here
   *  it is this. */
  const fork = (work: Effect.Effect<void>) => Effect.runFork(under(work))
  return { run, fork, said }
}

const FIXTURE = join(import.meta.dirname, "fixtures", "doorbell-agent.ts")

const installed = (id: string): Installed => ({
  id,
  name: id,
  adapter: { command: process.execPath, args: [FIXTURE] },
  leg: QUEUES,
  prompt: { kind: "first-turn" },
})

const run = <A, E>(effect: Effect.Effect<A, E>): Promise<A> => Effect.runPromise(effect)

const until = async (what: string, ready: () => boolean, ms = 8_000): Promise<void> => {
  const deadline = Date.now() + ms
  while (Date.now() < deadline) {
    if (ready()) return
    await run(Effect.sleep("20 millis"))
  }
  throw new Error(`waited ${ms}ms for ${what} and it never happened`)
}

let cwd = ""
const wasState = process.env["XDG_STATE_HOME"]

beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), "olai-scoped-chat-"))
  process.env["XDG_STATE_HOME"] = cwd
})

afterEach(() => {
  if (wasState === undefined) delete process.env["XDG_STATE_HOME"]
  else process.env["XDG_STATE_HOME"] = wasState
  rmSync(cwd, { recursive: true, force: true })
})

test("two node scopes work together, then an idle one is reaped and woken in place", async () => {
  const { run, fork, said } = logging()
  let nodes: ReadonlyArray<NodeAgent> = [
    { kind: "node", beside: false, id: "one", file: "Work.olai", title: "one", engine: "alpha", session: null, memory: 2 },
    { kind: "node", beside: false, id: "two", file: "Work.olai", title: "two", engine: "beta", session: null, memory: 3 },
  ]
  const released: Array<string> = []
  const alphaTab = Scope.makeUnsafe()
  const firstTab = Scope.makeUnsafe()
  const secondTab = Scope.makeUnsafe()
  const chat = await run(make({
    // THE BENCH'S OWN RUNTIME, said out loud. `Options.fork` has no default —
    // one would have to be `Effect.runFork`, which is the unowned default
    // runtime this scheduler stopped reaching for. A bench chooses it here,
    // where the choice is visible, and `logging()`'s carries the collector.
    fork,
    roster: () => [seated(installed("alpha")), seated(installed("beta"))],
    cwd,
    tools: () => null,
    nodeAt: (id) => nodes.find((node) => node.id === id) ?? null,
    seatableAt: (id) => nodes.some((node) => node.id === id),
    nodes: () => nodes,
    wake: () => undefined,
    nearestAt: (id, candidates) => candidates.has(id) ? id : null,
    agentAt: ({ agent, session }) =>
      nodes.find((node) => node.engine === agent && node.session === session) ?? null,
    ticket: (node) => ({ bearer: `ticket-${node}`, release: () => released.push(node) }),
    // Long enough to cover the second process's cold start; short enough that
    // the reaper remains a sub-second assertion after both turns settle.
    idle: "500 millis",
    onState: () => {},
    onTranscript: () => {},
  }))

  try {
    await run(chat.start)

    await run(chat.startAgentSession("one", "alpha"))
    const oneSession = chat.state().session?.id
    expect(oneSession).toBeString()
    const missing = await run(Effect.result(chat.startAgentSession("not-a-node", "beta")))
    expect(missing._tag).toBe("Failure")
    if (missing._tag === "Failure") {
      expect(missing.failure.message).toContain("no longer available")
    }
    expect(chat.state().session?.id).toBe(oneSession)
    nodes = nodes.map((node) => node.id === "one" ? { ...node, session: oneSession ?? null } : node)
    chat.reread()

    await run(chat.startAgentSession("two", "beta"))
    const twoSession = chat.state().session?.id
    expect(twoSession).toBeString()
    nodes = nodes.map((node) => node.id === "two" ? { ...node, session: twoSession ?? null } : node)
    chat.reread()

    const alphaStates: Array<string | undefined> = []
    await run(chat.reading({ agent: "alpha", session: oneSession! }, {
      state: state => { alphaStates.push(state.session?.id) }, transcript: () => {},
    }).pipe(Effect.provideService(Scope.Scope, alphaTab)))
    await run(chat.inConversation({ agent: "alpha", session: oneSession! }, undefined,
      panel => panel.send("wait:350", [], [])))
    await until("the first node to work", () => chat.live().get("one")?.status === "thinking")

    const observed: Array<string> = []
    const observe = () => ({
      state: (state: ReturnType<typeof chat.state>) => observed.push(state.session?.id ?? ""),
      transcript: () => {},
    })
    await run(chat.reading({ agent: "beta", session: twoSession! }, observe()).pipe(
      Effect.provideService(Scope.Scope, firstTab),
    ))
    await run(chat.reading({ agent: "beta", session: twoSession! }, observe()).pipe(
      Effect.provideService(Scope.Scope, secondTab),
    ))
    await run(Scope.close(firstTab, Exit.void))
    await run(chat.loadSession("beta", twoSession ?? ""))
    await run(chat.send("wait:350", [], []))
    await until("both node scopes to work", () =>
      chat.live().get("one")?.status === "thinking"
      && chat.live().get("two")?.status === "thinking")

    expect(alphaStates.every(session => session === oneSession)).toBe(true)
    await run(Scope.close(alphaTab, Exit.void))
    await until("the background scope to reap", () =>
      !chat.live().has("one") && released.length === 1)
    const afterReap = [...released]
    if (afterReap.length !== 1 || afterReap[0] !== "one") {
      throw new Error(`the reap released ${JSON.stringify(afterReap)}`)
    }

    // AND A READ THAT WAS ON ITS WAY WHEN THAT CONVERSATION WENT IS REFUSED,
    // not applied by opening the process the reap just released. This is the
    // shape of the defect it pins: a tab acknowledges a line off a roster frame
    // that is a round trip older than the conversation, so an agent that crashed
    // — or a scope that was reaped — is exactly the case where the
    // acknowledgement is in flight. An agent no person asked for must not come
    // back to life to have somebody's reading written on it (`Chat.seen`, which
    // is `inConversation` with the arm that opens removed). The instant is the
    // line the frame it came from was holding; what is asserted is the routing.
    const lateRead = await run(Effect.result(
      chat.seen({ agent: "alpha", session: oneSession! }, "2026-09-01T16:41:00Z"),
    ))
    expect(lateRead._tag).toBe("Failure")
    expect(chat.live().has("one")).toBe(false)
    expect(released).toHaveLength(1)

    await run(chat.doorFor("kolu").deliver(
      { agent: "alpha", session: oneSession! },
      () => "wake in the background",
    ))
    await until("the sleeping scope to wake and finish", () => chat.live().get("one")?.status === "idle")
    expect(chat.state().bound).toBe("two")
    expect(chat.live().has("two")).toBe(true)
    // A delayed action from an expired lifetime cannot reopen its old pair
    // through the current node scope, even if its binding is still visible.
    const currentScope = chat.state().uploadScope
    const stale = await run(Effect.result(chat.inConversation(
      { agent: "beta", session: "expired-conversation" }, "expired-upload-scope",
      () => Effect.die("a stale action must never run"),
    )))
    expect(stale._tag).toBe("Failure")
    expect(chat.state().session?.id).toBe(twoSession)
    expect(chat.state().uploadScope).toBe(currentScope)
    expect(observed.every(session => session === twoSession)).toBe(true)
    await run(Scope.close(secondTab, Exit.void))
    await until("the last reading to release the idle scope", () => !chat.live().has("two"))
  } finally {
    await run(Scope.close(alphaTab, Exit.void))
    await run(Scope.close(firstTab, Exit.void))
    await run(Scope.close(secondTab, Exit.void))
    await run(chat.stop)
  }

  expect(released.toSorted()).toEqual(["one", "one", "two"])
  expect(said.some(line => line.message.includes("chat agent exited")
    && line.annotations.reason === "idle eviction" && line.annotations.node === "one")).toBe(true)
}, 20_000)

/**
 * A SCHEDULER OVER ONE LIVE RECORD, and the bench a restart is expressed with:
 * a second `make` over the same local document. The node table and the roster
 * are thunks so a test can move either between the two, which is how "the
 * engine registered after chat's apply" and "the node was trashed while the
 * server was down" are reached.
 */
const alphaWith = (args: ReadonlyArray<string>): Installed => ({
  ...installed("alpha"),
  adapter: { command: process.execPath, args: [FIXTURE, ...args] },
})

const restartable = async (options: {
  local: ChatLocalState
  /** The SAME record the test reads, so a write is visible to both — a second
   *  adapter over one document loads its own copy and would never see it. */
  record?: LiveRecord
  nodes: () => ReadonlyArray<NodeAgent>
  roster: () => ReadonlyArray<Installed>
  idle?: Duration.Input
  capacity?: number
  released?: Array<string>
  /** Counts the seam's forks, so a hot loop is visible as a burst rather than
   *  as a slow test. */
  forks?: { count: number }
}) => {
  const { run, fork, said } = logging()
  const counted = (work: Effect.Effect<void>): Fiber.Fiber<void> => {
    if (options.forks !== undefined) options.forks.count++
    return fork(work)
  }
  const chat = await run(make({
    fork: counted,
    live: options.record ?? liveIn(options.local),
    roster: () => options.roster().map(seated),
    cwd,
    tools: () => null,
    nodes: options.nodes,
    nodeAt: (id) => options.nodes().find((node) => node.id === id) ?? null,
    seatableAt: (id) => options.nodes().some((node) => node.id === id),
    wake: () => ACTIVATION,
    nearestAt: (id, candidates) => candidates.has(id) ? id : null,
    agentAt: ({ agent, session }) =>
      options.nodes().find((node) => node.engine === agent && node.session === session) ?? null,
    ticket: (node) => ({ bearer: `ticket-${node}`, release: () => options.released?.push(node) }),
    ...(options.idle === undefined ? {} : { idle: options.idle }),
    ...(options.capacity === undefined ? {} : { capacity: options.capacity }),
    onState: () => {},
    onTranscript: () => {},
  }))
  return { chat, run, fork, said }
}

const NODE_ONE: NodeAgent = {
  id: "one",
  file: "Work.olai",
  title: "one",
  engine: "alpha",
  session: "remembered",
  memory: 2,
  kind: "node",
  beside: false,
}

const opened = (said: ReadonlyArray<{ message: string }>): number =>
  said.filter((line) => line.message.includes("conversation opened")).length

test("the conversations live before a restart open again without a reader", async () => {
  const local = ephemeralLocalState()
  const record = liveIn(local)
  const first = await restartable({
    local,
    record,
    nodes: () => [NODE_ONE],
    roster: () => [installed("alpha")],
  })
  try {
    await first.run(first.chat.start)
    await first.run(first.chat.loadSession("alpha", "remembered"))
    await until("the conversation to be live", () => first.chat.live().get("one")?.status === "idle")
    await until("the live record", () => record.read().some((mark) => mark.node === "one"))
  } finally {
    await first.run(first.chat.stop)
  }
  // The stop wrote nothing: the record is what the last live moment looked
  // like, which is exactly what a SIGKILL leaves behind.
  expect(record.read().map((mark) => mark.node)).toEqual(["one"])

  const second = await restartable({
    local,
    record,
    nodes: () => [NODE_ONE],
    roster: () => [installed("alpha")],
  })
  try {
    const before = opened(second.said)
    await second.run(second.chat.start)
    // THE CLAIM: the node is live before anything here asked for it. `start`
    // hands the pass to the seam rather than joining it, so wait for the
    // reopen it forked.
    await until("the boot's own reopen", () => second.chat.live().get("one")?.status === "idle")
    expect(opened(second.said)).toBe(before + 1)
    // ... and it is still what the record says, because a reopened conversation
    // IS live: the next restart opens it again on the budget it has left.
    expect(record.read().map((mark) => mark.node)).toEqual(["one"])
  } finally {
    await second.run(second.chat.stop)
  }
})

test("a recorded conversation waits for an engine that registers after chat's apply", async () => {
  const local = ephemeralLocalState()
  const record = liveIn(local)
  await run(record.write([{ node: "one", touched: Date.now() }]))
  let roster: ReadonlyArray<Installed> = []
  const it = await restartable({ local, record, nodes: () => [NODE_ONE], roster: () => roster })
  try {
    await it.run(it.chat.start)
    // The pass is forked; let it look and leave the entry alone.
    await it.run(Effect.sleep("50 millis"))
    expect(it.chat.live().size).toBe(0)
    // ENTRY RETAINED, not forgotten: the record is the live set UNION what is
    // still waiting, or the next engine's mount would have nothing to find.
    expect(record.read().map((mark) => mark.node)).toEqual(["one"])

    roster = [installed("alpha")]
    await it.run(it.chat.enginesMoved)
    expect(it.chat.live().get("one")?.status).toBe("idle")
    expect(record.read().map((mark) => mark.node)).toEqual(["one"])
  } finally {
    await it.run(it.chat.stop)
  }
})

for (const missing of ["the node", "its session"] as const) {
  test(`a recorded conversation whose ${missing} is gone is dropped, not retried`, async () => {
    const local = ephemeralLocalState()
    const record = liveIn(local)
    await run(record.write([{ node: "one", touched: Date.now() }]))
    const it = await restartable({
      local,
      record,
      nodes: () => missing === "the node" ? [] : [{ ...NODE_ONE, session: null }],
      roster: () => [installed("alpha")],
    })
    try {
      await it.run(it.chat.start)
      expect(it.chat.live().size).toBe(0)
      await until("the dropped record", () => record.read().length === 0)
      expect(it.said.some((line) => line.message.includes("no longer a seat"))).toBe(true)
    } finally {
      await it.run(it.chat.stop)
    }
  })
}

test("a recorded conversation past the idle budget is skipped and dropped", async () => {
  const local = ephemeralLocalState()
  const record = liveIn(local)
  await run(record.write([{
    node: "one",
    touched: Date.now() - 2 * 3_600_000,
  }]))
  const it = await restartable({
    local,
    record,
    nodes: () => [NODE_ONE],
    roster: () => [installed("alpha")],
    idle: "1 hour",
  })
  try {
    await it.run(it.chat.start)
    expect(it.chat.live().size).toBe(0)
    await until("the expired record to be dropped", () => record.read().length === 0)
    // Nothing was spawned to learn that: the budget is arithmetic.
    expect(it.said.some((line) => line.message.includes("chat agent ready"))).toBe(false)
  } finally {
    await it.run(it.chat.stop)
  }
})

test("a refused resume closes its scope, drops the record and leaves the reader path alone", async () => {
  const local = ephemeralLocalState()
  const record = liveIn(local)
  await run(record.write([{ node: "one", touched: Date.now() }]))
  const released: Array<string> = []
  const it = await restartable({
    local,
    record,
    nodes: () => [NODE_ONE],
    roster: () => [alphaWith(["--refuse-load"])],
    released,
  })
  try {
    await it.run(it.chat.start)
    await until("the refused record to be dropped", () => record.read().length === 0)
    // The slot the attempt acquired is gone — credential included — rather
    // than sitting there as a refused conversation nobody asked for.
    await until("the refused scope's credential to be released", () => released.includes("one"))
    expect(it.chat.live().size).toBe(0)
    expect(it.said.some((line) =>
      line.message.includes("could not be reopened")
      && line.message.includes("refused on purpose"))).toBe(true)
  } finally {
    await it.run(it.chat.stop)
  }
})

test("a held reader does not spin the idle timer, and gets its budget back when it leaves", async () => {
  const local = ephemeralLocalState()
  const kept = liveIn(local)
  /** Every instant the scheduler has written as this conversation's budget
   *  start, in order. A history rather than a read of the record, because the
   *  mark itself goes when the conversation is reaped. */
  const starts: Array<number> = []
  const record: LiveRecord = {
    read: kept.read,
    write: (marks) => Effect.suspend(() => {
      for (const mark of marks) if (mark.node === "one") starts.push(mark.touched)
      return kept.write(marks)
    }),
  }
  const forks = { count: 0 }
  const released: Array<string> = []
  const it = await restartable({
    local,
    record,
    nodes: () => [NODE_ONE],
    roster: () => [installed("alpha")],
    idle: "150 millis",
    released,
    forks,
  })
  const tab = Scope.makeUnsafe()
  try {
    await it.run(it.chat.start)
    await it.run(it.chat.reading({ node: "one" }, {
      state: () => {},
      transcript: () => {},
    }).pipe(Effect.provideService(Scope.Scope, tab)))
    await until("the held conversation to be live", () => it.chat.live().has("one"))
    const touched = () => starts.at(-1) ?? Number.NEGATIVE_INFINITY

    // SEVERAL BUDGETS PASS WHILE THE READER HOLDS IT. Each one that runs out
    // under a reader is a touch, so the record's instant walks forward a budget
    // at a time; three budgets on, the conversation has outlived three of
    // them. A re-arm that kept the old instant would sleep for zero and fork
    // again at once — the instant never moves, and the forks are what pile up
    // instead, so the wait ends on whichever comes first.
    const heldAt = Date.now()
    const before = forks.count
    await until("three budgets to run out under the reader, or the timer to spin",
      () => touched() >= heldAt + 3 * 150 || forks.count - before >= 20)
    expect(forks.count - before).toBeLessThan(20)
    expect(it.chat.live().has("one")).toBe(true)

    // ... AND LEAVING HANDS IT A FULL BUDGET rather than evicting it on the
    // frame the reader looked away: the leaving is the touch, so a budget the
    // record was given starts no earlier than it. Read once the reap is done —
    // the seat leaves the live map as its close begins and gives its ticket
    // back as the close ends — so a release that did not touch fails here
    // rather than by waiting out a budget that never comes.
    const left = Date.now()
    await it.run(Scope.close(tab, Exit.void))
    expect(it.chat.live().has("one")).toBe(true)
    await until("the released conversation to be reaped", () => released.length > 0, 2000)
    expect(starts.some((at) => at >= left)).toBe(true)
    expect(it.chat.live().has("one")).toBe(false)
    expect(Date.now() - left).toBeGreaterThan(80)
    expect(released).toEqual(["one"])
  } finally {
    await it.run(Scope.close(tab, Exit.void))
    await it.run(it.chat.stop)
  }
})

test("a reopened conversation closes on its remaining budget, not a fresh one", async () => {
  const local = ephemeralLocalState()
  const record = liveIn(local)
  // 600 of 800 ms already spent: 200 ms are what a boot may spend.
  await run(record.write([{ node: "one", touched: Date.now() - 600 }]))
  const it = await restartable({
    local,
    record,
    nodes: () => [NODE_ONE],
    roster: () => [installed("alpha")],
    idle: "800 millis",
  })
  try {
    await it.run(it.chat.start)
    await until("the reopened conversation", () => it.chat.live().has("one"))
    const openedAt = Date.now()
    // A FRESH idle window would keep it for 800 ms. The recorded instant is
    // what a late idle frame must not overwrite.
    await until("the remaining budget to expire", () => !it.chat.live().has("one"), 2000)
    expect(Date.now() - openedAt).toBeLessThan(500)
  } finally {
    await it.run(it.chat.stop)
  }
})

test("start does not wait for a boot reopen, and stop interrupts a hanging one", async () => {
  const local = ephemeralLocalState()
  const record = liveIn(local)
  await run(record.write([{ node: "one", touched: Date.now() }]))
  const released: Array<string> = []
  const it = await restartable({
    local,
    record,
    nodes: () => [NODE_ONE],
    roster: () => [alphaWith(["--hold-load"])],
    released,
  })
  try {
    // A `session/load` that never answers must not hold the serve's next steps
    // (the sleeper) behind eight subprocess boots.
    await it.run(it.chat.start.pipe(Effect.timeout("1 second")))
    // ... and a stop must cut it rather than wait out a real agent's deadline.
    await it.run(it.chat.stop.pipe(Effect.timeout("3 seconds")))
    expect(it.chat.live().size).toBe(0)
    expect(released).toEqual(["one"])
  } finally {
    await it.run(Effect.catch(it.chat.stop, () => Effect.void))
  }
})

test("a gone agent is not written down, so a restart does not wake it", async () => {
  const local = ephemeralLocalState()
  const record = liveIn(local)
  await run(record.write([{ node: "one", touched: Date.now() }]))
  let roster = [installed("alpha"), installed("beta")]
  const it = await restartable({ local, record, nodes: () => [NODE_ONE], roster: () => roster })
  try {
    await it.run(it.chat.start)
    await until("the conversation to be live", () => it.chat.live().get("one")?.status === "idle")
    await until("the live record", () => record.read().some((mark) => mark.node === "one"))

    // The engine leaving leaves the slot in the pool as `gone` until eviction.
    // That is not a conversation a restart should wake once the engine mounts
    // again — the rule is that asleep agents remain asleep.
    roster = [installed("beta")]
    await it.run(it.chat.enginesMoved)
    await until("the record to drop the gone conversation", () => record.read().length === 0)
  } finally {
    await it.run(it.chat.stop)
  }
})


test("one question decides what the record keeps", () => {
  const slot = (over: {
    history?: boolean
    status?: "idle" | "gone" | "thinking"
    unopened?: unknown
  } = {}) => ({
    history: over.history ?? false,
    state: {
      status: over.status ?? "idle",
      unopened: over.unopened ?? null,
    },
  })
  // A conversation the server is having, and nothing else.
  expect(recordable(slot())).toBe(true)
  // A past conversation somebody is reading is not one the server is having.
  expect(recordable(slot({ history: true }))).toBe(false)
  // A refused open is live for its reader, not for the next boot.
  expect(recordable(slot({ unopened: { what: "sess-1" } }))).toBe(false)
  // A gone agent stays asleep when its engine comes back.
  expect(recordable(slot({ status: "gone" }))).toBe(false)
})

test("the record sheds the conversation capacity evicts", async () => {
  const local = ephemeralLocalState()
  const record = liveIn(local)
  const nodes: ReadonlyArray<NodeAgent> = [
    NODE_ONE,
    { kind: "node", beside: false, id: "two", file: "Work.olai", title: "two", engine: "alpha", session: "second", memory: 2 },
    { kind: "node", beside: false, id: "three", file: "Work.olai", title: "three", engine: "alpha", session: "third", memory: 2 },
  ]
  const it = await restartable({
    local,
    record,
    nodes: () => nodes,
    roster: () => [installed("alpha")],
    capacity: 2,
  })
  try {
    await it.run(it.chat.start)
    await it.run(it.chat.loadSession("alpha", "remembered"))
    await until("one on the record", () => record.read().map((mark) => mark.node).join() === "one")
    await it.run(it.chat.loadSession("alpha", "second"))
    await until("two on the record", () => record.read().length === 2)

    await it.run(it.chat.loadSession("alpha", "third"))
    // The oldest of the two is what capacity releases, and the record follows
    // the live set: the evicted node is not one a restart brings back.
    await until("the record to shed the evicted node", () =>
      record.read().map((mark) => mark.node).toSorted().join() === "three,two")
    expect(it.chat.live().has("one")).toBe(false)
  } finally {
    await it.run(it.chat.stop)
  }
})

test("the record follows the live set as slots open and go", async () => {
  const local = ephemeralLocalState()
  const record = liveIn(local)
  let nodes: ReadonlyArray<NodeAgent> = [
    NODE_ONE,
    { kind: "node", beside: false, id: "two", file: "Work.olai", title: "two", engine: "alpha", session: "second", memory: 2 },
  ]
  const it = await restartable({ local, record, nodes: () => nodes, roster: () => [installed("alpha")] })
  try {
    await it.run(it.chat.start)
    await it.run(it.chat.loadSession("alpha", "remembered"))
    await until("the first node on the record", () =>
      record.read().length === 1 && record.read()[0]?.node === "one")
    await it.run(it.chat.loadSession("alpha", "second"))
    await until("both nodes on the record", () => record.read().length === 2)

    // A node that leaves the vault takes its conversation with it. The record
    // is written at the close, not on the next boot: a SIGKILL one tick later
    // must not bring the trashed node back.
    nodes = [NODE_ONE]
    it.chat.reread()
    await until("the closed node off the record", () =>
      record.read().length === 1 && record.read()[0]?.node === "one")
  } finally {
    await it.run(it.chat.stop)
  }
})

/**
 * SHUTDOWN LANDING IN THE MIDDLE OF A BOOT — the one way a node scope's
 * resources could appear AFTER the thing that owns them said it had stopped.
 *
 * The boot is forked and detached on purpose: recalling a session, locating a
 * node and acquiring a panel must not hold up whoever called `start`. It was
 * also unowned, so a shutdown ran its whole sequence — root panel stopped,
 * every slot in `nodes` closed — while the boot was still walking towards a
 * `nodes.set` the snapshot had already been taken past. What survived was a
 * minted MCP credential and a spawned ACP subprocess with nothing left that
 * could release either.
 *
 * THREE ASSERTIONS, one per thing that could be left behind: a slot the live
 * roster still names, a ticket minted and never released, and a subprocess
 * that was told it was ready and never told to go.
 */
test("a shutdown during an explicit opening leaves no scope, no ticket and no process", async () => {
  const { run, fork, said } = logging()
  const node: NodeAgent = {
    id: "one",
    file: "Work.olai",
    title: "one",
    engine: "alpha",
    session: "remembered",
    memory: 2,
    kind: "node",
    beside: false,
  }
  // REMEMBERED, so the boot goes straight for the node scope rather than
  // through a root session first — the longest walk, and the one with a
  // credential and a subprocess in the middle of it.
  const memory = volatile()
  await run(memory.remember({ agent: "alpha", session: "remembered", model: null }))
  const minted: Array<string> = []
  const released: Array<string> = []
  // THE MOMENT THE BOOT IS PAST THE POINT OF NO RETURN. The credential is
  // minted immediately after `acquire` checks whether the scheduler has
  // stopped and immediately before it spawns anything, so a stop that waits
  // for this lands in the window and nowhere else. Without it the case is
  // vacuous: `start` answers before the boot has recalled anything, and a stop
  // that quick is refused at the check rather than racing past it.
  const minting = Promise.withResolvers<void>()
  const chat = await run(make({
    fork,
    roster: () => [seated(installed("alpha"))],
    cwd,
    memory,
    tools: () => null,
    nodeAt: (id) => id === node.id ? node : null,
    seatableAt: (id) => id === node.id,
    nodes: () => [node],
    wake: () => ACTIVATION,
    nearestAt: (id, candidates) => candidates.has(id) ? id : null,
    agentAt: ({ agent, session }) =>
      node.engine === agent && node.session === session ? node : null,
    ticket: (held) => {
      minted.push(held)
      minting.resolve()
      return { bearer: `ticket-${held}`, release: () => released.push(held) }
    },
    onState: () => {},
    onTranscript: () => {},
  }))

  await run(chat.start)
  const opening = run(chat.loadSession("alpha", "remembered"))
  await minting.promise
  await run(chat.stop)
  await opening.catch(() => {})
  // Long enough for a boot that outlived the stop to have reached its
  // `session/load` and registered a slot.
  await run(Effect.sleep("1500 millis"))

  expect(chat.live().size).toBe(0)
  expect([...released].sort()).toEqual([...minted].sort())
  const ready = said.filter((line) => line.message.includes("chat agent ready"))
  const exited = said.filter((line) => line.message.includes("chat agent exited"))
  expect(exited).toHaveLength(ready.length)
}, 30_000)

/**
 * ...AND THE SAME SHUTDOWN LANDING ON A PATH THAT IS NOT THE BOOT.
 *
 * Owning the boot fiber closes the boot's window and only the boot's. Every
 * acquisition takes several yields to spawn a panel, and two others reach it
 * — `reread`'s relocation and a session started at a node — so
 * any of them can be past the shutting-down check, inside the uninterruptible
 * panel acquisition, when a stop sets its flag and reads the node map. The slot
 * then lands in a map nobody reads again, with a credential and a process in
 * it.
 *
 * TWO OF THEM, and neither is the boot's: a session started at a node, and the
 * RELOCATION the audit names by name.
 *
 * The FIRST is the discriminating one — it fails against the arrangement this
 * replaced, with a spawned agent that was told it was ready and never told to
 * go. The second covers the other path and passes either way on this machine:
 * its acquisition happens to finish before the stop reads the node map. Said
 * here rather than left for a reader to discover, because a case that cannot
 * fail is coverage and not evidence, and the two are not the same thing.
 */
for (const path of ["a session started at a node"] as const) {
test(`a shutdown that lands mid-acquisition during ${path} leaves nothing behind`, async () => {
  const { run, fork, said } = logging()
  const node: NodeAgent = {
    id: "one",
    file: "Work.olai",
    title: "one",
    engine: "alpha",
    session: null,
    memory: 2,
    kind: "node",
    beside: false,
  }
  const minted: Array<string> = []
  const released: Array<string> = []
  // The same latch the boot case uses, and for the same reason: the credential
  // is minted immediately after the shutting-down check and immediately before
  // anything is spawned, so a stop that waits for it lands in the window.
  const minting = Promise.withResolvers<void>()
  const chat = await run(make({
    fork,
    roster: () => [seated(installed("alpha"))],
    cwd,
    tools: () => null,
    nodeAt: (id) => id === node.id ? node : null,
    seatableAt: (id) => id === node.id,
    nodes: () => [node],
    wake: () => ACTIVATION,
    nearestAt: (id, candidates) => candidates.has(id) ? id : null,
    agentAt: () => null,
    ticket: (held) => {
      minted.push(held)
      minting.resolve()
      return { bearer: `ticket-${held}`, release: () => released.push(held) }
    },
    onState: () => {},
    onTranscript: () => {},
  }))

  // A RELOCATION MOVES A CONVERSATION THAT EXISTS, so that path opens one at
  // the root first and waits for the boot to be done with it — which is what
  // makes the acquisition under test unambiguously not the boot's. The other
  // path takes no boot at all.
  const seating = run(Effect.catch(chat.startAgentSession(node.id, "alpha"), () => Effect.void))
  await minting.promise
  await run(chat.stop)
  await seating
  // Long enough for an acquisition that outlived the stop to have finished
  // spawning and registered its slot.
  await run(Effect.sleep("1500 millis"))

  expect(chat.live().size).toBe(0)
  expect([...released].sort()).toEqual([...minted].sort())
  const ready = said.filter((line) => line.message.includes("chat agent ready"))
  const exited = said.filter((line) => line.message.includes("chat agent exited"))
  expect(exited).toHaveLength(ready.length)
}, 30_000)
}

test("the cap reaps an idle scope, refuses a busy one, and holds its one-shot wake", async () => {
  const { run, fork, said } = logging()
  let nodes: ReadonlyArray<NodeAgent> = [
    { kind: "node", beside: false, id: "one", file: "Work.olai", title: "one", engine: "alpha", session: null, memory: 2 },
    { kind: "node", beside: false, id: "two", file: "Work.olai", title: "two", engine: "beta", session: null, memory: 3 },
  ]
  const released: Array<string> = []
  const chat = await run(make({
    fork,
    scoping: await run(scopesIn(ephemeralLocalState())),
    roster: () => [seated(installed("alpha")), seated(installed("beta"))],
    cwd,
    tools: () => null,
    nodeAt: (id) => nodes.find((node) => node.id === id) ?? null,
    seatableAt: (id) => nodes.some((node) => node.id === id),
    nodes: () => nodes,
    wake: () => ACTIVATION,
    nearestAt: (id, candidates) => candidates.has(id) ? id : null,
    agentAt: ({ agent, session }) =>
      nodes.find((node) => node.engine === agent && node.session === session) ?? null,
    ticket: (node) => ({ bearer: `ticket-${node}`, release: () => released.push(node) }),
    capacity: 1,
    idle: "30 seconds",
    onState: () => {},
    onTranscript: () => {},
  }))

  try {
    await run(chat.start)
    await run(chat.startAgentSession("one", "alpha"))
    const oneSession = chat.state().session?.id ?? ""
    nodes = nodes.map((node) => node.id === "one" ? { ...node, session: oneSession } : node)
    chat.reread()

    // Leave the first slot idle and off-screen. The second acquisition must
    // make room by closing that whole scope, ticket included.
    await run(chat.newSession("beta"))
    await run(chat.startAgentSession("two", "beta"))
    const twoSession = chat.state().session?.id ?? ""
    nodes = nodes.map((node) => node.id === "two" ? { ...node, session: twoSession } : node)
    chat.reread()
    expect(released).toEqual(["one"])

    await run(chat.send("wait:2000", [], []))
    await until("the only slot to be busy", () => chat.live().get("two")?.status === "thinking")
    await run(chat.newSession("alpha"))

    const refused = await run(Effect.result(chat.loadSession("alpha", oneSession)))
    expect(refused._tag).toBe("Failure")
    if (refused._tag === "Failure") {
      // THE SENTENCE NAMES THE WAY OUT, and the cause is what a face branches
      // on: this refusal mends itself when somebody frees a seat, which is the
      // one thing that distinguishes it from every other busy answer.
      expect(refused.failure.message).toBe("All 1 agents are awake — put one to sleep in Chats.")
      expect(refused.failure._tag === "BusyFailure" && refused.failure.cause)
        .toEqual({ kind: "capacity", capacity: 1 })
    }

    // Clearing a sleeping conversation must also remove deliveries held by
    // the scheduler's capacity queue, without taking another plugin's body.
    await run(chat.scope({ agent: "alpha", session: oneSession }, "kolu", "Work.olai"))
    await run(chat.doorFor("kolu").deliver(
      chat.doorFor("kolu").scopes()[0]!, () => "cleared capacity delivery",
    ))
    await run(chat.scope({ agent: "alpha", session: oneSession }, "kolu", null))

    await run(chat.scope({ agent: "alpha", session: oneSession }, "odu", "Work.olai"))
    // This edge fires once. The same full-cap refusal must retain its thunk,
    // and opening the node after the busy slot settles must flush it.
    await run(chat.doorFor("odu").deliver(
      chat.doorFor("odu").scopes()[0]!,
      () => "one-shot first-red",
    ))
    await until("the busy slot to settle", () => chat.live().get("two")?.status === "idle")
    await run(chat.loadSession("alpha", oneSession))
    await until("the held wake to enter the conversation", () =>
      JSON.stringify([...chat.entries().values()]).includes("one-shot first-red"))
    expect(released).toEqual(["one", "two"])
    expect(JSON.stringify([...chat.entries().values()])).not.toContain("cleared capacity delivery")
  } finally {
    await run(chat.stop)
  }
  expect(said.some(line => line.message.includes("chat agent exited")
    && line.annotations.reason === "capacity eviction" && line.annotations.expected === true)).toBe(true)

}, 20_000)

/**
 * THE VERB, over real processes: a person's hand doing what the idle timer and
 * the capacity reaper do on their own.
 *
 * Three things are asked of it that nothing else asks. It closes a slot the
 * reaper would REFUSE to take (a turn is in flight, so `room`'s filter would
 * skip it); it hands the seat back, which is what a waiter is listening for;
 * and it leaves the conversation openable, which is the whole difference
 * between this and releasing the binding.
 */
test("put to sleep closes a busy scope, announces the seat and leaves the chat openable", async () => {
  const { run, fork, said } = logging()
  let nodes: ReadonlyArray<NodeAgent> = [
    { kind: "node", beside: false, id: "one", file: "Work.olai", title: "one", engine: "alpha", session: null, memory: 2 },
  ]
  const released: Array<string> = []
  const seats: Array<string> = []
  const chat = await run(make({
    fork,
    roster: () => [seated(installed("alpha"))],
    cwd,
    tools: () => null,
    nodeAt: (id) => nodes.find((node) => node.id === id) ?? null,
    seatableAt: (id) => nodes.some((node) => node.id === id),
    nodes: () => nodes,
    wake: () => ACTIVATION,
    nearestAt: (id, candidates) => candidates.has(id) ? id : null,
    agentAt: ({ agent, session }) =>
      nodes.find((node) => node.engine === agent && node.session === session) ?? null,
    ticket: (node) => ({ bearer: `ticket-${node}`, release: () => released.push(node) }),
    idle: "30 seconds",
    onState: () => {},
    onTranscript: () => {},
  }))
  const withdraw = chat.seats(() => seats.push("freed"))

  try {
    await run(chat.start)
    await run(chat.startAgentSession("one", "alpha"))
    const session = chat.state().session?.id ?? ""
    nodes = nodes.map((node) => node.id === "one" ? { ...node, session } : node)
    chat.reread()

    // A TURN IN FLIGHT, which is the case the reaper will not take: `room`
    // only closes a slot that is quiet, and this one is thinking.
    await run(chat.send("wait:2000", [], []))
    await until("the slot to be busy", () => chat.live().get("one")?.status === "thinking")

    await run(chat.sleep("one"))
    expect(chat.live().has("one")).toBe(false)
    expect(released).toEqual(["one"])
    expect(seats).toEqual(["freed"])

    // ...AND THE CHAT IS STILL THERE. Nothing was unbound, so the same pair
    // opens again and the scheduler seats it exactly as a reader would.
    await run(chat.loadSession("alpha", session))
    expect(chat.live().get("one")?.status).toBeString()

    // A node with nothing awake refuses rather than quietly doing nothing:
    // a verb pressed on an already-sleeping row has to say so.
    await run(chat.sleep("one"))
    const twice = await run(Effect.result(chat.sleep("one")))
    expect(twice._tag).toBe("Failure")
    if (twice._tag === "Failure") expect(twice.failure.message).toContain("no agent awake")
    // ...and the withdrawal is the whole of leaving: a listener taken off
    // hears nothing about the closes that follow it.
    withdraw()
    const heard = seats.length
    await run(chat.loadSession("alpha", session))
    await run(chat.sleep("one"))
    expect(seats.length).toBe(heard)
  } finally {
    withdraw()
    await run(chat.stop)
  }
  expect(said.some(line => line.message.includes("chat agent exited")
    && line.annotations.reason === "put to sleep" && line.annotations.expected === true)).toBe(true)
}, 20_000)

test("agent switches, disabled plugins and listing probes have distinct exit reasons", async () => {
  const { run, fork, said } = logging()
  let roster = [installed("alpha"), installed("beta")]
  const panel = await run(makePanel({
    roster: () => roster.map(seated),
    cwd,
    tools: () => null,
    memory: volatile(),
    onState: () => {},
    onTranscript: () => {},
  }))
  try {
    await run(panel.chooseAgent("alpha"))
    await run(panel.loadSession("alpha", "another-session"))
    // A conversation change on the same agent reuses its subprocess.
    expect(said.filter(line => line.message.includes("chat agent ready"))).toHaveLength(1)
    await run(panel.sessions)
    const probe = said.find(line => line.message.includes("chat agent exited")
      && line.annotations.purpose === "session list")
    expect(probe?.annotations.reason).toBe("session list complete")
    expect(probe?.annotations.expected).toBe(true)
    await run(panel.chooseAgent("beta"))
    roster = [installed("alpha")]
    await run(panel.enginesMoved)
    const reasons = said.filter(line => line.message.includes("chat agent exited"))
      .map(line => line.annotations.reason)
    expect(reasons).toEqual(["session list complete", "agent switched", "plugin disabled"])
  } finally {
    await run(panel.stop)
  }
})

test("node wake picks are off by default, independent, durable and clear the live inbox", async () => {
  const { run, fork } = logging()
  const local = ephemeralLocalState()
  const scoping = await run(scopesIn(local))
  const nodes: ReadonlyArray<NodeAgent> = [
    { kind: "node", beside: false, id: "one", file: "Work.olai", title: "one", engine: "alpha", session: "one-session", memory: 2 },
    { kind: "node", beside: false, id: "two", file: "Work.olai", title: "two", engine: "beta", session: "two-session", memory: 3 },
  ]
  const one = { agent: "alpha", session: "one-session" }
  const two = { agent: "beta", session: "two-session" }
  const chat = await run(make({
    fork, scoping, cwd,
    roster: () => [seated(installed("alpha")), seated(installed("beta"))],
    tools: () => null,
    nodeAt: (id) => nodes.find((node) => node.id === id) ?? null,
    seatableAt: (id) => nodes.some((node) => node.id === id),
    nodes: () => nodes,
    wake: (plugin) => plugin === "kolu" || plugin === "odu" ? ACTIVATION : undefined,
    nearestAt: (id, candidates) => candidates.has(id) ? id : null,
    agentAt: ({ agent, session }) => nodes.find((node) => node.engine === agent && node.session === session) ?? null,
    ticket: () => ({ bearer: "", release: () => {} }),
    onState: () => {}, onTranscript: () => {},
  }))
  try {
    expect(chat.doorFor("kolu").scopes()).toEqual([])
    expect(chat.doorFor("odu").scopes()).toEqual([])
    // Delivery-only plugins retain node recipients, through the same service.
    expect(chat.doorFor("agenda").scopes().map(({ current: _current, ...row }) => row)).toEqual([
      { ...one, pick: null }, { ...two, pick: null },
    ])
    await run(chat.scope(one, "kolu", "Other.olai"))
    await run(chat.scope(one, "odu", "Work.olai"))
    expect(chat.live().size).toBe(0)
    expect(chat.doorFor("kolu").scopes().map(({ current: _current, ...row }) => row)).toEqual([
      { ...one, pick: "Other.olai" },
    ])
    await run(chat.loadSession(one.agent, one.session))
    expect(chat.state().wake.map(({ name, pick }) => ({ name, pick }))).toEqual([
      { name: "kolu", pick: "Other.olai" }, { name: "odu", pick: "Work.olai" },
    ])
    await run(chat.scope(one, "kolu", "Work.olai"))
    expect(chat.state().wake.find((row) => row.name === "kolu")?.pick).toBe("Work.olai")
    await run(chat.loadSession(two.agent, two.session))
    expect(chat.state().wake).toEqual([])
    // A delayed choice for the other conversation cannot change this one's strip.
    await run(chat.scope(one, "kolu", "Other.olai"))
    expect(chat.state().wake).toEqual([])
    await run(chat.loadSession(one.agent, one.session))
    expect(chat.state().wake.find((row) => row.name === "kolu")?.pick).toBe("Other.olai")
    await run(chat.send("wait:5000", [], []))
    await until("a running turn", () => chat.state().status === "thinking")
    await run(chat.doorFor("kolu").deliver(chat.doorFor("kolu").scopes()[0]!, () => "discard this kolu delivery"))
    await run(chat.doorFor("odu").deliver(chat.doorFor("odu").scopes()[0]!, () => "keep this odu delivery"))
    expect(chat.state().wake.find((row) => row.name === "kolu")?.waiting).toBe(1)
    await run(chat.scope(one, "kolu", null))
    expect(chat.state().wake.map((row) => row.name)).toEqual(["odu"])
    expect(chat.doorFor("kolu").scopes()).toEqual([])
    await run(chat.cancel)
    await until("odu's queued message", () => JSON.stringify([...chat.entries().values()]).includes("keep this odu delivery"))
    expect(JSON.stringify([...chat.entries().values()])).not.toContain("discard this kolu delivery")
    await run(chat.scope(one, "odu", null))
    expect((await run(scopesIn(local))).rows()).toEqual([])
    expect(chat.doorFor("odu").scopes()).toEqual([])
  } finally {
    await run(chat.stop)
  }
}, 25_000)

test("trash releases a running node and takes its scopes with it", async () => {
  let present = true
  let released = false
  const node: NodeAgent = { kind: "node", beside: false, id: "trashed", file: "Work.olai", title: "trashed", engine: "alpha", session: "stored", memory: 1 }
  const local = ephemeralLocalState()
  const scoping = await run(scopesIn(local))
  const overheard = await run(sessionsIn(local))
  const chat = await run(make({
    fork: Effect.runFork, roster: () => [seated(installed("alpha"))], cwd,
    tools: () => null, nodeAt: () => present ? node : null, seatableAt: () => present,
    nodes: () => present ? [node] : [], wake: () => ACTIVATION,
    nearestAt: () => present ? node.id : null, agentAt: () => present ? node : null,
    ticket: () => ({ bearer: "trashed-ticket", release: () => { released = true } }),
    scoping, overheard, onState: () => {}, onTranscript: () => {},
  }))
  const scope = Scope.makeUnsafe()
  try {
    const to = { agent: "alpha", session: "stored" }
    await run(chat.scope(to, "kolu", "Work.olai"))
    expect(chat.doorFor("kolu").scopes()).toHaveLength(1)
    await run(chat.start)
    await run(chat.reading(to, { state: () => {}, transcript: () => {} }).pipe(Effect.provideService(Scope.Scope, scope)))
    expect(chat.live().size).toBe(1)
    const recipient = chat.doorFor("kolu").scopes()[0]!
    present = false
    chat.reread()
    await until("the trashed agent credential to be released", () => released)
    expect(chat.live().size).toBe(0)
    expect(chat.doorFor("kolu").scopes()).toHaveLength(0)
    expect(recipient.current()).toBe(false)
  } finally {
    await run(Scope.close(scope, Exit.void))
    await run(chat.stop)
  }
})

/** A visit and a node address are never answered `null` (`Chat.reading`); a
 *  bench that reads one says so rather than carrying the case around. */
const served = <A, E, R>(reading: Effect.Effect<A | null, E, R>): Effect.Effect<A, E, R> =>
  Effect.flatMap(reading, (panel) => panel === null ? Effect.die("a visit was answered with nothing") : Effect.succeed(panel))


/** The node binding deliberately lags behind the live slot. Probes can be
 * held with Deferreds so the tests choose ordering without wall-clock sleeps.
 * `args` reaches the fixture process, so a bench can have an engine that will
 * not load a conversation — which is what a machine that never had it is. */
const withLaggingBinding = async (use: (bench: {
  chat: Effect.Success<ReturnType<typeof make>>
  bind: (session: string) => void
  probe: (ask: Effect.Effect<void>) => void
  read: (session: string) => Effect.Effect<Effect.Success<ReturnType<typeof makePanel>>, OpFailure>
  /** The reader the BROWSER holds while a node's chat is refused: the node
   *  address, whose pair is whatever the durable binding currently says. */
  readNode: () => Effect.Effect<Effect.Success<ReturnType<typeof makePanel>>, OpFailure>
  /** The reader a page holds while it FOLLOWS the node's chat: the pair its
   *  roster last named, asked for as the node's CURRENT chat — which the
   *  scheduler serves only while it still is, answering `null` otherwise. */
  follow: (session: string) => Effect.Effect<Effect.Success<ReturnType<typeof makePanel>> | null, OpFailure>
  said: ReturnType<typeof logging>["said"]
  /** Runs an effect under the collector, so the lines `said` counts are its. */
  run: ReturnType<typeof logging>["run"]
  /** How many MCP credentials have been minted: one per seat acquired. */
  tickets: () => number
  /** ...and how many have been released: one per seat closed. */
  returned: () => number
  /** Point `agentAt` alone at a session, leaving `nodeAt`'s binding as it is:
   *  the two readings of one tie disagreeing, as they do for an instant when
   *  the tie changes under a reader, held still so a case can stand in it. */
  claim: (session: string) => void
}) => Promise<void>, args: ReadonlyArray<string> = []) => {
  const { run, fork, said } = logging()
  let minted = 0
  let back = 0
  let node: NodeAgent = {
    kind: "node", beside: false, id: "one", file: "Work.olai", title: "one", engine: "alpha", session: null, memory: 2,
  }
  let claimed: string | null = null
  let ask: Effect.Effect<void> = Effect.void
  const tab = Scope.makeUnsafe()
  const chat = await run(make({
    fork, roster: () => [seated(alphaWith(args))], cwd, tools: () => null,
    probes: () => Effect.succeed([{
      name: "fixture",
      ask: Effect.suspend(() => ask).pipe(Effect.as({ server: null, missing: null })),
    }]),
    nodeAt: id => id === node.id ? node : null,
    seatableAt: id => id === node.id,
    nodes: () => [node], wake: () => undefined,
    nearestAt: (id, candidates) => candidates.has(id) ? id : null,
    agentAt: to => to.agent === node.engine && to.session === (claimed ?? node.session) ? node : null,
    ticket: () => { minted += 1; return { bearer: "ticket-one", release: () => { back += 1 } } },
    onState: () => {}, onTranscript: () => {},
  }))
  try {
    await run(chat.start)
    await use({
      chat,
      bind: session => { node = { ...node, session } },
      probe: next => { ask = next },
      read: session => served(chat.reading({ agent: "alpha", session }, {
        state: () => {}, transcript: () => {},
      })).pipe(Effect.provideService(Scope.Scope, tab)),
      readNode: () => served(chat.reading({ node: "one" }, {
        state: () => {}, transcript: () => {},
      })).pipe(Effect.provideService(Scope.Scope, tab)),
      follow: session => {
        const to = { agent: "alpha", session, current: true as const }
        return chat.reading(to, { state: () => {}, transcript: () => {} }).pipe(Effect.provideService(Scope.Scope, tab))
      },
      said,
      run,
      tickets: () => minted,
      returned: () => back,
      claim: session => { claimed = session },
    })
  } finally {
    await run(Scope.close(tab, Exit.void))
    await run(chat.stop)
  }
}

test("a completed fresh-start routes a reader of the lagging binding to history", async () => {
  await withLaggingBinding(async ({ chat, bind, read }) => {
    const first = (await run(chat.startAgentSession("one", "alpha")))!
    bind(first.session)
    const second = (await run(chat.startAgentSession("one", "alpha")))!
    const history = await run(read(first.session))
    expect(history.state().session?.id).toBe(first.session)
    expect(chat.state().session?.id).toBe(second!.session)
    expect(second!.session).not.toBe(first.session)
  })
})

test("a fresh-start queued behind a third opener supersedes the late reader's session", async () => {
  await withLaggingBinding(async ({ chat, bind, read, probe }) => {
    bind("stored")
    await run(Effect.scoped(Effect.gen(function*() {
      const reached = yield* Deferred.make<void>()
      const release = yield* Deferred.make<void>()
      probe(Effect.gen(function*() {
        probe(Effect.void)
        yield* Deferred.succeed(reached, undefined)
        yield* Deferred.await(release)
      }))
      const third = yield* Effect.forkChild(read("stored"), { startImmediately: true })
      yield* Deferred.await(reached)
      // Immediate forks run to their first suspension: both queue on the live
      // opening permit, in this order, while the third opener holds it.
      const fresh = yield* Effect.forkChild(chat.startAgentSession("one", "alpha"), { startImmediately: true })
      const late = yield* Effect.forkChild(read("stored"), { startImmediately: true })
      yield* Deferred.succeed(release, undefined)
      yield* Fiber.join(third)
      const second = yield* Fiber.join(fresh)
      const history = yield* Fiber.join(late)
      expect(history.state().session?.id).toBe("stored")
      expect(chat.state().session?.id).toBe(second!.session)
      expect(second!.session).not.toBe("stored")
    })))
  })
})

test("a held history load leaves the live opening permit available", async () => {
  await withLaggingBinding(async ({ chat, bind, read, probe }) => {
    const first = (await run(chat.startAgentSession("one", "alpha")))!
    bind(first.session)
    await run(chat.startAgentSession("one", "alpha"))
    await run(Effect.scoped(Effect.gen(function*() {
      const reached = yield* Deferred.make<void>()
      const release = yield* Deferred.make<void>()
      probe(Effect.gen(function*() {
        probe(Effect.void)
        yield* Deferred.succeed(reached, undefined)
        yield* Deferred.await(release)
      }))
      const history = yield* Effect.forkChild(read(first.session), { startImmediately: true })
      yield* Deferred.await(reached)
      // Completion, while history remains held, proves permit independence.
      // The timeout only bounds a regression; it does not arrange the order.
      const next = yield* chat.startAgentSession("one", "alpha").pipe(Effect.timeout("2 seconds"))
      expect(chat.state().session?.id).toBe(next!.session)
      yield* Deferred.succeed(release, undefined)
      expect((yield* Fiber.join(history)).state().session?.id).toBe(first.session)
      expect(chat.state().session?.id).toBe(next!.session)
    })))
  })
})


test("explicit navigation to a superseded session uses history despite a lagging binding", async () => {
  await withLaggingBinding(async ({ chat, bind, read }) => {
    const first = (await run(chat.startAgentSession("one", "alpha")))!
    bind(first.session)
    const live = await run(read(first.session))
    const second = (await run(chat.startAgentSession("one", "alpha")))!
    await run(chat.loadSession(first.agent, first.session))
    // Navigation selects history for the foreground, without replacing the
    // session held by the original live panel or rewriting the binding.
    expect(chat.state().session?.id).toBe(first.session)
    expect(live.state().session?.id).toBe(second!.session)
    expect(second!.session).not.toBe(first.session)
  })
})

/**
 * THE CHAT THAT IS NOT ON THIS MACHINE — the superseding rule met from the one
 * side it did not cover.
 *
 * Every case above starts from a conversation that OPENED, so the pair a fresh
 * start replaces is on `state.session` and `startAgentSession` could read it
 * there. A binding carried to another machine never opens at all: the engine
 * answers `session/load` with a no, the slot holds a REFUSED pair
 * (`state.unopened.what`) and `state.session` is `null` — so nothing was
 * recorded as superseded, and a reader still holding the lagging binding
 * reached the LIVE slot and loaded the lost id straight over the conversation
 * the fresh start had just opened. The same refusal came back, and its *Try
 * again* pointed at the id that will never load: *Fresh start* looked like it
 * did nothing at all.
 */
test("a fresh start after a refused load supersedes the lost pair", async () => {
  await withLaggingBinding(async ({ chat, bind, read }) => {
    bind("stored")
    const refused = await run(read("stored"))
    expect(refused.state().unopened?.what).toBe("stored")
    expect(refused.state().session).toBe(null)

    const fresh = (await run(chat.startAgentSession("one", "alpha")))!
    expect(chat.state().session?.id).toBe(fresh.session)

    // The durable write has not landed yet, so a reader minted from the
    // binding still names the conversation the engine does not have.
    await run(read("stored"))
    expect(chat.state().session?.id).toBe(fresh.session)
    expect(chat.state().unopened).toBe(null)
  }, ["--refuse-load"])
})

/** ...AND FOR THE READER THE BROWSER ACTUALLY HOLDS. A node whose chat is
 *  refused has no pair to subscribe to, so the tab reads the NODE address and
 *  the scheduler reconciles it against the durable binding — which lags. That
 *  reconcile is a second door onto the same lost id, and it has to be shut by
 *  the same record. */
test("a node reader of the lagging binding does not retry the lost chat", async () => {
  await withLaggingBinding(async ({ chat, bind, readNode }) => {
    bind("stored")
    const first = await run(readNode())
    expect(first.state().unopened?.what).toBe("stored")

    const fresh = (await run(chat.startAgentSession("one", "alpha")))!
    await run(readNode())
    expect(chat.state().session?.id).toBe(fresh.session)
    expect(chat.state().unopened).toBe(null)
  }, ["--refuse-load"])
})

/**
 * ...AND THE NODE DOOR STOPS DISTRUSTING THE BINDING THE MOMENT IT CATCHES UP.
 *
 * The skip above is about a WRITE THAT HAS NOT ARRIVED, not about the pair
 * itself: `superseded` lives as long as the slot, and if the node door read it
 * the node would ignore its own property for the rest of that life — so a
 * binding pointed back at the replaced chat (an undo, a pull from the machine
 * that minted it) would draw the fresh chat while the file said otherwise. The
 * node door reads `lagging`, which empties as soon as the binding reads
 * anything this slot is not waiting on.
 */
test("a binding re-pointed back at a replaced chat is opened once the write has landed", async () => {
  await withLaggingBinding(async ({ chat, bind, readNode }) => {
    bind("stored")
    await run(readNode())
    const fresh = (await run(chat.startAgentSession("one", "alpha")))!

    // The write lands, and a reader sees it: the wait is over.
    bind(fresh.session)
    await run(readNode())
    expect(chat.state().session?.id).toBe(fresh.session)

    // Now the property says the old chat again. That is somebody asking for
    // it, and the engine's refusal of it is the honest answer.
    bind("stored")
    const back = await run(readNode())
    expect(back.state().unopened?.what).toBe("stored")
  }, ["--refuse-load"])
})

/** How many agent processes this bench has started so far. */
const started = (said: ReadonlyArray<{ message: string }>): number =>
  said.filter((line) => line.message.includes("chat agent ready")).length

/**
 * A PAGE FOLLOWING A NODE'S CHAT ASKS FOR IT BY PAIR, AND ITS PAIR CAN BE ONE
 * BEHIND. The roster it read named the chat a fresh start has just replaced:
 * the press ended a history visit before the request went out, or a frame
 * from inside the fresh start still carried the old binding. Read as a visit,
 * that ask opened the old chat in a history seat of its own: an agent nobody
 * wanted, abandoned a few milliseconds later when the page's roster moved.
 *
 * Asked as the node's CURRENT chat, it is served only while it is, and
 * otherwise the reading holds nothing.
 */
test("following the chat a fresh start just replaced starts no agent", async () => {
  await withLaggingBinding(async ({ chat, bind, follow, said, tickets, run }) => {
    const first = (await run(chat.startAgentSession("one", "alpha")))!
    bind(first.session)
    const second = (await run(chat.startAgentSession("one", "alpha")))!
    // The durable write has not landed: the binding still names `first`.
    const agents = started(said)
    const seats = tickets()
    const followed = await run(follow(first.session))
    expect(started(said)).toBe(agents)
    expect(tickets()).toBe(seats)
    expect(followed).toBe(null)
    expect(chat.state().session?.id).toBe(second.session)
  })
})

/** ...and once the write HAS landed, the old pair names no node at all. That
 *  is the case a visit answers by asking the engine for its stored sessions —
 *  with the node asleep, a process started only to ask — and then opening the
 *  pair beside every node. A follow asks nothing and opens nothing. */
test("following a pair no node is bound to asks the engine nothing", async () => {
  await withLaggingBinding(async ({ chat, bind, follow, said, tickets, run }) => {
    const first = (await run(chat.startAgentSession("one", "alpha")))!
    bind(first.session)
    const second = (await run(chat.startAgentSession("one", "alpha")))!
    bind(second.session)
    await run(chat.sleep("one"))
    const lines = said.length
    const seats = tickets()
    const followed = await run(follow(first.session))
    expect(said.slice(lines).filter((line) => line.annotations["purpose"] === "session list")).toEqual([])
    expect(started(said.slice(lines))).toBe(0)
    expect(tickets()).toBe(seats)
    expect(followed).toBe(null)
  })
})

/** ...and for the chat that would not open, where a load is not merely wasted
 *  but refused: following the lost pair after a fresh start tries nothing. */
test("following the lost chat after a fresh start tries no load", async () => {
  await withLaggingBinding(async ({ chat, bind, follow, readNode, said, run }) => {
    bind("stored")
    expect((await run(readNode())).state().unopened?.what).toBe("stored")
    const fresh = (await run(chat.startAgentSession("one", "alpha")))!
    const agents = started(said)
    const followed = await run(follow("stored"))
    expect(started(said)).toBe(agents)
    expect(followed).toBe(null)
    expect(chat.state().session?.id).toBe(fresh.session)
    expect(chat.state().unopened).toBe(null)
  }, ["--refuse-load"])
})

/** THE OTHER HALF: a follow of the chat the node IS bound to opens it, at
 *  once, with one agent — nothing about asking as a follower holds a real
 *  open back. */
test("following the node's bound chat with nobody awake opens it with one agent", async () => {
  await withLaggingBinding(async ({ bind, follow, said, tickets, run }) => {
    bind("stored")
    const agents = started(said)
    const panel = await run(follow("stored"))
    expect(panel?.state().session?.id).toBe("stored")
    expect(started(said)).toBe(agents + 1)
    expect(tickets()).toBe(1)
  })
})

/** A binding pointed BACK at a replaced chat (an undo, a pull from the other
 *  machine) makes it the node's chat again, and a follower opens it where the
 *  node's chat lives: the node's own seat, not a history seat beside it. */
test("following a binding re-pointed back at a replaced chat opens it in the node's seat", async () => {
  await withLaggingBinding(async ({ chat, bind, follow, run }) => {
    const first = (await run(chat.startAgentSession("one", "alpha")))!
    bind(first.session)
    const second = (await run(chat.startAgentSession("one", "alpha")))!
    bind(second.session)
    // A reader sees the write land.
    const live = (await run(follow(second.session)))!
    expect(live.state().session?.id).toBe(second.session)

    bind(first.session)
    const back = await run(follow(first.session))
    expect(back).toBe(live)
    expect(live.state().session?.id).toBe(first.session)
  })
})

/** A fresh start whose binding write FAILED leaves the node bound to the chat
 *  it meant to replace, so that chat is still the node's. Its claim on that
 *  pair goes with the write: a follower is served it in the node's seat, not
 *  left with nothing. */
test("a fresh start whose binding write fails gives the old chat back to its followers", async () => {
  await withLaggingBinding(async ({ chat, bind, follow, readNode, run }) => {
    const first = (await run(chat.startAgentSession("one", "alpha")))!
    bind(first.session)
    const failed = await run(Effect.result(chat.startAgentSession("one", "alpha", () =>
      Effect.fail(new UsageFailure({ reason: "the binding could not be written" })))))
    expect(failed._tag).toBe("Failure")

    const followed = await run(follow(first.session))
    expect(followed?.state().session?.id).toBe(first.session)
    expect(followed).toBe(await run(readNode()))
  })
})

/** ...AND SO DOES ONE CUT OFF BEFORE ITS WRITE BEGAN: the tab that pressed
 *  went away, and the request went with it. The interrupt here lands while
 *  the new chat is being announced to the node's readers, after the seat has
 *  claimed the old pair and before the write that would justify the claim. */
test("a fresh start cut off before its binding write gives the old chat back to its followers", async () => {
  await withLaggingBinding(async ({ chat, bind, follow, readNode, run }) => {
    const first = (await run(chat.startAgentSession("one", "alpha")))!
    bind(first.session)
    const reader = Scope.makeUnsafe()
    let start: Fiber.Fiber<unknown, unknown> | undefined
    let wrote = false
    try {
      await run(chat.reading({ node: "one" }, {
        state: (state) => {
          if (start !== undefined && state.session !== null && state.session.id !== first.session) start.interruptUnsafe()
        },
        transcript: () => {},
      }).pipe(Effect.provideService(Scope.Scope, reader)))
      start = Effect.runFork(chat.startAgentSession("one", "alpha", () => Effect.sync(() => { wrote = true })))
      expect(Exit.hasInterrupts(await Effect.runPromise(Fiber.await(start)))).toBe(true)
      expect(wrote).toBe(false)

      const followed = await run(follow(first.session))
      expect(followed?.state().session?.id).toBe(first.session)
      expect(followed).toBe(await run(readNode()))
    } finally {
      await run(Scope.close(reader, Exit.void))
    }
  })
})

/** ...WHILE A WRITE ALREADY UNDER WAY IS NOT CUT: it completes, the claim it
 *  justifies stands, and a follower of the replaced pair is answered with
 *  nothing until the binding the bench reads catches up. */
test("a fresh start interrupted during its binding write finishes the write, and its claim stands", async () => {
  await withLaggingBinding(async ({ chat, bind, follow, run }) => {
    const first = (await run(chat.startAgentSession("one", "alpha")))!
    bind(first.session)
    let wrote = false
    await run(Effect.scoped(Effect.gen(function*() {
      const writing = yield* Deferred.make<void>()
      const release = yield* Deferred.make<void>()
      const start = yield* Effect.forkChild(chat.startAgentSession("one", "alpha", () => Effect.gen(function*() {
        yield* Deferred.succeed(writing, undefined)
        yield* Deferred.await(release)
        wrote = true
      })), { startImmediately: true })
      yield* Deferred.await(writing)
      const stopping = yield* Effect.forkChild(Fiber.interrupt(start), { startImmediately: true })
      yield* Deferred.succeed(release, undefined)
      yield* Fiber.join(stopping)
    })))
    expect(wrote).toBe(true)
    expect(await run(follow(first.session))).toBe(null)
  })
})

/** A FOLLOWER ANSWERED "NO" HOLDS NOTHING, a seat included. The tie this
 *  follower read names the pair, so a seat is acquired for its node; by then
 *  the node's own binding says otherwise, and the seat made only to say so
 *  is closed again, its credential with it. */
test("a follower answered no from a seat it made leaves no seat behind", async () => {
  await withLaggingBinding(async ({ chat, claim, follow, tickets, returned, run }) => {
    claim("stored")
    expect(await run(follow("stored"))).toBe(null)
    expect(tickets()).toBe(1)
    expect(returned()).toBe(1)
    expect(chat.live().size).toBe(0)
  })
})

/**
 * AN OPEN NOBODY WAITED FOR LEAVES THE PANEL AS IT FOUND IT — the retry half
 * of the bring-up fix (`chat.ts`'s `changeSession`).
 *
 * A refusal puts up a face with a button on it, and the attempt behind that
 * button is TAKEN by the press: `reopen` empties the slot before it opens
 * anything, so an open that is given up on halfway — the reader that asked for
 * it went away, and this scheduler opens inside the reading — would leave the
 * one pair this panel says must not be constructible: a body offering *Try
 * again* with nothing behind it, whose button can only answer *no conversation
 * is waiting to be opened*.
 *
 * So both halves come back: the attempt, and the status the refusal was drawn
 * over. The probe is what makes the interrupt land INSIDE the open — a held
 * Deferred rather than a sleep — and the second press is what says the
 * restored attempt is the live one rather than a field nobody reads.
 */
test("an open given up on over a refusal puts the retry and its face back", async () => {
  await withLaggingBinding(async ({ bind, read, probe }) => {
    bind("stored")
    const refused = await run(read("stored"))
    expect(refused.state().unopened?.what).toBe("stored")
    expect(refused.state().status).toBe("idle")

    await run(Effect.scoped(Effect.gen(function*() {
      const reached = yield* Deferred.make<void>()
      const release = yield* Deferred.make<void>()
      probe(Effect.gen(function*() {
        // The NEXT open runs freely: this one is the one being abandoned.
        probe(Effect.void)
        yield* Deferred.succeed(reached, undefined)
        yield* Deferred.await(release)
      }))
      const press = yield* Effect.forkChild(refused.reopen, { startImmediately: true })
      yield* Deferred.await(reached)
      // The slot is empty while the open is in flight — that is what makes
      // this the case the restore exists for.
      yield* Fiber.interrupt(press)
      yield* Deferred.succeed(release, undefined)
    })))

    expect(refused.state().unopened?.what).toBe("stored")
    expect(refused.state().status).toBe("idle")
    // ... and the button works: the retry that comes back is the attempt
    // itself, so pressing it reaches the agent and is refused again rather
    // than answering that nothing is waiting.
    const again = await run(Effect.result(refused.reopen))
    expect(again._tag).toBe("Failure")
    if (again._tag === "Failure") {
      expect(again.failure.reason).toContain("refused on purpose")
    }
    expect(refused.state().unopened?.what).toBe("stored")
  }, ["--refuse-load"])
})
