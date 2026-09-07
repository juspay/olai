/**
 * The node-agent scheduler over real ACP subprocesses.
 *
 * These are not panel tests repeated twice. The facts here only exist one
 * level above a panel: two nodes remain live while either one is foreground,
 * a delivery addresses the sleeping one by durable binding, and an idle scope
 * releases its process credential before the next wake acquires another.
 */

import type { NodeAgent } from "@olai/format"
import { collector } from "@olai/log/testlib"
import { afterEach, beforeEach, expect, test } from "bun:test"
import { Effect, References } from "effect"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { QUEUES } from "./agents/legs.testlib.ts"
import type { Installed } from "./agents/roster.ts"
import { ephemeralLocalState } from "./local.ts"
import { forLocalState } from "./memory.ts"
import { make } from "./scoped.ts"
import { makePanel } from "./chat.ts"


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
    { id: "one", file: "Work.olai", title: "one", engine: "alpha", session: null, memory: 2 },
    { id: "two", file: "Work.olai", title: "two", engine: "beta", session: null, memory: 3 },
  ]
  const released: Array<string> = []
  const chat = await run(make({
    // THE BENCH'S OWN RUNTIME, said out loud. `Options.fork` has no default —
    // one would have to be `Effect.runFork`, which is the unowned default
    // runtime this scheduler stopped reaching for. A bench chooses it here,
    // where the choice is visible, and `logging()`'s carries the collector.
    fork,
    roster: () => [installed("alpha"), installed("beta")],
    engines: () => ["alpha", "beta"],
    cwd,
    tools: () => null,
    nodeAt: (id) => nodes.find((node) => node.id === id) ?? null,
    seatableAt: (id) => nodes.some((node) => node.id === id),
    nodes: () => nodes,
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

    await run(chat.loadSession("alpha", oneSession ?? ""))
    await run(chat.send("wait:350", [], []))
    await until("the first node to work", () => chat.live().get("one")?.status === "thinking")

    await run(chat.loadSession("beta", twoSession ?? ""))
    await run(chat.send("wait:350", [], []))
    await until("both node scopes to work", () =>
      chat.live().get("one")?.status === "thinking"
      && chat.live().get("two")?.status === "thinking")

    await until("the background scope to reap", () =>
      !chat.live().has("one") && released.length === 1)
    const afterReap = [...released]
    if (afterReap.length !== 1 || afterReap[0] !== "one") {
      throw new Error(`the reap released ${JSON.stringify(afterReap)}`)
    }

    await run(chat.doorFor("kolu").deliver(
      { agent: "alpha", session: oneSession ?? "" },
      () => "wake in the background",
    ))
    await until("the sleeping scope to wake and finish", () => chat.live().get("one")?.status === "idle")
    expect(chat.state().bound).toBe("two")
    expect(chat.live().has("two")).toBe(true)
  } finally {
    await run(chat.stop)
  }

  expect(released.toSorted()).toEqual(["one", "one", "two"])
  expect(said.some(line => line.message.includes("chat agent exited")
    && line.annotations.reason === "idle eviction" && line.annotations.node === "one")).toBe(true)
})

