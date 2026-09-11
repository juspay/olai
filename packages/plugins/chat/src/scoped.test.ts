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
import { Effect, Exit, References, Scope } from "effect"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { QUEUES } from "./agents/legs.testlib.ts"
import type { Installed } from "./agents/roster.ts"
import { ephemeralLocalState } from "./local.ts"
import { forLocalState } from "./memory.ts"
import { make } from "./scoped.ts"
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
    { id: "one", file: "Work.olai", title: "one", engine: "alpha", session: null, memory: 2 },
    { id: "two", file: "Work.olai", title: "two", engine: "beta", session: null, memory: 3 },
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
    roster: () => [installed("alpha"), installed("beta")],
    engines: () => ["alpha", "beta"],
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

    await run(chat.doorFor("kolu").deliver(
      chat.doorFor("kolu").scopes().find((row) => row.agent === "alpha")!,
      () => "wake in the background",
    ))
    await until("the sleeping scope to wake and finish", () => chat.live().get("one")?.status === "idle")
    expect(chat.state().bound).toBe("two")
    expect(chat.live().has("two")).toBe(true)
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
    wake: () => ACTIVATION,
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

/**
 * ...AND THE SAME SHUTDOWN LANDING ON A PATH THAT IS NOT THE BOOT.
 *
 * Owning the boot fiber closes the boot's window and only the boot's. Every
 * acquisition takes several yields to spawn a panel, and three others reach it
 * — `reread`'s relocation, `assignedTo`, and a session started at a node — so
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
for (const path of ["a session started at a node", "a relocation"] as const) {
test(`a shutdown that lands mid-acquisition during ${path} leaves nothing behind`, async () => {
  const { run, fork, said } = logging()
  const node: NodeAgent = {
    id: "one",
    file: "Work.olai",
    title: "one",
    engine: "alpha",
    session: null,
    memory: 2,
  }
  const minted: Array<string> = []
  const released: Array<string> = []
  // The same latch the boot case uses, and for the same reason: the credential
  // is minted immediately after the shutting-down check and immediately before
  // anything is spawned, so a stop that waits for it lands in the window.
  const minting = Promise.withResolvers<void>()
  const chat = await run(make({
    fork,
    roster: () => [installed("alpha")],
    engines: () => ["alpha"],
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
  if (path === "a relocation") {
    await run(chat.start)
    await until("the root conversation to open", () =>
      chat.state().session !== null && chat.state().status === "idle")
  }
  const seating = run(Effect.catch(
    path === "a session started at a node"
      ? chat.startAgentSession(node.id, "alpha")
      : chat.assignedTo(node.id, {
        agent: "alpha",
        session: chat.state().session?.id ?? "",
      }),
    () => Effect.void,
  ))
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
    wake: () => ACTIVATION,
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
    scoping: await run(scopesIn(ephemeralLocalState())),
    roster: () => [installed("alpha"), installed("beta")],
    engines: () => ["alpha", "beta"],
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
      expect(refused.failure.message).toContain("1 node agents are already live")
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


test("node wake picks are off by default, independent, durable and clear the live inbox", async () => {
  const { run, fork } = logging()
  const local = ephemeralLocalState()
  const scoping = await run(scopesIn(local))
  const nodes: ReadonlyArray<NodeAgent> = [
    { id: "one", file: "Work.olai", title: "one", engine: "alpha", session: "one-session", memory: 2 },
    { id: "two", file: "Work.olai", title: "two", engine: "beta", session: "two-session", memory: 3 },
  ]
  const one = { agent: "alpha", session: "one-session" }
  const two = { agent: "beta", session: "two-session" }
  const chat = await run(make({
    fork, scoping, cwd,
    roster: () => [installed("alpha"), installed("beta")],
    engines: () => ["alpha", "beta"],
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
    expect(chat.doorFor("agenda").scopes().map((scope) => scope.under)).toEqual(["one", "two"])
    await run(chat.scope(one, "kolu", "Other.olai"))
    await run(chat.scope(one, "odu", "Work.olai"))
    expect(chat.live().size).toBe(0)
    expect(chat.doorFor("kolu").ringing("Other.olai", "outside-one").map(({ current: _current, ...row }) => row)).toEqual([
      { ...one, file: "Other.olai" },
    ])
    await run(chat.loadSession(one.agent, one.session))
    expect(chat.state().wake.map(({ name, file }) => ({ name, file }))).toEqual([
      { name: "kolu", file: "Other.olai" }, { name: "odu", file: "Work.olai" },
    ])
    await run(chat.scope(one, "kolu", "Work.olai"))
    expect(chat.state().wake.find((row) => row.name === "kolu")?.file).toBe("Work.olai")
    await run(chat.loadSession(two.agent, two.session))
    expect(chat.state().wake).toEqual([])
    // A delayed choice for the other conversation cannot change this one's strip.
    await run(chat.scope(one, "kolu", "Other.olai"))
    expect(chat.state().wake).toEqual([])
    await run(chat.loadSession(one.agent, one.session))
    expect(chat.state().wake.find((row) => row.name === "kolu")?.file).toBe("Other.olai")
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
    // Fault and healing updates reach the node panel, not just the root panel.
    await run(chat.faults(() => "gone", () => true))
    expect(chat.state().wake[0]?.fault).toBe("gone")
    expect(chat.doorFor("odu").scopes()).toEqual([])
    await run(chat.faults(() => null, () => true))
    expect(chat.state().wake[0]?.fault).toBeNull()
    await run(chat.scope(one, "odu", null))
    expect((await run(scopesIn(local))).rows()).toEqual([])
    expect(chat.doorFor("odu").scopes()).toEqual([])
  } finally {
    await run(chat.stop)
  }
}, 25_000)
