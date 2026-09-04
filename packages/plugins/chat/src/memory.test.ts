/** The panel's remembered conversation, read from chat's `memory` section. */

import { beforeEach, describe, expect, test } from "bun:test"
import { Effect, Result } from "effect"

import { localHarness, type LocalHarness } from "./local.testlib.ts"
import { forLocalState, type MemorySnapshot } from "./memory.ts"

const BEFORE = "the-first-engine"
const HERE = "/tmp/olai-somewhere"
const ELSEWHERE = "/tmp/olai-somewhere-else"
const IN = (session: string): MemorySnapshot => ({ agent: "an-agent", session, model: null })

let local: LocalHarness
beforeEach(() => void (local = localHarness()))

const forDirectory = (cwd: string) => forLocalState(local.forDirectory(cwd), BEFORE)
const run = <A, E>(effect: Effect.Effect<A, E>): Promise<A> => Effect.runPromise(effect)

describe("the panel's own conversation, across a restart", () => {
  test("a directory that has never been served remembers nothing", async () => {
    expect(await run(forDirectory(HERE).recall)).toBeNull()
  })

  test("what was entered is what a second reader gets", async () => {
    await run(forDirectory(HERE).remember(IN("session-a")))
    expect(await run(forDirectory(HERE).recall)).toEqual(IN("session-a"))
  })

  test("the last conversation entered is the one remembered", async () => {
    const memory = forDirectory(HERE)
    await run(memory.remember(IN("session-a")))
    await run(memory.remember(IN("session-b")))
    expect(await run(forDirectory(HERE).recall)).toEqual(IN("session-b"))
  })

  test("a trailing slash is the same directory, not a second one", async () => {
    await run(forDirectory(HERE).remember(IN("session-a")))
    expect(await run(forDirectory(`${HERE}/`).recall)).toEqual(IN("session-a"))
  })

  test("another directory's panel is not this one's", async () => {
    await run(forDirectory(HERE).remember(IN("session-a")))
    expect(await run(forDirectory(ELSEWHERE).recall)).toBeNull()
  })
})

describe("the model that conversation was on", () => {
  test("the model comes back with the conversation it was on", async () => {
    const remembered = { agent: "an-agent", session: "session-a", model: "claude-fable-5" }
    await run(forDirectory(HERE).remember(remembered))
    expect(await run(forDirectory(HERE).recall)).toEqual(remembered)
  })

  test("entering another conversation clears the previous model", async () => {
    await run(forDirectory(HERE).remember({
      agent: "an-agent",
      session: "session-a",
      model: "claude-fable-5",
    }))
    await run(forDirectory(HERE).remember(IN("session-b")))
    expect(await run(forDirectory(HERE).recall)).toEqual(IN("session-b"))
  })

  test("an older section without a model or agent still opens", async () => {
    local.write(HERE, "memory", { session: "session-a" })
    expect(await run(forDirectory(HERE).recall)).toEqual({
      agent: BEFORE,
      session: "session-a",
      model: null,
    })
  })

  test("a model that is not a name is nothing said, not a refusal", async () => {
    local.write(HERE, "memory", { session: "session-a", model: 7 })
    expect(await run(forDirectory(HERE).recall)).toEqual({
      agent: BEFORE,
      session: "session-a",
      model: null,
    })
  })
})

describe("a memory section that cannot be trusted", () => {
  test("a section that names no conversation is a reason", async () => {
    local.write(HERE, "memory", { agent: "claude" })
    const answer = await Effect.runPromise(Effect.result(forDirectory(HERE).recall))
    expect(Result.isFailure(answer)).toBe(true)
    if (Result.isFailure(answer)) expect(answer.failure.why).toContain("names no conversation")
  })

  test("an agent that is not a name falls back to the first engine", async () => {
    local.write(HERE, "memory", { agent: 7, session: "session-a" })
    expect((await run(forDirectory(HERE).recall))?.agent).toBe(BEFORE)
  })
})
