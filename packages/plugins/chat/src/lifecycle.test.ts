import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { Clock, Effect, References } from "effect"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { collector, findSaid, type Logged } from "@olai/log/testlib"

import { type Agent, type AgentEvent, make } from "@kolu/acp-client"
import type { Leg } from "@kolu/acp/engine"
import { QUEUES } from "@kolu/acp-client/testlib"
import type { Installed } from "./agents/roster.ts"
import { seated } from "./agents/roster.testlib.ts"
import { makePanel as makeChat } from "./chat.ts"
import { volatile } from "./memory.ts"
import type { Memory } from "@kolu/acp-client"

const FIXTURE = join(import.meta.dirname, "fixtures", "lifecycle-agent.ts")

const REMEMBERS_NOTHING: Memory = {
  recall: Effect.succeed(null),
  remember: () => Effect.void,
}

let cwd = ""
const wasState = process.env["XDG_STATE_HOME"]

beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), "olai-lifecycle-"))
  process.env["XDG_STATE_HOME"] = cwd
})

afterEach(() => {
  if (wasState === undefined) delete process.env["XDG_STATE_HOME"]
  else process.env["XDG_STATE_HOME"] = wasState
  rmSync(cwd, { recursive: true, force: true })
})

type Run = <A, E>(effect: Effect.Effect<A, E>) => Promise<A>

const words = (text: string) => [{ type: "text" as const, text }]
const options = () => ({
  id: "opencode" as const,
  leg: QUEUES,
  command: process.execPath,
  args: [FIXTURE],
  cwd,
  tools: () => [],
  memory: REMEMBERS_NOTHING,
  onEvent: () => {},
})

const withAgent = async (
  minimum: "Debug" | "Info",
  body: (
    agent: Agent,
    run: Run,
    said: ReadonlyArray<Logged>,
  ) => Promise<void>,
): Promise<ReadonlyArray<Logged>> => {
  const { layer, said } = collector()
  const run: Run = (effect) =>
    Effect.runPromise(
      effect.pipe(
        Effect.provideService(References.MinimumLogLevel, minimum),
        Effect.provide(layer),
      ),
    )
  const agent = await run(make(options()))
  try {
    await body(agent, run, said)
  } finally {
    await run(agent.stop)
    const deadline = Date.now() + 2_000
    while (Date.now() < deadline && findSaid(said, "chat agent exited") === undefined) {
      await Effect.runPromise(Effect.sleep("20 millis"))
    }
  }
  return said
}

