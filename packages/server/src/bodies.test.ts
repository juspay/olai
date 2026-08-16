/**
 * The bodies nobody keeps, against a disk that answers whatever a test says.
 *
 * The subject is a policy rather than a file system, so the reads are a stub
 * that RECORDS: what these tests are about is which files were opened and which
 * were not, and a real directory would only make that harder to say. The one
 * thing they do wait on is the reading fiber, which is what publishing a body
 * goes through.
 */

import { PlatformFailure } from "@olai/store"
import { expect, test } from "bun:test"
import { Effect, Queue } from "effect"

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
}

/** How long a body may take to arrive before the test says it never did.
 *  Generous, because it is a DIAGNOSTIC bound and not a wait: every read in
 *  here answers immediately, so nothing spends this. */
const NEVER_CAME = "5 seconds"

const withBodies = <A>(
  disk: Readonly<Record<string, string | "unreadable">>,
  use: (fixture: Fixture) => Effect.Effect<A, unknown>,
  options: { readonly watching?: number } = {},
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
      ...(options.watching === undefined ? {} : { watching: options.watching }),
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

    return yield* use({ bodies, reads, published, took })
  }).pipe(Effect.scoped, Effect.runPromise)
}

test("opening a file reads its body once and hands it over", () =>
  withBodies({ "report.html": "<h1>Cabinet quote</h1>" }, (fixture) =>
    Effect.gen(function*() {
      fixture.bodies.opened("report.html")
      yield* fixture.took(1)

      expect(fixture.reads).toEqual(["report.html"])
      expect(fixture.published).toEqual([["report.html", "<h1>Cabinet quote</h1>"]])
    })))

// The live half: a file somebody is showing, rewritten under them, is read
// again and republished — which is how a page that was open before a `git pull`
// is showing what the file says after it.
test("a file somebody is watching is re-read when it moves", () =>
  withBodies({ "report.html": "before" }, (fixture) =>
    Effect.gen(function*() {
      fixture.bodies.opened("report.html")
      yield* fixture.took(1)

      fixture.bodies.moved(["report.html"])
      yield* fixture.took(2)
      expect(fixture.reads).toEqual(["report.html", "report.html"])
    })))

// …and the half that is about the cost: a revision that moved four hundred
// saved pages nobody has open opens none of them. Without this the module would
// be a cache with extra steps.
//
// The absence is read AFTER a later ask has come back, which is what makes it a
// fact rather than a race: the reader takes one path at a time in the order
// they were asked for, so a read of `other.html` queued before this one would
// have happened before it.
test("a file nobody has opened is not read when it moves", () =>
  withBodies({ "report.html": "before", "other.html": "also" }, (fixture) =>
    Effect.gen(function*() {
      fixture.bodies.opened("report.html")
      yield* fixture.took(1)

      fixture.bodies.moved(["other.html"])
      fixture.bodies.opened("report.html")
      yield* fixture.took(2)
      expect(fixture.reads).toEqual(["report.html", "report.html"])
    })))

// The bound, which is what makes "no eviction" untrue rather than unlikely. The
// STALEST path goes, and losing it costs live updates on a page nobody is
// looking at — never a body, since opening one asks again.
test("only the last few opened files stay watched", () =>
  withBodies(
    { "first.html": "one", "second.html": "two" },
    (fixture) =>
      Effect.gen(function*() {
        fixture.bodies.opened("first.html")
        fixture.bodies.opened("second.html")
        yield* fixture.took(2)

        // `first` is named FIRST, so a re-read of it would be taken before the
        // one that follows — and the assertion below is read once that one has
        // come back.
        fixture.bodies.moved(["first.html", "second.html"])
        yield* fixture.took(3)
        // The stalest of the two was dropped when the second arrived, so only
        // the newer one was read again.
        expect(fixture.reads).toEqual(["first.html", "second.html", "second.html"])
      }),
    { watching: 1 },
  ))

// A file that went between the listing and the read is not this module's news
// to break: the next probe drops the key, and the page says there is no such
// file. What must not happen is a reader being handed an empty body.
test("a file that has gone publishes nothing", () =>
  withBodies({ "here.html": "still here" }, (fixture) =>
    Effect.gen(function*() {
      fixture.bodies.opened("gone.html")
      // Asked second and answered first, which is the whole proof: the reader
      // is serial, so `gone.html` had already been read and dropped.
      fixture.bodies.opened("here.html")
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
      fixture.bodies.opened("locked.html")
      fixture.bodies.opened("fine.html")
      yield* fixture.took(1)

      expect(fixture.reads).toEqual(["locked.html", "fine.html"])
      expect(fixture.published).toEqual([["fine.html", "readable"]])
    })))
