/**
 * The bodies nobody keeps, against a disk that answers whatever a test says.
 *
 * The subject is a policy rather than a file system, so the reads are a stub
 * that RECORDS: what these tests are about is which files were opened and which
 * were not, and a real directory would only make that harder to say. The one
 * thing they do wait on is the reading fiber, which is what publishing a body
 * goes through.
 *
 * Every absence below is read the same way, and it is a fact rather than a
 * race: `unread` offers in the order it is given and the reader takes ONE path
 * at a time, so a read that should not have happened would appear in the list
 * BEFORE the later one each test waits for.
 */

import { PlatformFailure } from "@olai/store"
import { expect, test } from "bun:test"
import { Effect, Exit, Queue, Scope } from "effect"

import * as Bodies from "./bodies.ts"

interface Fixture {
  readonly bodies: Bodies.Bodies
  /** Every path that was OPENED, in order — the whole point of the module is
   *  which of these are absent. */
  readonly reads: ReadonlyArray<string>
  /** Every `(path, text)` handed to a reader, in order. Filled by {@link took}
   *  rather than by the publisher, so it and the waiting cannot disagree. */
  readonly published: ReadonlyArray<readonly [string, string]>
  /** Wait until `count` bodies have been published, and not by polling: the
   *  publisher offers to a queue and this takes from it, so a test resumes on
   *  the event itself. A body that never comes fails here with what was
   *  published instead, rather than hanging until the runner gives up. */
  readonly took: (count: number) => Effect.Effect<void>
  /** A reader opening a file: a scope of its own, the hold taken in it, and the
   *  ask — which is what the two callers in `./runtime.ts` amount to for a path
   *  whose body the set does not keep. What comes back is that reader LEAVING,
   *  which is that scope closing (the wire's own release is a subscription's
   *  scope, asked for by the `holders` dep in `./runtime.ts`). */
  readonly opens: (path: string) => Effect.Effect<Effect.Effect<void>>
}

/** How long a body may take to arrive before the test says it never did.
 *  Generous, because it is a DIAGNOSTIC bound and not a wait: every read in
 *  here answers immediately, so nothing spends this. */
const NEVER_CAME = "5 seconds"

const withBodies = <A>(
  disk: Readonly<Record<string, string | "unreadable">>,
  use: (fixture: Fixture) => Effect.Effect<A, unknown>,
): Promise<A> => {
  const reads: Array<string> = []
  const published: Array<readonly [string, string]> = []

  return Effect.gen(function*() {
    const arrivals = yield* Queue.unbounded<readonly [string, string]>()
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
      expect(fixture.published).toEqual([["report.html", "<h1>Cabinet quote</h1>"]])
    })))

// The live half: a file somebody is showing, rewritten under them, is read
// again and republished — which is how a page that was open before a `git pull`
// is showing what the file says after it.
test("a file somebody holds is re-read when it moves", () =>
  withBodies({ "report.html": "before" }, (fixture) =>
    Effect.gen(function*() {
      yield* fixture.opens("report.html")
      yield* fixture.took(1)

      fixture.bodies.unread(["report.html"])
      yield* fixture.took(2)
      expect(fixture.reads).toEqual(["report.html", "report.html"])
    })))

// …and the half that is about the cost: a revision that moved four hundred
// saved pages nobody has open opens none of them. Without this the module would
// be a cache with extra steps.
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

// THE WHOLE CHANGE, in one test: the reader LEFT, so the file stops being read.
// This is what the sixteen-slot LRU could only approximate — a closed tab used
// to leave its path behind, re-read on every revision that touched it until
// sixteen newer opens pushed it out.
test("a file whose last reader has gone is not re-read", () =>
  withBodies({ "report.html": "before", "other.html": "also" }, (fixture) =>
    Effect.gen(function*() {
      const release = yield* fixture.opens("report.html")
      yield* fixture.took(1)

      yield* release
      fixture.bodies.unread(["report.html"])
      // The barrier: a file somebody IS holding, asked for after the one that
      // must not be read.
      yield* fixture.opens("other.html")
      yield* fixture.took(2)
      expect(fixture.reads).toEqual(["report.html", "other.html"])
    })))

// Two readers of one file are two holds, and the first to leave takes its own
// and nobody else's — kolu's refcounted watchers, whose `unsubscribe` is
// idempotent for exactly this reason. Releasing twice must not evict the reader
// still showing the page.
test("a second reader keeps the file live, and a doubled release takes nothing extra", () =>
  withBodies({ "report.html": "before", "other.html": "also" }, (fixture) =>
    Effect.gen(function*() {
      const first = yield* fixture.opens("report.html")
      yield* fixture.took(1)
      const second = yield* fixture.opens("report.html")
      yield* fixture.took(2)

      // The first reader leaves, twice. A release that counted twice would drop
      // the hold the second reader still has, and the re-read below would not
      // happen.
      yield* first
      yield* first
      fixture.bodies.unread(["report.html"])
      yield* fixture.took(3)

      // …and when the second one goes too, the file goes quiet.
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

// The teardown half of the refcount: a path asked for and released before the
// reader got to it is DROPPED rather than read, so a page opened and closed in
// one frame costs no disk at all.
test("a file released before the read is taken is never opened", () =>
  withBodies({ "gone.html": "quickly", "other.html": "also" }, (fixture) =>
    Effect.gen(function*() {
      const release = yield* fixture.opens("gone.html")
      yield* release
      yield* fixture.opens("other.html")
      yield* fixture.took(1)

      expect(fixture.reads).toEqual(["other.html"])
      expect(fixture.published).toEqual([["other.html", "also"]])
    })))

// A file that went between the listing and the read is not this module's news
// to break: the next probe drops the key, and the page says there is no such
// file. What must not happen is a reader being handed an empty body.
test("a file that has gone publishes nothing", () =>
  withBodies({ "here.html": "still here" }, (fixture) =>
    Effect.gen(function*() {
      yield* fixture.opens("gone.html")
      // Asked second and answered first, which is the whole proof: the reader
      // is serial, so `gone.html` had already been read and dropped.
      yield* fixture.opens("here.html")
      yield* fixture.took(1)

      expect(fixture.reads).toEqual(["gone.html", "here.html"])
      expect(fixture.published).toEqual([["here.html", "still here"]])
    })))

// The failure this module leaves quiet on screen — and the property that
// matters most about it: the reading fiber goes on. One unreadable saved page
// used to fail the whole probe; it must not now cost every other body.
test("a body that cannot be read publishes nothing and does not stop the reader", () =>
  withBodies({ "locked.html": "unreadable", "fine.html": "readable" }, (fixture) =>
    Effect.gen(function*() {
      yield* fixture.opens("locked.html")
      yield* fixture.opens("fine.html")
      yield* fixture.took(1)

      expect(fixture.reads).toEqual(["locked.html", "fine.html"])
      expect(fixture.published).toEqual([["fine.html", "readable"]])
    })))
