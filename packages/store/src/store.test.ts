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
import { type Duration, Effect, Result, SubscriptionRef } from "effect"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"

import type { Codec } from "./codec.ts"
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
  /** What is on disk right now, or `null` for a file that is not there. The
   *  write-gate tests read this rather than the snapshot: "the store thinks it
   *  wrote" and "the bytes are there" are two claims, and a refused write has
   *  to fail the second one. */
  readonly read: (file: string) => string | null
  /** Everything under the root, root-relative — so a test can say the gate
   *  left no staged temp files behind. */
  readonly listing: () => ReadonlyArray<string>
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
  // `unknown`, because a test yields whatever it needs to: a probe fails with
  // `PlatformFailure`, a commit with `StaleWrite`, and a `flip` turns a success
  // into a failure. A test that fails is a failing test whichever channel it
  // came out of, and enumerating them here would be a list to maintain.
  use: (fixture: Fixture) => Effect.Effect<A, unknown>,
  options: { readonly watch?: boolean; readonly backstop?: Duration.Input } = {},
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
      ...(options.backstop === undefined ? {} : { backstop: options.backstop }),
    })
    return yield* use({
      store,
      write,
      remove: (file) => fs.rmSync(path.join(root, file)),
      read: (file) => {
        const at = path.join(root, file)
        return fs.existsSync(at) ? fs.readFileSync(at, "utf8") : null
      },
      listing: () =>
        fs
          .readdirSync(root, { recursive: true, withFileTypes: true })
          .filter((entry) => entry.isFile())
          .map((entry) =>
            path.relative(root, path.join(entry.parentPath, entry.name)).split(path.sep)
              .join("/")
          )
          .sort(),
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

// A served directory is somebody's working tree. The walk does not enter the
// machine-owned corners of one — which is both a correctness statement (nothing
// in there is anyone's outline) and the reason a probe stays cheap while git is
// the thing generating the events.
test("the walk does not enter dot-directories or node_modules", () =>
  withStore(
    {
      "a.txt": "alpha",
      ".git/objects/b.txt": "not yours",
      "node_modules/pkg/c.txt": "not yours either",
      // Only SUBdirectories are judged: a dotted FILE is a file like any other.
      ".hidden.txt": "still mine",
    },
    ({ store }) =>
      Effect.gen(function*() {
        expect((yield* snapshotOf(store))?.value.text).toEqual({
          ".hidden.txt": "still mine",
          "a.txt": "alpha",
        })
      }),
  ))

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

// ── what moved ─────────────────────────────────────────────────────────

// A consumer that publishes PER FILE needs the probe's own diff, and this is
// it. The first revision names everything, because everything is new to
// somebody holding nothing.
test("the first revision names every file as changed", () =>
  withStore({ "a.txt": "alpha", "sub/b.txt": "beta" }, ({ store }) =>
    Effect.gen(function*() {
      const snapshot = yield* snapshotOf(store)
      expect(snapshot?.changed).toEqual(["a.txt", "sub/b.txt"])
      expect(snapshot?.removed).toEqual([])
    })))

test("a revision names the file that moved and nothing else", () =>
  withStore({ "a.txt": "alpha", "b.txt": "beta" }, ({ store, write, remove }) =>
    Effect.gen(function*() {
      write("b.txt", "beta, revised")
      yield* store.refresh
      expect((yield* snapshotOf(store))?.changed).toEqual(["b.txt"])

      remove("b.txt")
      yield* store.refresh
      const gone = yield* snapshotOf(store)
      expect(gone?.changed).toEqual([])
      expect(gone?.removed).toEqual(["b.txt"])
    })))

// The summary spans the gap between two PUBLISHED revisions, not one probe. A
// probe whose set is refused publishes nothing, and the file it re-decoded is
// still what changed when a later probe finally validates — a consumer told
// only about the second one would be holding the first file's old contents
// forever.
test("what a refused probe found is still owed to the next revision", () =>
  withStore({ "a.txt": "alpha", "b.txt": "beta" }, ({ store, write }) =>
    Effect.gen(function*() {
      write("a.txt", "alpha, revised")
      write("b.txt", "needs missing")
      yield* store.refresh
      expect((yield* snapshotOf(store))?.rev).toBe(1)

      write("b.txt", "beta again")
      yield* store.refresh
      const snapshot = yield* snapshotOf(store)
      expect(snapshot?.rev).toBe(2)
      expect([...(snapshot?.changed ?? [])].sort()).toEqual(["a.txt", "b.txt"])
    })))

// A path lands in ONE of the two lists, whichever happened last: a file edited
// and then deleted is gone, and a consumer that upserted it because an earlier
// probe saw it change would be left holding a file the directory does not have.
test("a file edited and then deleted is removed, not changed", () =>
  withStore({ "a.txt": "alpha", "b.txt": "beta" }, ({ store, write, remove }) =>
    Effect.gen(function*() {
      write("a.txt", "needs missing")
      write("b.txt", "beta, revised")
      yield* store.refresh
      expect((yield* snapshotOf(store))?.rev).toBe(1)

      write("a.txt", "alpha again")
      remove("b.txt")
      yield* store.refresh
      const snapshot = yield* snapshotOf(store)
      expect(snapshot?.changed).toEqual(["a.txt"])
      expect(snapshot?.removed).toEqual(["b.txt"])
    })))

test("a commit's own files are what the revision it publishes names", () =>
  withStore({ "a.txt": "alpha", "b.txt": "beta" }, ({ store }) =>
    Effect.gen(function*() {
      yield* store.commit({
        baseRev: 1,
        changes: [{ path: "b.txt", contents: "beta, committed" }],
      })
      expect((yield* snapshotOf(store))?.changed).toEqual(["b.txt"])
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

// The backstop is the decision that a watcher is a latency optimisation and
// never a guarantee (resolved 2026-08-09), so it is proved the only way that
// claim can be: with the watcher OFF and nobody calling `refresh`, the store
// still catches up on its own.
test("the backstop notices a change with no watcher and nobody asking", () =>
  withStore(
    { "a.txt": "alpha" },
    ({ settled, write }) =>
      Effect.gen(function*() {
        write("a.txt", "alpha, changed behind the watcher's back")
        const snapshot = yield* settled(
          (snapshot) =>
            snapshot?.value.text["a.txt"] === "alpha, changed behind the watcher's back",
        )
        expect(snapshot?.rev).toBe(2)
      }),
    { watch: false, backstop: "50 millis" },
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

// ── the write gate ─────────────────────────────────────────────────────
//
// Five claims, and each one is a thing the gate exists to make true: a commit
// publishes, a stale base is refused BY REVISION rather than by inspecting the
// bytes, a set the codec rejects costs nothing on disk, several files land
// all-or-none, and two writers racing one revision cannot both win.

test("a commit writes, re-reads and publishes the next revision", () =>
  withStore({ "a.txt": "alpha" }, ({ read, store }) =>
    Effect.gen(function*() {
      const before = yield* snapshotOf(store)
      const committed = yield* store.commit({
        baseRev: before?.rev ?? 0,
        changes: [{ path: "a.txt", contents: "alpha, committed" }],
      })

      expect(Result.isSuccess(committed)).toBe(true)
      expect(read("a.txt")).toBe("alpha, committed")
      const after = yield* snapshotOf(store)
      expect(after?.rev).toBe((before?.rev ?? 0) + 1)
      expect(after?.value.text["a.txt"]).toBe("alpha, committed")
      expect(yield* errorsOf(store)).toBeNull()
    })))

// The one the coarse stamp would otherwise lose: same length, same second. It
// is not a corner case for a writer — every toggle of one character is one.
test("a commit that changes no length in the same second still publishes", () =>
  withStore({ "a.txt": "alpha" }, ({ store }) =>
    Effect.gen(function*() {
      const before = yield* snapshotOf(store)
      yield* store.commit({
        baseRev: before?.rev ?? 0,
        changes: [{ path: "a.txt", contents: "ALPHA" }],
      })
      const after = yield* snapshotOf(store)
      expect(after?.value.text["a.txt"]).toBe("ALPHA")
      expect(after?.rev).toBe((before?.rev ?? 0) + 1)
    })))

test("a new file arrives through the gate, directory and all", () =>
  withStore({ "a.txt": "alpha" }, ({ read, store }) =>
    Effect.gen(function*() {
      const before = yield* snapshotOf(store)
      yield* store.commit({
        baseRev: before?.rev ?? 0,
        changes: [{ path: "deep/down/new.txt", contents: "new" }],
      })
      expect(read("deep/down/new.txt")).toBe("new")
      expect((yield* snapshotOf(store))?.value.text["deep/down/new.txt"]).toBe("new")
    })))

test("a base the store has moved past is a StaleWrite naming where it is", () =>
  withStore({ "a.txt": "alpha" }, ({ read, store, write }) =>
    Effect.gen(function*() {
      const before = yield* snapshotOf(store)
      // Somebody else got there first — a `git pull`, another tab. The gate's
      // own probe is what notices, which is why nothing here calls `refresh`.
      write("a.txt", "alpha, from elsewhere")

      const failure = yield* Effect.flip(
        store.commit({
          baseRev: before?.rev ?? 0,
          changes: [{ path: "a.txt", contents: "alpha, from us" }],
        }),
      )
      expect(failure._tag).toBe("StaleWrite")
      expect(failure).toMatchObject({ baseRev: before?.rev, currentRev: 2 })
      // Refused, and the other writer's bytes are untouched.
      expect(read("a.txt")).toBe("alpha, from elsewhere")

      // The retry, from the revision the failure named, lands.
      const retried = yield* store.commit({
        baseRev: 2,
        changes: [{ path: "a.txt", contents: "alpha, from us" }],
      })
      expect(Result.isSuccess(retried)).toBe(true)
      expect(read("a.txt")).toBe("alpha, from us")
    })))

test("a set the codec refuses is not written and leaves no temp behind", () =>
  withStore({ "a.txt": "alpha" }, ({ listing, read, store }) =>
    Effect.gen(function*() {
      const before = yield* snapshotOf(store)
      const refused = yield* store.commit({
        baseRev: before?.rev ?? 0,
        changes: [{ path: "a.txt", contents: "needs nothing-like-this" }],
      })

      expect(Result.isFailure(refused)).toBe(true)
      if (Result.isFailure(refused)) {
        expect(refused.failure).toEqual([
          "a.txt: needs nothing-like-this.txt, which is not in the set",
        ])
      }
      expect(read("a.txt")).toBe("alpha")
      expect(listing()).toEqual(["a.txt"])
      // The refusal is an ANSWER, not a state: the snapshot did not move and
      // the error cell was never touched, because nothing on disk is wrong.
      expect((yield* snapshotOf(store))?.rev).toBe(before?.rev)
      expect(yield* errorsOf(store)).toBeNull()
    })))

test("several files land together or not at all", () =>
  withStore({ "a.txt": "alpha", "b.txt": "beta" }, ({ read, store }) =>
    Effect.gen(function*() {
      const before = yield* snapshotOf(store)
      // `a` would be fine on its own; `b` dangles. Neither is written.
      const refused = yield* store.commit({
        baseRev: before?.rev ?? 0,
        changes: [
          { path: "a.txt", contents: "alpha, edited" },
          { path: "b.txt", contents: "needs gamma" },
        ],
      })
      expect(Result.isFailure(refused)).toBe(true)
      expect(read("a.txt")).toBe("alpha")
      expect(read("b.txt")).toBe("beta")

      // And the pair that DOES validate lands as one revision, not two.
      const committed = yield* store.commit({
        baseRev: before?.rev ?? 0,
        changes: [
          { path: "a.txt", contents: "needs gamma" },
          { path: "gamma.txt", contents: "here" },
        ],
      })
      expect(Result.isSuccess(committed)).toBe(true)
      expect((yield* snapshotOf(store))?.rev).toBe((before?.rev ?? 0) + 1)
    })))

test("the post-publish hook runs after the snapshot moved, inside the gate", () =>
  withStore({ "a.txt": "alpha" }, ({ store }) =>
    Effect.gen(function*() {
      let sawRev = 0
      const before = yield* snapshotOf(store)
      yield* store.commit({
        baseRev: before?.rev ?? 0,
        changes: [{ path: "a.txt", contents: "alpha, hooked" }],
        afterPublish: Effect.gen(function*() {
          sawRev = (yield* snapshotOf(store))?.rev ?? 0
        }),
      })
      expect(sawRev).toBe((before?.rev ?? 0) + 1)
    })))

/**
 * The race the whole design is for: two writers derive an edit from the SAME
 * revision and commit concurrently. One wins; the other is told the store
 * moved, and its retry against the new base lands. Nothing is silently lost —
 * which is the property, not the ordering.
 */
test("two writers on one revision: one commits, the other retries", () =>
  withStore({ "a.txt": "alpha" }, ({ read, store }) =>
    Effect.gen(function*() {
      const base = (yield* snapshotOf(store))?.rev ?? 0
      const attempt = (mark: string) =>
        Effect.gen(function*() {
          // Semantic writers re-derive: each appends its own line to whatever
          // it reads, which is what makes a retry land cleanly rather than
          // clobber.
          for (let tries = 0; tries < 5; tries++) {
            const at = yield* snapshotOf(store)
            const outcome = yield* Effect.result(
              store.commit({
                baseRev: tries === 0 ? base : at?.rev ?? 0,
                changes: [
                  { path: "a.txt", contents: `${at?.value.text["a.txt"] ?? ""}\n${mark}` },
                ],
              }),
            )
            if (Result.isSuccess(outcome)) return
          }
          return yield* Effect.die(new Error(`${mark} never committed`))
        })

      yield* Effect.all([attempt("first"), attempt("second")], { concurrency: 2 })

      const text = read("a.txt") ?? ""
      expect(text.includes("first")).toBe(true)
      expect(text.includes("second")).toBe(true)
      expect((yield* snapshotOf(store))?.rev).toBe(base + 2)
    })))