describe("chat lifecycle lines", () => {
  test("a successful turn logs spawn, opened, prompt sent, turn ended, exit — never the text", async () => {
    const secret = "do not put this in the journal"
    const said = await withAgent("Info", async (agent, run) => {
      await run(agent.boot)
      await run(agent.prompt(words(secret)))
    })

    const spawned = findSaid(said, "chat agent ready")
    expect(spawned?.level).toBe("Info")
    expect(spawned?.annotations.agent).toBe("opencode")
    expect(spawned?.annotations.command).toBeUndefined()
    expect(spawned?.annotations.args).toBeUndefined()

    const opened = findSaid(said, "conversation opened")
    expect(opened?.level).toBe("Info")
    expect(opened?.annotations.agent).toBe("opencode")
    expect(opened?.annotations.session).toBe("sess-1")
    expect(opened?.annotations.how).toBe("new")

    const sent = findSaid(said, "prompt sent")
    expect(sent?.level).toBe("Info")
    expect(sent?.annotations.agent).toBe("opencode")
    expect(sent?.annotations.session).toBe("sess-1")
    expect(sent?.annotations.bytes).toBe(secret.length)
    expect(sent?.message).not.toContain(secret)
    expect(JSON.stringify(sent?.annotations)).not.toContain(secret)

    const ended = findSaid(said, "turn ended")
    expect(ended?.level).toBe("Info")
    expect(ended?.annotations.stopReason).toBe("end_turn")
    expect(String(ended?.annotations.duration)).toMatch(/^\d+ms$/)
    expect(ended?.annotations.session).toBe("sess-1")

    const exited = findSaid(said, "chat agent exited")
    expect(exited?.level).toBe("Info")
    expect(exited?.annotations.agent).toBe("opencode")
    expect(exited?.annotations.pid).toBeNumber()

    expect(exited?.annotations.reason).toBe("stopped by app")
    expect(exited?.annotations.expected).toBe(true)
    expect(exited?.annotations.session).toBe("sess-1")
    expect(exited?.annotations.pid).toBe(spawned?.annotations.pid)
    expect(findSaid(said, "lifecycle-agent: started")).toBeUndefined()
  }, 15_000)

  test("log-level: debug (the collector's Debug) shows the agent's stderr", async () => {
    const said = await withAgent("Debug", async (agent, run) => {
      await run(agent.boot)
      await Effect.runPromise(Effect.sleep("40 millis"))
    })

    const stderr = findSaid(said, "lifecycle-agent: started")
    const command = findSaid(said, "chat agent command")
    expect(command?.annotations.command).toBe(process.execPath)
    expect(String(command?.annotations.args)).toContain("lifecycle-agent.ts")
    expect(stderr?.level).toBe("Debug")
    expect(stderr?.annotations.agent).toBe("opencode")
  }, 15_000)

  test("a failed turn is WARN with the error verbatim, and the agent's stderr with it", async () => {
    const said = await withAgent("Info", async (agent, run) => {
      await run(agent.boot)
      const outcome = await run(Effect.result(agent.prompt(words("fail"))))
      expect(outcome._tag).toBe("Failure")
      await Effect.runPromise(Effect.sleep("40 millis"))
    })

    const failed = findSaid(said, "turn failed")
    expect(failed?.level).toBe("Warn")
    expect(failed?.annotations.agent).toBe("opencode")
    expect(failed?.annotations.session).toBe("sess-1")
    expect(String(failed?.annotations.error)).toContain("the model said no")
    expect(JSON.stringify(failed?.annotations)).not.toContain(`"fail"`)

    const stderr = findSaid(said, "lifecycle-agent: json-rpc boom")
    expect(stderr?.level).toBe("Warn")
    expect(stderr?.annotations.agent).toBe("opencode")
    expect(stderr?.annotations.session).toBe("sess-1")
    expect(findSaid(said, "lifecycle-agent: started")).toBeUndefined()
  }, 15_000)

  test("bytes is UTF-8, not UTF-16 code units", async () => {
    const text = "café"
    expect(text.length).toBe(4)
    expect(Buffer.byteLength(text)).toBe(5)
    const said = await withAgent("Info", async (agent, run) => {
      await run(agent.boot)
      await run(agent.prompt(words(text)))
    })
    expect(findSaid(said, "prompt sent")?.annotations.bytes).toBe(5)
    expect(JSON.stringify(findSaid(said, "prompt sent")?.annotations)).not.toContain("café")
  }, 15_000)

  test("a failed turn still dumps stderr after the 32KB cap has bitten", async () => {
    const said = await withAgent("Info", async (agent, run) => {
      await run(agent.boot)
      await run(agent.prompt(words("pad")))
      const outcome = await run(Effect.result(agent.prompt(words("fail"))))
      expect(outcome._tag).toBe("Failure")
      await Effect.runPromise(Effect.sleep("40 millis"))
    })
    const stderr = findSaid(said, "lifecycle-agent: json-rpc boom")
    expect(stderr?.level).toBe("Warn")
    expect(stderr?.annotations.session).toBe("sess-1")
  }, 15_000)

  test("a crash while a session is open logs the exit code", async () => {
    const said = await withAgent("Info", async (agent, run, lines) => {
      await run(agent.boot)
      await run(Effect.result(agent.prompt(words("crash"))))
      const deadline = Date.now() + 2_000
      while (Date.now() < deadline && findSaid(lines, "chat agent exited") === undefined) {
        await Effect.runPromise(Effect.sleep("20 millis"))
      }
    })
    const exited = findSaid(said, "chat agent exited")
    expect(exited?.level).toBe("Info")
    expect(exited?.annotations.code).toBe(7)
    expect(exited?.annotations.expected).toBe(false)
    expect(exited?.annotations.reason).toBe("process exited")
    expect(exited?.annotations.session).toBe("sess-1")
    expect(exited?.annotations.agent).toBe("opencode")
  }, 15_000)
})

