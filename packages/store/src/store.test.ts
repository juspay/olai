/**
 * The store, against a real directory.
 *
 * These run on a temp directory with a TEST CODEC — the store is generic, so
 * proving it needs no outlines, and a codec written here is the only way to
 * exercise the two error scopes it has to keep apart: a file the codec can
 * render around (published, with the failure embedded in the set) and a set
 * the codec refuses whole (last-good held, errors published beside it).
 *
 * Almost everything drives the probe through `refresh` with the watcher off,
 * because "the probe is the only source of truth" is exactly what makes that a
 * complete test: a watcher event and a `refresh` reach the same code. The one
 * test that turns the watcher on is the one about the watcher — that a burst of
 * writes lands as one update rather than five.
 */

import { NodeServices } from "@effect/platform-node"
import { expect, test } from "bun:test"
import { Effect, Result, SubscriptionRef } from "effect"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"

import type { Codec } from "./codec.ts"
import type { PlatformFailure } from "./errors.ts"
import * as Store from "./store.ts"

// ── the test codec ─────────────────────────────────────────────────────

/**
 * A file is its text. A file whose first character is `!` does not decode. A
 * line reading `needs <name>` is a reference to `<name>.txt`, and a reference
 * to a file that is not in the set is what makes the WHOLE set invalid —
 * the store's two outcomes, in eight lines, with nothing outline-shaped in
 * sight.
 */
interface Loaded {
  readonly text: Readonly<Record<string, string>>
  readonly broken: ReadonlyArray<string>
}

let decodes: Array<string> = []

const codec: Codec<string, Loaded, ReadonlyArray<string>> = {
  match: (path) => path.endsWith(".txt"),

  decode: (path, contents) => {
    decodes.push(path)
    return contents.startsWith("!")
      ? Result.fail([`${path}: unreadable`])
      : Result.succeed(contents)
  },

  validate: (files) => {
    const text: Record<string, string> = {}
    const broken: Array<string> = []
    for (const [path, decoded] of files) {
      if (Result.isFailure(decoded)) broken.push(path)
      else text[path] = decoded.success
    }

    const dangling = Object.entries(text).flatMap(([path, contents]) =>
      [...contents.matchAll(/^needs (\S+)$/gm)]
        .map((match) => `${match[1]}.txt`)
        .filter((target) => !(target in text))
        .map((target) => `${path}: needs ${target}, which is not in the set`)
    )

    return dangling.length > 0
      ? Result.fail(dangling)
      : Result.succeed({ text, broken })
  },
}

// ── the harness ────────────────────────────────────────────────────────

interface Fixture {
  readonly store: Store.Store<Loaded, ReadonlyArray<string>>
  readonly write: (file: string, contents: string) => void
  readonly remove: (file: string) => void
  /** Poll until the snapshot satisfies `holds`, or fail saying what it held
   *  instead. Nothing else in here waits on a duration: a test that sleeps for
   *  as long as it guesses an update takes is a test that is flaky on a loaded
   *  runner and slow everywhere else. */
  readonly settled: (
    holds: (snapshot: Store.Snapshot<Loaded> | null) => boolean,
  ) => Effect.Effect<Store.Snapshot<Loaded> | null>
}

const withStore = <A>(
  files: Readonly<Record<string, string>>,
  use: (fixture: Fixture) => Effect.Effect<A, PlatformFailure>,
  options: { readonly watch?: boolean } = {},
): Promise<A> => {
  decodes = []
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "olai-store-"))
  const write = (file: string, contents: string) => {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
    fs.writeFileSync(path.join(root, file), contents)
  }
  for (const [file, contents] of Object.entries(files)) write(file, contents)

  return Effect.gen(function*() {
    const store = yield* Store.make({
      root,
      codec,
      watch: options.watch ?? false,
      settle: "20 millis",
    })
    return yield* use({
      store,
      write,
      remove: (file) => fs.rmSync(path.join(root, file)),
      settled: (holds) =>
        Effect.gen(function*() {
          for (let attempt = 0; attempt < 200; attempt++) {
            const snapshot = yield* SubscriptionRef.get(store.snapshot)
            if (holds(snapshot)) return snapshot
            yield* Effect.sleep("25 millis")
          }
          const stuck = yield* SubscriptionRef.get(store.snapshot)
          return yield* Effect.die(
            new Error(`the snapshot never settled; it is ${JSON.stringify(stuck)}`),
          )
        }),
    })
  }).pipe(
    Effect.scoped,
    Effect.provide(NodeServices.layer),
    Effect.runPromise,
  ).finally(() => {
    fs.rmSync(root, { recursive: true, force: true })
  })
}

