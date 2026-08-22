/**
 * `OLAI_LOG_LEVEL` is the instance knob: default quiet, recognised names, one
 * diagnostic for a typo, and the layer actually gates Effect's own verbs.
 */

import { expect, test } from "bun:test"
import { Effect, References } from "effect"

import { collector, findSaid } from "./lines.testlib.ts"
import {
  atLevel,
  levelFor,
  resetInvalidOlaiLogLevelWarning,
} from "./level.ts"

test("unset and empty are no override", () => {
  expect(levelFor(undefined)).toBeNull()
  expect(levelFor("")).toBeNull()
})

test("the four names are case-insensitive", () => {
  expect(levelFor("debug")).toBe("Debug")
  expect(levelFor("DEBUG")).toBe("Debug")
  expect(levelFor("Info")).toBe("Info")
  expect(levelFor("warn")).toBe("Warn")
  expect(levelFor("ERROR")).toBe("Error")
})

test("unrecognised OLAI_LOG_LEVEL is diagnosed once then ignored", () => {
  resetInvalidOlaiLogLevelWarning()
  const errors: Array<string> = []
  const orig = console.error
  console.error = (...args: Array<unknown>) => {
    errors.push(args.map(String).join(" "))
  }
  try {
    expect(levelFor("verbose")).toBe("Info")
    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain("OLAI_LOG_LEVEL")
    expect(errors[0]).toContain("verbose")
    expect(errors[0]).toContain("debug")
    expect(errors[0]).toContain("info")

    errors.length = 0
    expect(levelFor("loud")).toBe("Info")
    expect(errors).toHaveLength(0)
  } finally {
    console.error = orig
    resetInvalidOlaiLogLevelWarning()
  }
})

/** One debug line and one info line through `layer`, as the collector heard them. */
const saidThrough = async (raw: string | undefined) => {
  const { layer, said } = collector()
  await Effect.gen(function*() {
    yield* Effect.logDebug("agent stderr")
    yield* Effect.logInfo("serving")
  }).pipe(
    Effect.provide(layer),
    Effect.provide(atLevel(raw)),
    Effect.runPromise,
  )
  return said
}

test("default (info) emits info and drops debug", async () => {
  const said = await saidThrough(undefined)
  expect(findSaid(said, "serving")?.level).toBe("Info")
  expect(findSaid(said, "agent stderr")).toBeUndefined()
})

test("OLAI_LOG_LEVEL=debug lets the debug line through", async () => {
  const said = await saidThrough("debug")
  expect(findSaid(said, "serving")?.level).toBe("Info")
  expect(findSaid(said, "agent stderr")?.level).toBe("Debug")
})

test("OLAI_LOG_LEVEL=warn drops info as well as debug", async () => {
  const said = await saidThrough("warn")
  expect(said).toEqual([])
})

test("unset does not override an explicit --log-level (Warn still drops Info)", async () => {
  const { layer, said } = collector()
  await Effect.gen(function*() {
    yield* Effect.logInfo("serving")
  }).pipe(
    Effect.provide(layer),
    Effect.provide(atLevel(undefined)),
    Effect.provideService(References.MinimumLogLevel, "Warn"),
    Effect.runPromise,
  )
  expect(said).toEqual([])
})

test("a set OLAI_LOG_LEVEL wins over an outer Warn", async () => {
  const { layer, said } = collector()
  await Effect.gen(function*() {
    yield* Effect.logInfo("serving")
  }).pipe(
    Effect.provide(layer),
    Effect.provide(atLevel("info")),
    Effect.provideService(References.MinimumLogLevel, "Warn"),
    Effect.runPromise,
  )
  expect(findSaid(said, "serving")?.level).toBe("Info")
})
