import { expect, test } from "bun:test"
import { Effect } from "effect"
import { forLocalState } from "./models.ts"
import { localHarness } from "./local.testlib.ts"
import { MemoryFailure, type ChatLocalState } from "./local.ts"

const run = <A, E>(work: Effect.Effect<A, E>) => Effect.runPromise(work)
const to = (session: string, agent = "alpha") => ({ agent, session })

test("model choices are keyed by both engine and session, survive rebuilds, and carry neighbouring state", async () => {
  const local = localHarness()
  local.write("/vault", "heard", { heard: [{ session: "one" }] })
  const models = forLocalState(local.forDirectory("/vault"))
  await run(models.write(to("one"), "fast"))
  await run(models.write(to("one", "beta"), "careful"))
  await run(models.write(to("two"), "small"))
  const again = forLocalState(local.forDirectory("/vault"))
  expect(await run(again.read(to("one")))).toBe("fast")
  expect(await run(again.read(to("one", "beta")))).toBe("careful")
  expect(await run(again.read(to("two")))).toBe("small")
  expect(await run(again.read(to("unknown")))).toBeNull()
  expect(local.read("/vault", "heard")).toEqual({ heard: [{ session: "one" }] })
  expect(local.read("/vault", "memory")).toBeNull()
})

test("the thirty-two-choice cap evicts the least recently touched, including touches on open", async () => {
  const local = localHarness()
  const models = forLocalState(local.forDirectory("/vault"))
  for (let i = 0; i < 32; i++) await run(models.write(to(String(i)), `model-${i}`))
  expect(await run(models.read(to("0")))).toBe("model-0")
  await run(models.write(to("32"), "last"))
  expect(await run(models.read(to("1")))).toBeNull()
  expect(await run(models.read(to("0")))).toBe("model-0")
  expect((local.read("/vault", "models")!.rows as unknown[])).toHaveLength(32)
})

test("an old note is neither read nor removed, including after a model switch", async () => {
  const local = localHarness()
  const note = { session: "old", model: "chosen" }
  local.write("/vault", "memory", note)
  const reads: string[] = []
  const door = local.forDirectory("/vault")
  const watched: ChatLocalState = { ...door, load: section => {
    reads.push(section)
    return door.load(section)
  } }
  const models = forLocalState(watched)
  expect(reads).toEqual([])
  expect(await run(models.read(to("old")))).toBeNull()
  expect(reads).toEqual(["models"])
  expect(local.writes("/vault")).toBe(0)
  await run(models.write(to("old"), "switched"))
  expect(local.read("/vault", "memory")).toEqual(note)
  expect(await run(forLocalState(watched).read(to("old")))).toBe("switched")
  expect(reads).toEqual(["models", "models"])
})

test("a refused write preserves the durable choice and the in-memory answer", async () => {
  const local = localHarness()
  const door = local.forDirectory("/vault")
  let refuse = false
  const models = forLocalState({ ...door, save: (section, value) => refuse
    ? Effect.fail(new MemoryFailure({ why: "read-only" })) : door.save(section, value) })
  await run(models.write(to("one"), "first"))
  refuse = true
  const outcome = await run(Effect.result(models.write(to("one"), "second")))
  expect(outcome._tag).toBe("Failure")
  refuse = false
  expect(await run(models.read(to("one")))).toBe("first")
})