const snapshotOf = (store: Store.Store<Loaded, ReadonlyArray<string>>) =>
  SubscriptionRef.get(store.snapshot)

const errorsOf = (store: Store.Store<Loaded, ReadonlyArray<string>>) =>
  SubscriptionRef.get(store.errors)

// ── boot ───────────────────────────────────────────────────────────────

test("boot publishes the directory as revision 1, with nothing wrong", () =>
  withStore(
    { "a.txt": "alpha", "sub/b.txt": "beta", "ignored.md": "not ours" },
    ({ store }) =>
      Effect.gen(function*() {
        const snapshot = yield* snapshotOf(store)
        expect(snapshot?.rev).toBe(1)
        // Root-relative, `/`-separated, and only what `match` claimed.
        expect(snapshot?.value.text).toEqual({ "a.txt": "alpha", "sub/b.txt": "beta" })
        expect(yield* errorsOf(store)).toBeNull()
      }),
  ))

// Boot is not a special case of the error scopes, and this is what says so: a
// directory that already holds an unreadable file still boots to a snapshot,
// because the codec accepted one.
test("a directory that already holds an unreadable file still boots", () =>
  withStore({ "a.txt": "alpha", "b.txt": "!broken" }, ({ store }) =>
    Effect.gen(function*() {
      const snapshot = yield* snapshotOf(store)
      expect(snapshot?.rev).toBe(1)
      expect(snapshot?.value.broken).toEqual(["b.txt"])
      expect(yield* errorsOf(store)).toBeNull()
    })))

test("a root that is not there fails the boot rather than serving nothing", async () => {
  const outcome = await Effect.gen(function*() {
    return yield* Store.make({ root: path.join(os.tmpdir(), "olai-nope-9d2f"), codec })
  }).pipe(
    Effect.scoped,
    Effect.provide(NodeServices.layer),
    Effect.result,
    Effect.runPromise,
  )
  expect(Result.isFailure(outcome)).toBe(true)
})

// ── the probe ──────────────────────────────────────────────────────────

// The stamp table is what "nothing happened" means. A probe that found the same
// listing publishes nothing: no revision for a browser to diff, no re-decode,
// which is what makes a sixty-second backstop free.
test("a probe that finds nothing changed publishes nothing", () =>
  withStore({ "a.txt": "alpha" }, ({ store }) =>
    Effect.gen(function*() {
      decodes = []
      yield* store.refresh
      yield* store.refresh
      expect(decodes).toEqual([])
      expect((yield* snapshotOf(store))?.rev).toBe(1)
    })))

test("only the file whose stamp moved is read again", () =>
  withStore({ "a.txt": "alpha", "b.txt": "beta" }, ({ store, write }) =>
    Effect.gen(function*() {
      decodes = []
      write("b.txt", "beta, revised")
      yield* store.refresh

      expect(decodes).toEqual(["b.txt"])
      const snapshot = yield* snapshotOf(store)
      expect(snapshot?.rev).toBe(2)
      expect(snapshot?.value.text).toEqual({ "a.txt": "alpha", "b.txt": "beta, revised" })
    })))

// A file arriving without anyone asking is the `git pull` case, and the probe
// is a re-LISTING rather than a re-stat of what it knew about — which is the
// whole reason a listing is part of it.
test("a file that appears is picked up", () =>
  withStore({ "a.txt": "alpha" }, ({ store, write }) =>
    Effect.gen(function*() {
      write("sub/new.txt", "arrived")
      yield* store.refresh
      expect((yield* snapshotOf(store))?.value.text).toEqual({
        "a.txt": "alpha",
        "sub/new.txt": "arrived",
      })
    })))

// Deletion is not special (resolved 2026-08-09): no tombstone, no grace window
// — it is a probe diff like any other, and what it MEANS is the codec's to say.
test("a file that is deleted leaves the set", () =>
  withStore({ "a.txt": "alpha", "b.txt": "beta" }, ({ store, remove }) =>
    Effect.gen(function*() {
      remove("b.txt")
      yield* store.refresh
      const snapshot = yield* snapshotOf(store)
      expect(snapshot?.rev).toBe(2)
      expect(snapshot?.value.text).toEqual({ "a.txt": "alpha" })
    })))