describe("a message that queues behind a running turn", () => {
  test("marks the row the agent has not started on", async () => {
    const { layer, said } = collector()
    const run = <A, E>(effect: Effect.Effect<A, E>): Promise<A> =>
      Effect.runPromise(
        effect.pipe(
          Effect.provideService(References.MinimumLogLevel, "Info"),
          Effect.provide(layer),
        ),
      )

    const row: Installed = {
      id: "opencode",
      name: "opencode",
      adapter: { command: process.execPath, args: [FIXTURE] },
      leg: QUEUES,
      prompt: { kind: "first-turn" },
    }
    const chat = await run(
      makeChat({
        roster: () => [seated(row)],
        cwd,
        tools: () => null,
        memory: volatile(),
        onState: () => {},
        onTranscript: () => {},
      }),
    )
    let queued: ReadonlyArray<string> = []
    let behind = false
    try {
      await run(chat.start)
      const deadline = Date.now() + 8_000
      while (Date.now() < deadline && chat.state().session === null) {
        await Effect.runPromise(Effect.sleep("20 millis"))
      }
      expect(chat.state().session?.id).toBe("sess-1")

      await run(chat.send("queue-wait", [], []))
      await run(chat.send("queue-wait", [], []))
      await Effect.runPromise(Effect.sleep("100 millis"))
      const mine = [...chat.entries().values()].filter((entry) => entry.kind === "user")
      behind = mine.length === 2 && mine[1]?.queued === true
      queued = mine
        .filter((entry) => entry.queued === true)
        .map((entry) => entry.text)
    } finally {
      await run(chat.stop)
      await Effect.runPromise(Effect.sleep("40 millis"))
    }

    expect(queued).toEqual(["queue-wait"])
    expect(behind).toBe(true)
  }, 15_000)

  test("... and the interruption goes with it, which is what a doorbell must not do", async () => {
    const leg: Leg = {
      ...QUEUES,
      steering: {
        method: "_session/steering",
        meta: undefined,
        timeout: "30 seconds",
        taken: () => true,
        advertised: () => true,
      },
    }
    const row: Installed = {
      id: "opencode",
      name: "opencode",
      adapter: { command: process.execPath, args: [FIXTURE] },
      leg,
      prompt: { kind: "first-turn" },
    }
    const chat = await Effect.runPromise(makeChat({
      roster: () => [seated(row)],
      cwd,
      tools: () => null,
      memory: volatile(),
      onState: () => {},
      onTranscript: () => {},
    }))
    const talking = () => {
      const who = chat.state().talking
      return who !== null && who.kind === "agent" ? who : null
    }
    try {
      await Effect.runPromise(chat.start)
      const deadline = Date.now() + 8_000
      while (Date.now() < deadline && talking()?.steers !== true) {
        await Effect.runPromise(Effect.sleep("20 millis"))
      }
      expect(talking()?.steers).toBe(true)

      await Effect.runPromise(chat.send("queue-wait", [], []))
      await Effect.runPromise(chat.send("hi", [], []))
      expect(talking()?.steers).toBe(false)
    } finally {
      await Effect.runPromise(chat.stop)
      await Effect.runPromise(Effect.sleep("40 millis"))
    }
  }, 15_000)
})

test("startup durations measure separate operations and include tool probes in opening", async () => {
  let now = 1_000_000_000n
  const advance = (ms: number) => { now += BigInt(ms) * 1_000_000n }
  const native = Effect.runSync(Effect.service(Clock.Clock))
  const clock: Clock.Clock = {
    currentTimeMillisUnsafe: () => native.currentTimeMillisUnsafe(),
    currentTimeMillis: native.currentTimeMillis,
    currentTimeNanosUnsafe: () => native.currentTimeNanosUnsafe(),
    currentTimeNanos: native.currentTimeNanos,
    sleep: duration => native.sleep(duration),
    monotonicTimeNanosUnsafe: () => now,
    monotonicTimeNanos: Effect.sync(() => now),
  }
  const { layer, said } = collector()
  const run: Run = (effect) => Effect.runPromise(effect.pipe(
    Effect.provideService(Clock.Clock, clock),
    Effect.provideService(References.MinimumLogLevel, "Debug"),
    Effect.provide(layer),
  ))
  const agent = await run(make({
    ...options(),
    probes: () => Effect.succeed([{
      name: "slow-tool",
      ask: Effect.sync(() => {
        advance(50)
        return { server: null, missing: null }
      }),
    }]),
    onEvent: event => {
      if (event._tag === "advertised") advance(30)
      if (event._tag === "opening") advance(40)
    },
  }))
  try {
    await run(agent.boot)
    advance(10_000)
    await run(agent.loadSession("stored-session"))
    const ready = said.filter(line => line.message.includes("chat agent ready"))
    expect(ready).toHaveLength(1)
    expect(ready[0]?.annotations.duration).toBe("30ms")
    const opened = said.filter(line => line.message.includes("conversation opened"))
    expect(opened.map(line => [line.annotations.how, line.annotations.duration]))
      .toEqual([["new", "90ms"], ["loaded", "90ms"]])
    const probes = said.filter(line => line.message.includes("slow-tool is not running"))
    expect(probes.map(line => [line.level, line.annotations.duration]))
      .toEqual([["Debug", "50ms"], ["Debug", "50ms"]])
  } finally {
    await run(agent.stop)
  }
}, 15_000)

