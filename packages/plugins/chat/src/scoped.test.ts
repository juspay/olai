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
  let nodes: ReadonlyArray<NodeAgent> = [
    { id: "one", file: "Work.olai", title: "one", engine: "alpha", session: null, memory: 2 },
    { id: "two", file: "Work.olai", title: "two", engine: "beta", session: null, memory: 3 },
  ]
  const released: Array<string> = []
  const chat = await run(make({
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
})

test("boot routes a remembered node session before spawning any panel", async () => {
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
  const logged = <A, E>(effect: Effect.Effect<A, E>): Promise<A> => Effect.runPromise(
    effect.pipe(
      Effect.provideService(References.MinimumLogLevel, "Info"),
      Effect.provide(layer),
    ),
  )
  const chat = await logged(make({
    roster: () => [installed("alpha")],
    engines: () => ["alpha"],
    cwd,
    memory,
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
    expect(said.filter((line) => line.message.includes("chat agent spawned"))).toHaveLength(1)
    expect(said.filter((line) => line.message.includes("conversation opened"))).toHaveLength(1)
  } finally {
    await logged(chat.stop)
  }
})

test("boot moves a newly identified node session into its scope", async () => {
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
})

test("the cap reaps an idle scope, refuses a busy one, and holds its one-shot wake", async () => {
  let nodes: ReadonlyArray<NodeAgent> = [
    { id: "one", file: "Work.olai", title: "one", engine: "alpha", session: null, memory: 2 },
    { id: "two", file: "Work.olai", title: "two", engine: "beta", session: null, memory: 3 },
  ]
  const released: Array<string> = []
  const chat = await run(make({
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
    await run(chat.startAgentSession("not-a-node", "beta"))
    await run(chat.startAgentSession("two", "beta"))
    const twoSession = chat.state().session?.id ?? ""
    nodes = nodes.map((node) => node.id === "two" ? { ...node, session: twoSession } : node)
    chat.reread()
    expect(released).toEqual(["one"])

    await run(chat.send("wait:2000", [], []))
    await until("the only slot to be busy", () => chat.live().get("two")?.status === "thinking")
    await run(chat.startAgentSession("not-a-node", "alpha"))

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
})
