/**
 * The lifetime, as the only thing this module has to get right.
 *
 * A hold is taken when a subscription STARTS and dropped when it ENDS, and the
 * ways it ends are what these tests are: the stream running out, a reader
 * taking one frame and leaving, and a fiber being interrupted (which is what a
 * dropped socket and a torn-down runtime both arrive as). Nothing here is about
 * bodies — what a hold is worth belongs to whoever asked for one
 * (`@olai/server`'s `bodies.ts`).
 */

import { emptyHandlers, type SurfaceHandler, type SurfaceHandlers } from "@kolu/surface/server"
import { surfaceTag } from "@kolu/surface/define"
import { expect, test } from "bun:test"
import { Effect, Fiber, Queue, Stream } from "effect"

import { holding } from "./holding.ts"
import { surface } from "./index.ts"

const DOCUMENTS = surfaceTag(surface.tagPrefix, "documents", "get")
const HEADS = surfaceTag(surface.tagPrefix, "heads", "get")

/** A handler record with a `documents.get` that answers `frames`, and one
 *  neighbour that must come through untouched. */
const record = (frames: Stream.Stream<number>): SurfaceHandlers => {
  const handlers = emptyHandlers()
  handlers[DOCUMENTS] = (() => frames) as SurfaceHandler
  handlers[HEADS] = (() => Stream.fromArray([1])) as SurfaceHandler
  return handlers
}

interface Watched {
  readonly handlers: SurfaceHandlers
  readonly events: ReadonlyArray<string>
}

/** A hold that says so, and says so again when its scope closes — the whole of
 *  what a consumer of this module has to be given. */
const watching = (frames: Stream.Stream<number>): Watched => {
  const events: Array<string> = []
  const handlers = holding(record(frames), "documents", (key) =>
    Effect.acquireRelease(
      Effect.sync(() => events.push(`hold ${key}`)),
      () => Effect.sync(() => events.push(`release ${key}`)),
    ))
  return { handlers, events }
}

const get = (handlers: SurfaceHandlers, key: string): Stream.Stream<number> => {
  const answer = handlers[DOCUMENTS]
  if (answer === undefined) throw new Error("the wrap dropped the handler")
  return answer({ key }) as Stream.Stream<number>
}

test("a stream that runs out holds the key for exactly as long as it ran", async () => {
  const { handlers, events } = watching(Stream.fromArray([1, 2]))

  // BUILDING the answer holds nothing: the acquire hangs off the stream's own
  // scope, so a subscription nobody runs is a subscription nobody has.
  const frames = get(handlers, "notes/a.md")
  expect(events).toEqual([])

  const collected = await Effect.runPromise(Stream.runCollect(frames))
  expect([...collected]).toEqual([1, 2])
  expect(events).toEqual(["hold notes/a.md", "release notes/a.md"])
})

// The one-shot reader — an agent's `resources/read`, which takes the first
// frame and leaves. The stream itself never ends.
test("a reader that takes one frame and leaves lets the key go", async () => {
  const { handlers, events } = watching(Stream.concat(Stream.fromArray([1]), Stream.never))

  const collected = await Effect.runPromise(
    Stream.runCollect(Stream.take(get(handlers, "report.html"), 1)),
  )
  expect([...collected]).toEqual([1])
  expect(events).toEqual(["hold report.html", "release report.html"])
})

// A dropped socket and a closed runtime both arrive as an interruption of the
// fiber running the handler's stream — "FIBER INTERRUPTION IS THE UNSUBSCRIBE".
test("an interrupted subscription releases the key", async () => {
  const { handlers, events } = watching(Stream.concat(Stream.fromArray([1]), Stream.never))

  await Effect.runPromise(
    Effect.gen(function*() {
      // The frame is the barrier: taking one says the stream is RUNNING (so the
      // hold is taken) and parked on the never-ending tail, which is a reader
      // sitting on an open page.
      const frames = yield* Queue.unbounded<number>()
      const reading = yield* Effect.forkChild(
        Stream.runForEach(get(handlers, "report.html"), (frame) =>
          Queue.offer(frames, frame)),
      )
      yield* Queue.take(frames)
      expect(events).toEqual(["hold report.html"])

      // `Fiber.interrupt` waits for the exit, so the finalizers have run by the
      // time it returns — nothing here is timing.
      yield* Fiber.interrupt(reading)
      expect(events).toEqual(["hold report.html", "release report.html"])
    }).pipe(Effect.scoped),
  )
})

test("two readers of one key are two holds", async () => {
  const { handlers, events } = watching(Stream.fromArray([1]))

  await Effect.runPromise(
    Effect.all(
      [
        Stream.runCollect(get(handlers, "report.html")),
        Stream.runCollect(get(handlers, "report.html")),
      ],
      { concurrency: 2 },
    ),
  )
  expect(events.filter((event) => event === "hold report.html")).toHaveLength(2)
  expect(events.filter((event) => event === "release report.html")).toHaveLength(2)
})

test("every other handler comes through as the value it was", () => {
  const before = record(Stream.fromArray([1]))
  const after = holding(before, "documents", () => Effect.void)

  expect(Object.keys(after).sort()).toEqual(Object.keys(before).sort())
  expect(after[HEADS]).toBe(before[HEADS])
  expect(after[DOCUMENTS]).not.toBe(before[DOCUMENTS])
})

// A member with no per-key `get` is a boot crash: a wrap that instrumented
// nothing would leave a refcount permanently at zero, which reads as "nobody is
// watching anything" at every consumer.
test("a member the record has no `get` for refuses to be wrapped", () => {
  expect(() => holding(emptyHandlers(), "documents", () => Effect.void)).toThrow(
    /no handler at "surface\/documents\/get"/,
  )
})