test("actual MCP reports update the roster and warn once, fenced to this session", async () => {
  const { layer, said } = collector()
  const run: Run = (effect) => Effect.runPromise(effect.pipe(Effect.provide(layer)))
  const rosters: unknown[] = []
  let reportsRead = 0
  const agent = await run(make({
    ...options(),
    leg: { ...QUEUES, serversInUpdate: (update) => {
      if ((update as { toolCallId?: string }).toolCallId !== "mcp_startup.optional") return null
      reportsRead++
      return [{ name: "optional", attached: false, said: "connection refused" },
        { name: "agent-owned", attached: false, said: "must not create a row" }]
    } },
    probes: () => Effect.succeed([{ name: "optional", ask: Effect.succeed({
      server: { name: "optional", command: "/optional", args: [], env: {} }, missing: null,
    }) }]),
    onEvent: (event) => { if (event._tag === "servers") rosters.push(event.servers) },
  }))
  try {
    await run(agent.boot)
    await run(agent.prompt(words("mcp-report")))
    const deadline = Date.now() + 2000
    while (!findSaid(said, "MCP server connection problem") && Date.now() < deadline) {
      await run(Effect.sleep("10 millis"))
    }
    expect(reportsRead).toBe(2)
    expect(rosters).toHaveLength(2)
    expect(rosters[1]).toEqual([{ name: "optional", where: "/optional",
      standing: "unattached", said: "connection refused" }])
    const warnings = said.filter((line) => line.message.includes("MCP server connection problem"))
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toMatchObject({ level: "Warn", annotations: {
      agent: "opencode", session: "sess-1", server: "optional",
      reason: "connection refused",
    } })
  } finally { await run(agent.stop) }
})

test("an absent catalogue leaves raw titles and files no reply on the row", async () => {
  const events: AgentEvent[] = []
  const agent = await Effect.runPromise(make({ ...options(),
    leg: { ...QUEUES, mcpCall: () => [{ server: "ours", tool: "read" }],
      replyIn: () => ({ answered: "and filed nowhere" }) },
    onEvent: event => events.push(event),
  }))
  try {
    await Effect.runPromise(agent.boot)
    await Effect.runPromise(agent.prompt(words("display-tool")))
    const frames = events.filter(event => event._tag === "tool")
    expect(frames.length).toBe(2)
    expect(frames[0]?.title).toBe("engine_tool")
    expect(frames.every(frame => frame.row === undefined && frame.reply === undefined)).toBe(true)
    expect(frames.at(-1)?.answer).toEqual({ answered: "and filed nowhere" })
  } finally { await Effect.runPromise(agent.stop) }
})

test.each([false, true])("completion uses remembered identity with late catalogue=%s", async (late) => {
  const events: AgentEvent[] = []
  let lookups = 0
  const agent = await Effect.runPromise(make({ ...options(),
    leg: { ...QUEUES, mcpCall: frame => frame.title === "engine_tool" && frame.rawInput !== undefined ? [{ server: "ours", tool: "read" }] : [],
      replyIn: raw => raw as Record<string, unknown> },
    advertised: () => { lookups++; return late && lookups === 1 ? null : { title: "Read a node", owner: "notes" } },
    onEvent: event => events.push(event),
  }))
  try {
    await Effect.runPromise(agent.boot)
    await Effect.runPromise(agent.prompt(words("display-tool")))
    const frames = events.filter(event => event._tag === "tool")
    expect(lookups).toBe(2)
    expect(frames[0]?.title).toBe(late ? "engine_tool" : "Read a node")
    expect(frames[1]?.title).toBe("Read a node")
    expect(frames[0]?.called).toBe("engine_tool")
    expect(frames[1]?.reply).toEqual({ file: "one.olai", title: "one" })
    expect(frames[1]?.detail).toBeUndefined()
  } finally { await Effect.runPromise(agent.stop) }
})

test.each([true, false])("a call that asks through a form says so on the row, asking=%s", async (asks) => {
  const row: Installed = {
    id: "opencode",
    name: "opencode",
    adapter: { command: process.execPath, args: [FIXTURE] },
    leg: {
      ...QUEUES,
      toolNameOf: (id: string) => id,
      ...(asks ? { asksThroughForm: (name: string) => name === "display-1" } : {}),
    },
    prompt: { kind: "first-turn" },
  }
  const chat = await Effect.runPromise(makeChat({
    roster: () => [seated(row)],
    cwd,
    tools: () => null,
    memory: volatile(),
    onState: () => {},
    onTranscript: () => {},
  }))
  const calls = () =>
    [...chat.entries().values()].filter((entry) => entry.kind === "tool")
  try {
    await Effect.runPromise(chat.start)
    await Effect.runPromise(chat.send("display-tool", [], []))
    const deadline = Date.now() + 8_000
    while (Date.now() < deadline && calls().length === 0) {
      await Effect.runPromise(Effect.sleep("20 millis"))
    }
    expect(calls()).toHaveLength(1)
    expect(calls()[0]?.asksThroughForm).toBe(asks ? true : undefined)
  } finally {
    await Effect.runPromise(chat.stop)
  }
}, 15_000)
