import { PlatformFailure } from "@olai/store"
import { expect, test } from "bun:test"
import { Effect, Exit, Queue, Scope } from "effect"

import * as Bodies from "./bodies.ts"

interface Fixture {
  readonly bodies: Bodies.Bodies
  readonly reads: ReadonlyArray<string>
  readonly published: ReadonlyArray<
    readonly [string, { readonly text: string } | { readonly refused: true }]
  >
  readonly took: (count: number) => Effect.Effect<void>
  readonly opens: (path: string) => Effect.Effect<Effect.Effect<void>>
}

const NEVER_CAME = "5 seconds"

const withBodies = <A>(
  disk: Readonly<Record<string, string | "unreadable">>,
  use: (fixture: Fixture) => Effect.Effect<A, unknown>,
): Promise<A> => {
  const reads: Array<string> = []
  const published: Array<
    readonly [string, { readonly text: string } | { readonly refused: true }]
  > = []

  return Effect.gen(function*() {
    const arrivals = yield* Queue.unbounded<
      readonly [string, { readonly text: string } | { readonly refused: true }]
    >()
    const bodies = yield* Bodies.make({
      read: (path) => {
        reads.push(path)
        const said = disk[path]
        if (said === "unreadable") {
          return Effect.fail(new PlatformFailure({ path, cause: new Error("EACCES") }))
        }
        return Effect.succeed(said ?? null)
      },
      publish: (path, text) => {
        Queue.offerUnsafe(arrivals, [path, text])
      },
    })

    const took = (count: number): Effect.Effect<void> =>
      Effect.gen(function*() {
        while (published.length < count) {
          const one = yield* Effect.timeoutOption(Queue.take(arrivals), NEVER_CAME)
          if (one._tag === "None") {
            return yield* Effect.die(
              new Error(
                `waited for ${count} bodies; only ${JSON.stringify(published)} arrived`,
              ),
            )
          }
          published.push(one.value)
        }
      })

    const opens = (path: string): Effect.Effect<Effect.Effect<void>> =>
      Effect.gen(function*() {
        const reader = yield* Scope.make()
        yield* Scope.provide(bodies.held(path), reader)
        bodies.unread([path])
        return Scope.close(reader, Exit.void)
      })

    return yield* use({ bodies, reads, published, took, opens })
  }).pipe(Effect.scoped, Effect.runPromise)
}

test("opening a file reads its body once and hands it over", () =>
  withBodies({ "report.html": "<h1>Cabinet quote</h1>" }, (fixture) =>
    Effect.gen(function*() {
      yield* fixture.opens("report.html")
      yield* fixture.took(1)

      expect(fixture.reads).toEqual(["report.html"])
      expect(fixture.published).toEqual([
        ["report.html", { text: "<h1>Cabinet quote</h1>" }],
      ])
    })))

test("a file somebody holds is re-read when it moves", () =>
  withBodies({ "report.html": "before" }, (fixture) =>
    Effect.gen(function*() {
      yield* fixture.opens("report.html")
      yield* fixture.took(1)

      fixture.bodies.unread(["report.html"])
      yield* fixture.took(2)
      expect(fixture.reads).toEqual(["report.html", "report.html"])
    })))

test("a file nobody has opened is not read when it moves", () =>
  withBodies({ "report.html": "before", "other.html": "also" }, (fixture) =>
    Effect.gen(function*() {
      yield* fixture.opens("report.html")
      yield* fixture.took(1)

      fixture.bodies.unread(["other.html"])
      fixture.bodies.unread(["report.html"])
      yield* fixture.took(2)
      expect(fixture.reads).toEqual(["report.html", "report.html"])
    })))

test("a file whose last reader has gone is not re-read", () =>
  withBodies({ "report.html": "before", "other.html": "also" }, (fixture) =>
    Effect.gen(function*() {
      const release = yield* fixture.opens("report.html")
      yield* fixture.took(1)

      yield* release
      fixture.bodies.unread(["report.html"])
      yield* fixture.opens("other.html")
      yield* fixture.took(2)
      expect(fixture.reads).toEqual(["report.html", "other.html"])
    })))

test("a second reader keeps the file live, and a doubled release takes nothing extra", () =>
  withBodies({ "report.html": "before", "other.html": "also" }, (fixture) =>
    Effect.gen(function*() {
      const first = yield* fixture.opens("report.html")
      yield* fixture.took(1)
      const second = yield* fixture.opens("report.html")
      yield* fixture.took(2)

      yield* first
      yield* first
      fixture.bodies.unread(["report.html"])
      yield* fixture.took(3)

      yield* second
      fixture.bodies.unread(["report.html"])
      yield* fixture.opens("other.html")
      yield* fixture.took(4)
      expect(fixture.reads).toEqual([
        "report.html",
        "report.html",
        "report.html",
        "other.html",
      ])
    })))

test("a file released before the read is taken is never opened", () =>
  withBodies({ "gone.html": "quickly", "other.html": "also" }, (fixture) =>
    Effect.gen(function*() {
      const release = yield* fixture.opens("gone.html")
      yield* release
      yield* fixture.opens("other.html")
      yield* fixture.took(1)

      expect(fixture.reads).toEqual(["other.html"])
      expect(fixture.published).toEqual([["other.html", { text: "also" }]])
    })))

test("a file that has gone publishes nothing", () =>
  withBodies({ "here.html": "still here" }, (fixture) =>
    Effect.gen(function*() {
      yield* fixture.opens("gone.html")
      yield* fixture.opens("here.html")
      yield* fixture.took(1)

      expect(fixture.reads).toEqual(["gone.html", "here.html"])
      expect(fixture.published).toEqual([["here.html", { text: "still here" }]])
    })))

test("a body that cannot be read publishes a refusal and does not stop the reader", () =>
  withBodies({ "locked.html": "unreadable", "fine.html": "readable" }, (fixture) =>
    Effect.gen(function*() {
      yield* fixture.opens("locked.html")
      yield* fixture.opens("fine.html")
      yield* fixture.took(2)

      expect(fixture.reads).toEqual(["locked.html", "fine.html"])
      expect(fixture.published).toEqual([
        ["locked.html", { refused: true }],
        ["fine.html", { text: "readable" }],
      ])
    })))

test("a body that is the word refused is still a body", () =>
  withBodies({ "said.html": "refused" }, (fixture) =>
    Effect.gen(function*() {
      yield* fixture.opens("said.html")
      yield* fixture.took(1)

      expect(fixture.published).toEqual([["said.html", { text: "refused" }]])
    })))