test("boot routes a remembered node session before spawning any panel", async () => {
  let probes = 0
  const remembered: NodeAgent = {
    id: "one",
    file: "Work.olai",
    title: "one",
    engine: "alpha",
    session: "remembered",
    memory: 2,
  }
  // The composition root builds chat before the surface. Its carrier is
  // seeded between construction and start, and the scheduler must read that
  // live value when it routes remembered memory.
  let nodes: ReadonlyArray<NodeAgent> = []
  const memory = forLocalState(ephemeralLocalState(), "alpha")
  await run(memory.remember({ agent: "alpha", session: "remembered", model: null }))

  const { layer, said } = collector()
  const under = <A, E>(effect: Effect.Effect<A, E>): Effect.Effect<A, E> =>
    effect.pipe(
      Effect.provideService(References.MinimumLogLevel, "Info"),
      Effect.provide(layer),
    )
  const logged = <A, E>(effect: Effect.Effect<A, E>): Promise<A> => Effect.runPromise(under(effect))
  const chat = await logged(make({
    fork: (work) => Effect.runFork(under(work)),
    roster: () => [installed("alpha")],
    engines: () => ["alpha"],
    cwd,
    memory,
    probes: () => Effect.succeed([{
      name: "startup-probe",
      ask: Effect.sync(() => {
        probes++
        return { server: null, missing: null }
      }),
    }]),
    tools: () => null,
    nodeAt: (id) => nodes.find((node) => node.id === id) ?? null,
    seatableAt: (id) => nodes.some((node) => node.id === id),
    nodes: () => nodes,
    nearestAt: (id, candidates) => candidates.has(id) ? id : null,
    agentAt: ({ agent, session }) =>
      nodes.find((node) => node.engine === agent && node.session === session) ?? null,
    ticket: (node) => ({ bearer: `ticket-${node}`, release: () => {} }),
    onState: () => {},
    onTranscript: () => {},
  }))
  nodes = [remembered]

  try {
    await logged(chat.start)
    await until("the remembered node session to load", () =>
      chat.state().bound === "one" && chat.state().status === "idle")
    expect(said.filter((line) => line.message.includes("chat agent ready"))).toHaveLength(1)
    expect(said.filter((line) => line.message.includes("conversation opened"))).toHaveLength(1)
    expect(probes).toBe(1)
  } finally {
    await logged(chat.stop)
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
test("a shutdown that lands mid-boot leaves no scope, no ticket and no process", async () => {
  const { run, fork, said } = logging()
  const node: NodeAgent = {
    id: "one",
    file: "Work.olai",
    title: "one",
    engine: "alpha",
    session: "remembered",
    memory: 2,
  }
  // REMEMBERED, so the boot goes straight for the node scope rather than
  // through a root session first — the longest walk, and the one with a
  // credential and a subprocess in the middle of it.
  const memory = forLocalState(ephemeralLocalState(), "alpha")
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
    roster: () => [installed("alpha")],
    engines: () => ["alpha"],
    cwd,
    memory,
    tools: () => null,
    nodeAt: (id) => id === node.id ? node : null,
    seatableAt: (id) => id === node.id,
    nodes: () => [node],
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
  await minting.promise
  await run(chat.stop)
  // Long enough for a boot that outlived the stop to have reached its
  // `session/load` and registered a slot.
  await run(Effect.sleep("1500 millis"))

  expect(chat.live().size).toBe(0)
  expect([...released].sort()).toEqual([...minted].sort())
  const ready = said.filter((line) => line.message.includes("chat agent ready"))
  const exited = said.filter((line) => line.message.includes("chat agent exited"))
  expect(exited).toHaveLength(ready.length)
}, 30_000)

test("boot moves a newly identified node session into its scope", async () => {
  const { run, fork, said } = logging()
  const node: NodeAgent = {
    id: "one",
    file: "Work.olai",
    title: "one",
    engine: "alpha",
    // The fixture returns this id from `session/new`. With no remembered
    // memory the scheduler cannot know that until the root boot answers.
    session: "sess-1",
    memory: 2,
  }
  const released: Array<string> = []
  const chat = await run(make({
    fork,
    roster: () => [installed("alpha")],
    engines: () => ["alpha"],
    cwd,
    tools: () => null,
    nodeAt: (id) => id === node.id ? node : null,
    seatableAt: (id) => id === node.id,
    nodes: () => [node],
    nearestAt: (id, candidates) => candidates.has(id) ? id : null,
    agentAt: ({ agent, session }) =>
      node.engine === agent && node.session === session ? node : null,
    ticket: (held) => ({ bearer: `ticket-${held}`, release: () => released.push(held) }),
    onState: () => {},
    onTranscript: () => {},
  }))

  try {
    await run(chat.start)
    await until("the newly identified session to enter its node scope", () =>
      chat.state().bound === "one" && chat.live().get("one")?.status === "idle")
  } finally {
    await run(chat.stop)
  }

  expect(released).toEqual(["one"])
  const handoff = said.find(line => line.message.includes("moving conversation into node scope"))
  expect(handoff?.annotations.node).toBe("one")
  const exits = said.filter(line => line.message.includes("chat agent exited"))
  expect(exits.map(line => line.annotations.reason)).toEqual(["node scope handoff", "shutdown"])
  expect(exits[0]?.annotations.session).toBe("sess-1")
  expect(exits[0]?.annotations.expected).toBe(true)
  const ready = said.filter(line => line.message.includes("chat agent ready"))
  expect(ready).toHaveLength(2)
  expect(ready[0]?.annotations.pid).toBe(exits[0]?.annotations.pid)
  expect(ready[1]?.annotations.pid).not.toBe(ready[0]?.annotations.pid)
  expect(ready[1]?.annotations.node).toBe("one")
  expect(ready[1]?.annotations.purpose).toBe("conversation")
})

test("the cap reaps an idle scope, refuses a busy one, and holds its one-shot wake", async () => {
  const { run, fork, said } = logging()
  let nodes: ReadonlyArray<NodeAgent> = [
    { id: "one", file: "Work.olai", title: "one", engine: "alpha", session: null, memory: 2 },
    { id: "two", file: "Work.olai", title: "two", engine: "beta", session: null, memory: 3 },
  ]
  const released: Array<string> = []
  const chat = await run(make({
    fork,
    roster: () => [installed("alpha"), installed("beta")],
    engines: () => ["alpha", "beta"],
    cwd,
    tools: () => null,
    nodeAt: (id) => nodes.find((node) => node.id === id) ?? null,
    seatableAt: (id) => nodes.some((node) => node.id === id),
    nodes: () => nodes,
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
      expect(refused.failure.message).toContain("1 node agents are already live")
    }

    // This edge fires once. The same full-cap refusal must retain its thunk,
    // and opening the node after the busy slot settles must flush it.
    await run(chat.doorFor("odu").deliver(
      { agent: "alpha", session: oneSession },
      () => "one-shot first-red",
    ))
    await until("the busy slot to settle", () => chat.live().get("two")?.status === "idle")
    await run(chat.loadSession("alpha", oneSession))
    await until("the held wake to enter the conversation", () =>
      JSON.stringify([...chat.entries().values()]).includes("one-shot first-red"))
    expect(released).toEqual(["one", "two"])
  } finally {
    await run(chat.stop)
  }
  expect(said.some(line => line.message.includes("chat agent exited")
    && line.annotations.reason === "capacity eviction" && line.annotations.expected === true)).toBe(true)

})

test("agent switches, disabled plugins and listing probes have distinct exit reasons", async () => {
  const { run, fork, said } = logging()
  let roster = [installed("alpha"), installed("beta")]
  const panel = await run(makePanel({
    roster: () => roster,
    engines: () => roster.map(row => row.id),
    cwd,
    tools: () => null,
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
