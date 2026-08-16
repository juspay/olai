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
import { Effect } from "effect"

import * as Bodies from "./bodies.ts"

interface Fixture {
  readonly bodies: Bodies.Bodies
  /** Every path that was OPENED, in order — the whole point of the module is
   *  which of these are absent. */
  readonly reads: ReadonlyArray<string>
  /** Every `(path, text)` handed to a reader. */
  readonly published: ReadonlyArray<readonly [string, string]>
  /** Wait until as many bodies have been published as `count`, or say what was
   *  published instead. Nothing here sleeps for a guessed duration. */
  readonly settled: (count: number) => Effect.Effect<void>
  /** Wait for the reading fiber to have gone quiet, for the assertions that are
   *  about something NOT happening. */
  readonly quiet: Effect.Effect<void>
}

const withBodies = <A>(
  disk: Readonly<Record<string, string | "unreadable">>,
  use: (fixture: Fixture) => Effect.Effect<A, unknown>,
  options: { readonly watching?: number } = {},
): Promise<A> => {
  const reads: Array<string> = []
  const published: Array<readonly [string, string]> = []

  return Effect.gen(function*() {
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
        published.push([path, text])
      },
      ...(options.watching === undefined ? {} : { watching: options.watching }),
    })

    const settled = (count: number) =>
      Effect.gen(function*() {
        for (let attempt = 0; attempt < 200; attempt++) {
          if (published.length >= count) return
          yield* Effect.sleep("5 millis")
        }
        return yield* Effect.die(
          new Error(`only ${JSON.stringify(published)} was ever published`),
        )
      })

    return yield* use({
      bodies,
      reads,
      published,
      settled,
      // Long enough for the reading fiber to have taken anything that was
      // queued: every read in here is a stub that answers immediately, so a
      // handful of turns is the whole of what "it would have happened by now"
      // takes.
      quiet: Effect.sleep("50 millis"),
    })
  }).pipe(Effect.scoped, Effect.runPromise)
}

test("opening a file reads its body once and hands it over", () =>
  withBodies({ "report.html": "<h1>Cabinet quote</h1>" }, (fixture) =>
    Effect.gen(function*() {
      fixture.bodies.opened("report.html")
      yield* fixture.settled(1)

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
      yield* fixture.settled(1)

      fixture.bodies.moved(["report.html"])
      yield* fixture.settled(2)
      expect(fixture.reads).toEqual(["report.html", "report.html"])
    })))

// …and the half that is about the cost: a revision that moved four hundred
// saved pages nobody has open opens none of them. Without this the module would
// be a cache with extra steps.
test("a file nobody has opened is not read when it moves", () =>
  withBodies({ "report.html": "before", "other.html": "also" }, (fixture) =>
    Effect.gen(function*() {
      fixture.bodies.opened("report.html")
      yield* fixture.settled(1)

      fixture.bodies.moved(["other.html"])
      yield* fixture.quiet
      expect(fixture.reads).toEqual(["report.html"])
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
        yield* fixture.settled(2)

        fixture.bodies.moved(["first.html", "second.html"])
        yield* fixture.settled(3)
        yield* fixture.quiet
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
  withBodies({}, (fixture) =>
    Effect.gen(function*() {
      fixture.bodies.opened("gone.html")
      yield* fixture.quiet

      expect(fixture.reads).toEqual(["gone.html"])
      expect(fixture.published).toEqual([])
    })))

// The failure this module leaves quiet on screen — and the property that
// matters most about it: the reading fiber goes on. One unreadable saved page
// used to fail the whole probe; it must not now cost every other body.
test("a body that cannot be read publishes nothing and does not stop the reader", () =>
  withBodies({ "locked.html": "unreadable", "fine.html": "readable" }, (fixture) =>
    Effect.gen(function*() {
      fixture.bodies.opened("locked.html")
      yield* fixture.quiet
      expect(fixture.published).toEqual([])

      fixture.bodies.opened("fine.html")
      yield* fixture.settled(1)
      expect(fixture.published).toEqual([["fine.html", "readable"]])
    })))
