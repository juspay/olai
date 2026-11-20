import { expect, test } from "bun:test"
import { Effect, References } from "effect"

import { collector, type Logged } from "./lines.testlib.ts"
import { type Emit, emitter } from "./emit.ts"

const collected = (
  options: {
    readonly body: (say: Emit) => void
    readonly annotate?: Record<string, unknown>
    readonly minimum?: "Debug"
  },
): Promise<ReadonlyArray<Logged>> => {
  const { layer, said } = collector()
  const taken = options.annotate === undefined
    ? emitter
    : Effect.annotateLogs(emitter, options.annotate)

  return Effect.gen(function*() {
    const say = yield* taken
    options.body(say)
    yield* Effect.sleep("10 millis")
    return said
  }).pipe(
    Effect.provideService(References.MinimumLogLevel, options.minimum ?? "Info"),
    Effect.provide(layer),
    Effect.runPromise,
  )
}

test("a callback's line carries the annotations in force where the emitter was taken", async () => {
  const said = await collected({
    annotate: { agent: "claude-code-acp" },
    body: (say) => say(Effect.logWarning("the agent could not open a session")),
  })

  expect(said).toHaveLength(1)
  expect(said[0]?.level).toBe("Warn")
  expect(said[0]?.message).toBe("the agent could not open a session")
  expect(said[0]?.annotations).toEqual({ agent: "claude-code-acp" })
})

test("a callback's line is filtered by the minimum level, like every other line", async () => {
  const quiet = await collected({
    body: (say) => say(Effect.logDebug("a whole screen of agent stderr")),
  })
  expect(quiet).toEqual([])

  const verbose = await collected({
    minimum: "Debug",
    body: (say) => say(Effect.logDebug("a whole screen of agent stderr")),
  })
  expect(verbose).toHaveLength(1)
  expect(verbose[0]?.level).toBe("Debug")
})
