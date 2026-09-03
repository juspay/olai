/**
 * The chat's lifecycle lines: spawn, open, prompt, turn end/fail, exit — at
 * the right level, with agent + session, never the prompt's text. The agent's
 * stderr is DEBUG until a turn fails, when the same lines land at WARN.
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { Effect, References } from "effect"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { collector, findSaid, type Logged } from "@olai/log/testlib"

import { type Agent, make } from "./agent.ts"
import type { Leg } from "@olai/acp/engine"
import { QUEUES } from "./agents/legs.testlib.ts"
import type { Installed } from "./agents/roster.ts"
import { make as makeChat } from "./chat.ts"
import type { Memory } from "./memory.ts"

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

/** NO PROBES, said by omitting them ({@link ./agent.ts}'s `Options.probes`).
 *  These tests are about the journal, and an agent with an empty list asks this
 *  machine nothing on the way into a session. It used to be said by emptying
 *  `PATH` and unsetting a daemon's socket variable in a `beforeEach` — a test
 *  reaching into the process to silence a dependency it could not name. */
const options = () => ({
  id: "opencode" as const,
  leg: QUEUES,
  command: process.execPath,
  args: [FIXTURE],
  cwd,
  tools: () => null,
  memory: REMEMBERS_NOTHING,
  onEvent: () => {},
})

/** Run `body` against one agent, with a collecting logger at `minimum`. */
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
    // The emitter forks; exit lands on another fiber. Under the full suite
    // a fixed sleep was losing the race, so wait for the line itself.
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
      await run(agent.prompt(secret))
    })

    const spawned = findSaid(said, "chat agent spawned")
    expect(spawned?.level).toBe("Info")
    expect(spawned?.annotations.agent).toBe("opencode")
    expect(spawned?.annotations.command).toBe(process.execPath)
    expect(String(spawned?.annotations.args)).toContain("lifecycle-agent.ts")

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

    expect(findSaid(said, "lifecycle-agent: started")).toBeUndefined()
  }, 15_000)

  test("OLAI_LOG_LEVEL=debug (the collector's Debug) shows the agent's stderr", async () => {
    const said = await withAgent("Debug", async (agent, run) => {
      await run(agent.boot)
      await Effect.runPromise(Effect.sleep("40 millis"))
    })

    const stderr = findSaid(said, "lifecycle-agent: started")
    expect(stderr?.level).toBe("Debug")
    expect(stderr?.annotations.agent).toBe("opencode")
  }, 15_000)

  test("a failed turn is WARN with the error verbatim, and the agent's stderr with it", async () => {
    const said = await withAgent("Info", async (agent, run) => {
      await run(agent.boot)
      const outcome = await run(Effect.result(agent.prompt("fail")))
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
    // Spawn-time stderr stays DEBUG, so it is off at info.
    expect(findSaid(said, "lifecycle-agent: started")).toBeUndefined()
  }, 15_000)

  test("bytes is UTF-8, not UTF-16 code units", async () => {
    const text = "café"
    expect(text.length).toBe(4)
    expect(Buffer.byteLength(text)).toBe(5)
    const said = await withAgent("Info", async (agent, run) => {
      await run(agent.boot)
      await run(agent.prompt(text))
    })
    expect(findSaid(said, "prompt sent")?.annotations.bytes).toBe(5)
    expect(JSON.stringify(findSaid(said, "prompt sent")?.annotations)).not.toContain("café")
  }, 15_000)

  test("a failed turn still dumps stderr after the 32KB cap has bitten", async () => {
    const said = await withAgent("Info", async (agent, run) => {
      await run(agent.boot)
      await run(agent.prompt("pad"))
      const outcome = await run(Effect.result(agent.prompt("fail")))
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
      await run(Effect.result(agent.prompt("crash")))
      // Wait HERE, before stop() nulls the session the exit handler reads.
      const deadline = Date.now() + 2_000
      while (Date.now() < deadline && findSaid(lines, "chat agent exited") === undefined) {
        await Effect.runPromise(Effect.sleep("20 millis"))
      }
    })
    const exited = findSaid(said, "chat agent exited")
    expect(exited?.level).toBe("Info")
    expect(exited?.annotations.code).toBe(7)
    expect(exited?.annotations.session).toBe("sess-1")
    expect(exited?.annotations.agent).toBe("opencode")
  }, 15_000)
})

describe("a message that queues behind a running turn", () => {
  test("logs that it queued, with agent and session", async () => {
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
        roster: [row],
        engines: [],
        cwd,
        tools: () => null,
        onState: () => {},
        onTranscript: () => {},
      }),
    )
    try {
      await run(chat.start)
      const deadline = Date.now() + 8_000
      while (Date.now() < deadline && chat.state().session === null) {
        await Effect.runPromise(Effect.sleep("20 millis"))
      }
      expect(chat.state().session?.id).toBe("sess-1")

      await run(chat.send("queue-wait", [], []))
      await run(chat.send("hi", [], []))
      await Effect.runPromise(Effect.sleep("400 millis"))
    } finally {
      await run(chat.stop)
      await Effect.runPromise(Effect.sleep("40 millis"))
    }

    const queued = findSaid(said, "message queued behind a running turn")
    expect(queued?.level).toBe("Info")
    expect(queued?.annotations.agent).toBe("opencode")
    expect(queued?.annotations.session).toBe("sess-1")
  }, 15_000)

  /**
   * ... AND IT TAKES THE INTERRUPTION WITH IT, for the rest of this
   * conversation's life.
   *
   * The pinned adapter leaves a steered turn unanswered forever in any session
   * that has once held a queued prompt, so `chat.ts` withdraws the gesture the
   * first time a message goes out alongside a running turn — and says out loud
   * that the cost is not small.
   *
   * This is the TWIN of `deliveries.test.ts`'s "a doorbell does not spend the
   * interruption a person has not spent", and it is here so that the assertion
   * over there means something: a bit that stayed `true` is worth exactly as
   * much as the proof that something can turn it `false`. A PERSON's mid-turn
   * message can. A machine's must not.
   */
  test("... and the interruption goes with it, which is what a doorbell must not do", async () => {
    // The leg matters and nothing else about it does: `Talking.steers` is
    // `advertises.steers && !queuedHere`, so an agent that offers no
    // interruption cannot show one being withdrawn. Nothing here ever steers.
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
      roster: [row],
      engines: [],
      cwd,
      tools: () => null,
      onState: () => {},
      onTranscript: () => {},
    }))
    /** The agent's own row on the cell, or `null` while the panel is asking. */
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
      // Gone, and gone for good: `queuedHere` is cleared only by the session
      // ending, because it is the SESSION the adapter poisons.
      expect(talking()?.steers).toBe(false)
    } finally {
      await Effect.runPromise(chat.stop)
      await Effect.runPromise(Effect.sleep("40 millis"))
    }
  }, 15_000)
})