// And when something referenced it, the deletion is a set-wide failure like any
// other dangling reference — the same path, no special case.
test("a deletion something referenced holds the last good set", () =>
  withStore({ "a.txt": "needs b", "b.txt": "beta" }, ({ store, remove }) =>
    Effect.gen(function*() {
      remove("b.txt")
      yield* store.refresh

      const snapshot = yield* snapshotOf(store)
      expect(snapshot?.rev).toBe(1)
      expect(snapshot?.value.text["b.txt"]).toBe("beta")
      expect(yield* errorsOf(store)).toEqual(["a.txt: needs b.txt, which is not in the set"])
    })))

// ── the two error scopes ───────────────────────────────────────────────

// Per-entity degrade: the codec decided this set is still a set, so it is
// published — with the failure inside it, for the view to render in that one
// file's place — and the error channel stays empty because nothing is being
// held back.
test("a file the codec renders around is published, not held", () =>
  withStore({ "a.txt": "alpha", "b.txt": "beta" }, ({ store, write }) =>
    Effect.gen(function*() {
      write("b.txt", "!broken")
      yield* store.refresh

      const snapshot = yield* snapshotOf(store)
      expect(snapshot?.rev).toBe(2)
      expect(snapshot?.value.text).toEqual({ "a.txt": "alpha" })
      expect(snapshot?.value.broken).toEqual(["b.txt"])
      expect(yield* errorsOf(store)).toBeNull()
    })))

// Whole-set refusal: the snapshot does not move, does not blank, does not lose
// its revision. The errors arrive on their own channel, which is the entire
// reason there are two.
test("a set the codec refuses leaves the last good snapshot where it is", () =>
  withStore({ "a.txt": "alpha" }, ({ store, write }) =>
    Effect.gen(function*() {
      write("a.txt", "needs missing")
      yield* store.refresh

      const snapshot = yield* snapshotOf(store)
      expect(snapshot?.rev).toBe(1)
      expect(snapshot?.value.text).toEqual({ "a.txt": "alpha" })
      expect(yield* errorsOf(store)).toEqual([
        "a.txt: needs missing.txt, which is not in the set",
      ])
    })))

test("fixing what was refused publishes again and clears the errors", () =>
  withStore({ "a.txt": "alpha" }, ({ store, write }) =>
    Effect.gen(function*() {
      write("a.txt", "needs missing")
      yield* store.refresh
      expect(yield* errorsOf(store)).not.toBeNull()

      write("a.txt", "alpha again")
      yield* store.refresh

      const snapshot = yield* snapshotOf(store)
      expect(snapshot?.rev).toBe(2)
      expect(snapshot?.value.text).toEqual({ "a.txt": "alpha again" })
      expect(yield* errorsOf(store)).toBeNull()
    })))

// ── the watcher ────────────────────────────────────────────────────────

// What the settle delay is for. A `git pull` is one logical change and hundreds
// of events; a save is one change and a handful. Either way the burst has to
// land as ONE probe, or every consumer downstream re-renders per file.
test("a burst of writes lands as one update", () =>
  withStore(
    { "a.txt": "alpha" },
    ({ store, settled, write }) =>
      Effect.gen(function*() {
        for (let n = 1; n <= 6; n++) write(`f${n}.txt`, `file number ${n}`.repeat(n))
        const snapshot = yield* settled(
          (snapshot) => Object.keys(snapshot?.value.text ?? {}).length === 7,
        )
        // Boot was 1, so a perfectly coalesced burst is 2. Allowing one more
        // covers a runner slow enough to settle in the middle of the writes;
        // six would mean the delay is not doing its job at all.
        expect(snapshot?.rev).toBeLessThanOrEqual(3)
      }),
    { watch: true },
  ))

test("an edit reaches the snapshot with nobody asking", () =>
  withStore(
    { "a.txt": "alpha" },
    ({ settled, write }) =>
      Effect.gen(function*() {
        write("a.txt", "alpha, edited on disk")
        const snapshot = yield* settled(
          (snapshot) => snapshot?.value.text["a.txt"] === "alpha, edited on disk",
        )
        expect(snapshot?.rev).toBe(2)
      }),
    { watch: true },
  ))
