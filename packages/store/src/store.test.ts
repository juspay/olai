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
 * complete test: a watcher event and a `refresh` reach the same code. The tests
 * that turn the watcher on are the ones ABOUT the watcher — that a burst of
 * writes lands as one update rather than five, and that a directory made after
 * the store booted is watched rather than waited for.
 */

import { NodeServices } from "@effect/platform-node"
import { expect, test } from "bun:test"
import { type Duration, Effect, Result, SubscriptionRef } from "effect"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"

import type { Codec, Since } from "./codec.ts"
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
/** One per {@link Codec.match} call, which is one per directory entry the
 *  WALK looked at. It is the cheapest true measure of "somebody statted this
 *  tree" that a codec can take, and it is what the cheap read has to leave at
 *  zero however many times it is asked. */
let matches = 0
/** One entry per {@link Codec.validate} call, naming the set it was asked
 *  about. A codec whose validation is expensive — and the one this repo has
 *  builds a view of the whole corpus — makes "how many times per write" a
 *  number worth pinning, and the gate's answer is once. */
let validations: Array<ReadonlyArray<string>> = []
/** What the store OFFERED at each of those calls: the verdict it last
 *  published and every path that has moved since — `undefined` when there is
 *  nothing to build on. A codec that can answer incrementally spends it
 *  ({@link Since}); this one only writes it down, which is all that is needed
 *  to say what the store promises about it. */
let offered: Array<Since<Loaded> | undefined> = []
/**
 * Two one-shot hooks, each fired from a codec member and disarmed as it fires,
 * so a test can reach INSIDE one `commit` — which is otherwise one call with
 * every interesting moment sealed in it.
 *
 * `whileDecoding` fires on the first decode of the write gate's candidate:
 * after the gate's opening probe, before the set is judged, and before anything
 * is renamed. `whileListing` fires on the first `match` of the next listing,
 * which — armed from the first hook — is the probe that follows the rename, so
 * it is the one place a test can put different bytes under a file the write has
 * already promised.
 */
let whileDecoding: (() => void) | null = null
let whileListing: (() => void) | null = null

/** What a `.blob` decodes to: the fact that it is there, and no bytes. A
 *  codec's answer for a file whose content the set does not want to hold — see
 *  {@link Codec.byName} — and a value a test can read out of the set to say the
 *  file was claimed without being opened. */
const NOT_READ = "(not read)"

const codec: Codec<string, Loaded, ReadonlyArray<string>> = {
  match: (path) => {
    matches += 1
    const during = whileListing
    whileListing = null
    during?.()
    return path.endsWith(".txt") || path.endsWith(".blob")
  },

  byName: (path) => (path.endsWith(".blob") ? Result.succeed(NOT_READ) : null),

  decode: (path, contents) => {
    decodes.push(path)
    const during = whileDecoding
    whileDecoding = null
    during?.()
    return contents.startsWith("!")
      ? Result.fail([`${path}: unreadable`])
      : Result.succeed(contents)
  },

  validate: (files, since) => {
    validations.push([...files.keys()])
    offered.push(since)
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

  /** The store's own failure, in this fixture's vocabulary. One string, so a
   *  test can assert it arrived on the SAME channel a dangling reference does
   *  — which is the whole of the widening. */
  unreadable: (failure) => [`the directory could not be read: ${failure.message}`],
}

// ── the harness ────────────────────────────────────────────────────────

interface Fixture {
  readonly store: Store.Store<Loaded, ReadonlyArray<string>>
  /** The served directory itself, absolute. Only the test about a directory
   *  that stops being readable needs it — every other one talks in the
   *  root-relative paths the store publishes. */
  readonly root: string
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
  /** The absolute path of one served file — for the tests that have to move a
   *  file the way something outside this process would, by renaming another
   *  file over it. */
  readonly at: (file: string) => string
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
  options: {
    readonly watch?: boolean
    readonly backstop?: Duration.Input
    readonly codec?: typeof codec
  } = {},
): Promise<A> => {
  decodes = []
  validations = []
  offered = []
  matches = 0
  whileDecoding = null
  whileListing = null
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "olai-store-"))
  const write = (file: string, contents: string) => {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
    fs.writeFileSync(path.join(root, file), contents)
  }
  for (const [file, contents] of Object.entries(files)) write(file, contents)

  return Effect.gen(function*() {
    const store = yield* Store.make({
      root,
      codec: options.codec ?? codec,
      watch: options.watch ?? false,
      settle: "20 millis",
      ...(options.backstop === undefined ? {} : { backstop: options.backstop }),
    })
    return yield* use({
      store,
      root,
      write,
      at: (file) => path.join(root, file),
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
      settled: (holds) => until(snapshotOf(store), holds, "the snapshot never settled"),
    })
  }).pipe(
    Effect.scoped,
    Effect.provide(NodeServices.layer),
    Effect.runPromise,
  ).finally(() => {
    fs.rmSync(root, { recursive: true, force: true })
  })
}

/**
 * Poll one ASKING until it says what a test is waiting for, or die saying what
 * it said instead.
 *
 * ONE poller for both channels. It takes the read rather than the ref because
 * the set is not a ref any more — it is a door with a freshness class on it
 * ({@link Store.read}) — and the errors channel still is; an `Effect<A>` is
 * what both of those are once asked, so one poller still covers both.
 *
 * Nothing in here waits on a duration: a test that sleeps for as long as it
 * guesses an update takes is flaky on a loaded runner and slow everywhere else
 * — and a second copy of that budget is one place to tune it and another to
 * leave stale.
 */
const until = <A>(
  asking: Effect.Effect<A>,
  holds: (value: A) => boolean,
  never: string,
): Effect.Effect<A> =>
  Effect.gen(function*() {
    for (let attempt = 0; attempt < 200; attempt++) {
      const value = yield* asking
      if (holds(value)) return value
      yield* Effect.sleep("25 millis")
    }
    const stuck = yield* asking
    return yield* Effect.die(new Error(`${never}; it is ${JSON.stringify(stuck)}`))
  })

/** The set, off the cheap class — which is what almost every test here is
 *  asking for: "what is the store serving", with no claim about the disk. The
 *  vintage tests below are the ones that read the other half of the answer. */
const snapshotOf = (store: Store.Store<Loaded, ReadonlyArray<string>>) =>
  Effect.map(store.read("cheap"), (aged) => aged.snapshot)

const errorsOf = (store: Store.Store<Loaded, ReadonlyArray<string>>) =>
  SubscriptionRef.get(store.errors)

/** Poll until something is on the errors channel — for the failures nobody
 *  asked for, which arrive on the backstop's own fiber. */
const settledErrors = (store: Store.Store<Loaded, ReadonlyArray<string>>) =>
  until(
    SubscriptionRef.get(store.errors),
    (errors) => errors !== null,
    "nothing reached the errors channel",
  )

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

// A file that is THERE and will not OPEN is a hole, not a banner — when the
// codec can absorb it. Without `unread`, this would fail the whole probe
// (`unreadable-directory`). The store fixture has no `unread`, so the
// directory-level sentence is what a codec that cannot absorb still says;
// olai's codec is the one that absorbs, and that is `./probe` + ops' codec.
//
// Root can read a 0000 file, so the assertion is skipped there.
test("a file that will not open is a hole when the codec absorbs it", () => {
  if (typeof process.getuid === "function" && process.getuid() === 0) return
  const absorbing: typeof codec = {
    ...codec,
    unread: (failure) => Result.fail([`${failure.path}: will not open`]),
  }
  return withStore(
    { "a.txt": "alpha", "locked.txt": "secret" },
    ({ store, root }) =>
      Effect.gen(function*() {
        fs.chmodSync(path.join(root, "locked.txt"), 0o000)
        try {
          // chmod does not change size; a same-second stamp miss would skip
          // the read. resync forgets stamps, which is the look the e2e
          // harness's POST /olai/resync is.
          yield* store.refresh("verified")
          const snapshot = yield* snapshotOf(store)
          expect(snapshot?.value.broken).toEqual(["locked.txt"])
          expect(snapshot?.value.text).toEqual({ "a.txt": "alpha" })
          expect(yield* errorsOf(store)).toBeNull()
        } finally {
          fs.chmodSync(path.join(root, "locked.txt"), 0o600)
        }
      }),
    { codec: absorbing },
  )
})

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
      yield* store.refresh("cheap")
      yield* store.refresh("cheap")
      expect(decodes).toEqual([])
      expect((yield* snapshotOf(store))?.rev).toBe(1)
    })))

test("only the file whose stamp moved is read again", () =>
  withStore({ "a.txt": "alpha", "b.txt": "beta" }, ({ store, write }) =>
    Effect.gen(function*() {
      decodes = []
      write("b.txt", "beta, revised")
      yield* store.refresh("cheap")

      expect(decodes).toEqual(["b.txt"])
      const snapshot = yield* snapshotOf(store)
      expect(snapshot?.rev).toBe(2)
      expect(snapshot?.value.text).toEqual({ "a.txt": "alpha", "b.txt": "beta, revised" })
    })))

// ── the files that are not read ────────────────────────────────────────
//
// A set can hold a file it does not want to hold the BYTES of, and `byName` is
// how a codec says so. These four are the whole contract: such a file is in the
// set, it is never opened, it moves like any other file, and its content is
// there for whoever actually asks.

test("a file the codec decodes from its name is in the set and never read", () =>
  withStore(
    { "a.txt": "alpha", "big.blob": "megabytes of somebody's saved page" },
    ({ store }) =>
      Effect.gen(function*() {
        const snapshot = yield* snapshotOf(store)
        expect(snapshot?.value.text).toEqual({
          "a.txt": "alpha",
          "big.blob": NOT_READ,
        })
        // The other half, and the one that is about memory: `decode` is what a
        // read leads to, and it was never reached for this file.
        expect(decodes).toEqual(["a.txt"])
      }),
  ))

test("a file that is not read still MOVES like every other file", () =>
  withStore({ "big.blob": "before" }, ({ store, write, settled }) =>
    Effect.gen(function*() {
      decodes = []
      write("big.blob", "after — a different length, so the stamp moved")
      yield* store.refresh("cheap")

      // Named as changed, so a consumer that publishes per file hears about it
      // — which is what lets a reader with the page open be handed the new
      // bytes — and still not opened by the probe.
      const snapshot = yield* settled((at) => at?.rev === 2)
      expect(snapshot?.changed).toEqual(["big.blob"])
      expect(decodes).toEqual([])
    })))

test("`body` reads one file's text on demand, and keeps nothing", () =>
  withStore({ "big.blob": "the whole saved page" }, ({ store }) =>
    Effect.gen(function*() {
      expect(yield* store.body("big.blob")).toBe("the whole saved page")
      // Twice, because "kept by nobody" means the second ask is another read
      // of the disk rather than a cache — and it says what the disk says now.
      expect(yield* store.body("big.blob")).toBe("the whole saved page")
      // Nothing about asking put the text into the set.
      expect((yield* snapshotOf(store))?.value.text).toEqual({ "big.blob": NOT_READ })
    })))

test("`body` answers null for a file that is not there", () =>
  withStore({ "a.txt": "alpha" }, ({ store }) =>
    Effect.gen(function*() {
      expect(yield* store.body("gone.blob")).toBeNull()
    })))

// MEMBERSHIP IS THE PROBE'S, enforced rather than promised. A caller reaching
// this with a path off a wire must not be able to name a file the walk pruned,
// a file no codec claims, or a climb out of the root — none of them are in the
// table the probe keeps, so none of them are opened, and each answers the same
// `null` a file that is gone already answers.
test("`body` reads a file of the SET, and nothing else on the disk", () =>
  withStore(
    {
      "a.txt": "alpha",
      "big.blob": "the whole saved page",
      // Pruned by the walk, claimable by the codec's `match` — the case a
      // suffix test alone would let through.
      ".git/objects/secret.blob": "not part of any set",
      // Claimed by nothing, so not in the table however readable it is.
      "README": "not ours",
    },
    ({ store, root }) =>
      Effect.gen(function*() {
        expect(yield* store.body("big.blob")).toBe("the whole saved page")
        expect(yield* store.body(".git/objects/secret.blob")).toBeNull()
        expect(yield* store.body("README")).toBeNull()
        // The climb, spelled as a path that WOULD resolve on this disk: the
        // file is really there and really readable, and it is not in the set.
        fs.writeFileSync(path.join(root, "..", "olai-outside.blob"), "somebody else's")
        expect(yield* store.body("../olai-outside.blob")).toBeNull()
        fs.rmSync(path.join(root, "..", "olai-outside.blob"))
      }),
  ))

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
      yield* store.refresh("cheap")
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
      yield* store.refresh("cheap")
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
      yield* store.refresh("cheap")

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
      yield* store.refresh("cheap")
      expect((yield* snapshotOf(store))?.changed).toEqual(["b.txt"])

      remove("b.txt")
      yield* store.refresh("cheap")
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
      yield* store.refresh("cheap")
      expect((yield* snapshotOf(store))?.rev).toBe(1)

      write("b.txt", "beta again")
      yield* store.refresh("cheap")
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
      yield* store.refresh("cheap")
      expect((yield* snapshotOf(store))?.rev).toBe(1)

      write("a.txt", "alpha again")
      remove("b.txt")
      yield* store.refresh("cheap")
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
      yield* store.refresh("cheap")

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
      yield* store.refresh("cheap")

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
      yield* store.refresh("cheap")
      expect(yield* errorsOf(store)).not.toBeNull()

      write("a.txt", "alpha again")
      yield* store.refresh("cheap")

      const snapshot = yield* snapshotOf(store)
      expect(snapshot?.rev).toBe(2)
      expect(snapshot?.value.text).toEqual({ "a.txt": "alpha again" })
      expect(yield* errorsOf(store)).toBeNull()
    })))

// The store's OTHER kind of error, on the same channel as the one above.
//
// A probe that cannot read the directory at all — EACCES, a mount that went
// away, ENOSPC — used to be caught, logged and dropped. Catching it is right:
// killing this fiber leaves a page live and permanently stale, which is the
// one failure mode a live store must not have. Dropping it was the bug — the
// snapshot froze at the last good revision and nothing anywhere said so. So
// both halves are asserted here: the tree stays, AND the reason is published.
test("a directory that stops being readable says so, over the last good tree", () =>
  withStore(
    { "a.txt": "alpha" },
    ({ root, store }) =>
      Effect.gen(function*() {
        expect((yield* snapshotOf(store))?.rev).toBe(1)

        fs.rmSync(root, { recursive: true, force: true })

        // The backstop's own probe is what finds it — nobody asked, which is
        // the case that used to go unreported.
        const errors = yield* settledErrors(store)
        expect(errors?.[0]).toContain("the directory could not be read")

        const snapshot = yield* snapshotOf(store)
        expect(snapshot?.rev).toBe(1)
        expect(snapshot?.value.text).toEqual({ "a.txt": "alpha" })
      }),
    { backstop: "20 millis" },
  ))

// ...and it says it ONCE. Every write to this ref is a frame the server sends
// to every open browser, so a directory that stays unreadable — a mount that
// is not coming back before somebody notices — would otherwise re-broadcast a
// byte-identical error on every backstop tick and every write gate's probe,
// forever.
//
// Asserted on IDENTITY, which is what makes it a fence rather than a
// restatement: `codec.unreadable` allocates a fresh value per call, so a
// dedupe that stopped deduping cannot leave the same object on the ref.
test("a directory that stays unreadable is said once, not on every probe", () =>
  withStore(
    { "a.txt": "alpha" },
    ({ root, store }) =>
      Effect.gen(function*() {
        fs.rmSync(root, { recursive: true, force: true })
        const first = yield* settledErrors(store)

        // Ten more looks at the same missing directory — the backstop's, and
        // the ones a caller asks for.
        for (let probe = 0; probe < 5; probe++) yield* Effect.ignore(store.refresh("cheap"))
        yield* Effect.sleep("120 millis")

        expect(yield* errorsOf(store)).toBe(first)
      }),
    { backstop: "20 millis" },
  ))

// ...and it clears itself when the directory comes back, exactly as a
// validation failure does. Nothing is written for that: publishing a revision
// clears the errors ref, which is what makes ONE channel the right shape for
// two kinds of error rather than a convenience.
test("a directory that comes back clears what was said about it", () =>
  withStore(
    { "a.txt": "alpha" },
    ({ root, store, write }) =>
      Effect.gen(function*() {
        fs.rmSync(root, { recursive: true, force: true })
        expect(yield* settledErrors(store)).not.toBeNull()

        write("a.txt", "alpha again")
        yield* store.refresh("cheap")

        expect(yield* errorsOf(store)).toBeNull()
        expect((yield* snapshotOf(store))?.value.text).toEqual({ "a.txt": "alpha again" })
      }),
    { backstop: "20 millis" },
  ))

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

// A directory born after boot is seen without the backstop. On bun 1.3.13
// the recursive watch did not follow it and this package closed the gap
// itself (the walk arms a watcher on each new directory). Bun 1.4.0's
// runtime follows it too — measured, rows 8 and 9 of the mutation table
// in https://github.com/juspay/oss.olai/blob/main/projects/olai/brainstorming/watcher-fd-cost.md. The test still holds the
// claim at the store, with the backstop left at sixty seconds so a pass
// cannot be the sweep.
//
// Four writes, and each one is a level of the claim: a directory born after
// boot, a SECOND file in it with no `mkdir` of its own to announce it, a
// directory born inside THAT one, and a second file in it too — which is the
// case that says the fix recurses rather than covering one generation.
//
// The backstop is left at its sixty-second default on purpose, and that is
// what makes this a test of the WATCHER: `settled` gives up after five
// seconds, so a pass can only mean somebody was watching directories that did
// not exist when the store booted.
test("a directory created after boot is watched, not waited for", () =>
  withStore(
    { "a.txt": "alpha" },
    ({ settled, write }) =>
      Effect.gen(function*() {
        const holds = (path: string) => (snapshot: Store.Snapshot<Loaded> | null) =>
          path in (snapshot?.value.text ?? {})

        write("fresh/first.txt", "the first note in a folder that did not exist at boot")
        yield* settled(holds("fresh/first.txt"))

        write("fresh/second.txt", "the second, which no mkdir announces")
        yield* settled(holds("fresh/second.txt"))

        write("fresh/deeper/third.txt", "a folder inside the new folder")
        yield* settled(holds("fresh/deeper/third.txt"))

        write("fresh/deeper/fourth.txt", "and the same claim, one level down")
        const snapshot = yield* settled(holds("fresh/deeper/fourth.txt"))

        expect(snapshot?.value.text).toEqual({
          "a.txt": "alpha",
          "fresh/first.txt": "the first note in a folder that did not exist at boot",
          "fresh/second.txt": "the second, which no mkdir announces",
          "fresh/deeper/third.txt": "a folder inside the new folder",
          "fresh/deeper/fourth.txt": "and the same claim, one level down",
        })
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

// The accepted trade for an OUTSIDE rewrite, and the reason there are two
// classes of look rather than one: the cheap look is the loop's, and the loop
// is entitled not to notice a same-length put-back that restores the original
// mtime. The verified class is where a caller says it cannot take that trade —
// and what the store does about it (forget the stamps, re-read) is inside, so
// the arithmetic in this comment is a fact about the fixture rather than
// something a caller has to know.
test("PIN (two classes): a same-length rewrite the cheap look misses, the verified publishes", () =>
  withStore({ "a.txt": "alpha" }, ({ store, write, root }) =>
    Effect.gen(function*() {
      const before = yield* snapshotOf(store)
      expect(before?.value.text["a.txt"]).toBe("alpha")
      const file = path.join(root, "a.txt")
      const stamp = fs.statSync(file)
      write("a.txt", "ALPHA")
      fs.utimesSync(file, stamp.atime, stamp.mtime)
      yield* store.refresh("cheap")
      const missed = yield* snapshotOf(store)
      expect(missed?.value.text["a.txt"]).toBe("alpha")
      expect(missed?.rev).toBe(before?.rev)
      yield* store.refresh("verified")
      const after = yield* snapshotOf(store)
      expect(after?.value.text["a.txt"]).toBe("ALPHA")
      expect(after?.rev).toBe((before?.rev ?? 0) + 1)
    })))

/**
 * WHAT `Confirmed` IS WORTH — the same fixture, asked of the READ, and the
 * answer is the opposite one.
 *
 * The pin above is about the LOOK, and the look is the verb that does not take
 * the stamp trade: `refresh("verified")` forgets the table and re-reads, so it
 * publishes the new bytes. The READ does take it. `Vintage.check` walks and
 * stats and never opens a file, and `sameStamp` is mtime-and-size — so over a
 * same-length rewrite that put the original mtime back, `read("verified")`
 * answers `Confirmed` **over the old bytes**, and every surface that renders
 * that proof says the set is one to act on.
 *
 * THAT IS THE BOUND, AND IT IS HELD HERE RATHER THAN IN A PARAGRAPH. The module
 * header states it ({@link ./vintage.ts}); `resync`'s folklore was stated in a
 * paragraph too, and the reason it survived four years is that nothing failed
 * when the sentence stopped being true. This fails.
 *
 * IT IS NOT THE LIE THE RED LINE IS ABOUT, and the difference is worth being
 * exact about. A fresh-looking answer from a WEDGED LOOP is a claim the store
 * could have checked and did not — that one is now unspellable, and the
 * rebase-shape pin is where. This is the resolution of the instrument itself:
 * the loop misses this rewrite too (the pin above), every consumer of this
 * package has taken that trade since 2026-08-09, and no walk-and-stat can do
 * better without opening every file on every question. A check cannot be
 * stronger than what it looked at.
 *
 * WHAT IT COSTS IN THE WORLD is the last line of the argument. The shapes that
 * produce it are a same-length rewrite inside one mtime second and a deliberate
 * `utimes` restore; every ordinary writer — a `git` checkout or rebase, an
 * editor, this package's own gate — renames over or moves the size or the
 * clock, and is caught. The one real producer of the invisible shape is a
 * harness putting a fixture back under a live server, and that is the caller
 * that knocks on `POST /olai/resync`, which takes the LOOK.
 */
test("PIN (what Confirmed is worth): the read's look is a stamp check, and says so", () =>
  withStore({ "a.txt": "alpha" }, ({ store, write, root }) =>
    Effect.gen(function*() {
      const file = path.join(root, "a.txt")
      const stamp = fs.statSync(file)
      // Five characters for five, and the clock put back: nothing a stat can
      // see has changed about this file.
      write("a.txt", "ALPHA")
      fs.utimesSync(file, stamp.atime, stamp.mtime)

      const checked = yield* store.read("verified")
      // A LOOK WAS TAKEN, on the asker's fiber, and it agreed — because what it
      // compares agrees.
      expect(checked.vintage.proof).toEqual({ _tag: "Confirmed" })
      expect(checked.vintage.age).toBe(0)
      // …over bytes that are no longer on the disk. This is the sentence the
      // module header claims and the one an agent's `stale: false` inherits.
      expect(checked.snapshot?.value.text["a.txt"]).toBe("alpha")

      // AND THE DOOR THAT DOES NOT TAKE THE TRADE IS ONE LINE AWAY, which is
      // why the bound is a bound and not a hole: the class that re-reads finds
      // it immediately, and a caller who cannot take the trade has somewhere to
      // go. Asserted here so the two verbs are read against each other rather
      // than in two files.
      yield* store.refresh("verified")
      expect((yield* snapshotOf(store))?.value.text["a.txt"]).toBe("ALPHA")
    })))

// ── `drifted`: the refusal door's byte check ───────────────────────────
//
// The stamp table's trade, seen from the other side: the look the loop takes
// is coarse and is right to be, so the one caller with a reason to pay for a
// stronger look — a write the codec refused — gets it here. These say what
// "the disk no longer says what the set was decoded from" means to that door:
// bytes, compared per asked path, over exactly the files it was asked about.

test("a file the disk still agrees with has not drifted", () =>
  withStore({ "a.txt": "alpha", "b.txt": "beta" }, ({ store }) =>
    Effect.gen(function*() {
      expect(yield* store.drifted(["a.txt", "b.txt"])).toEqual([])
      // The door answers from the cache and nothing else, so whichever side
      // of the boot probe this runs on, the answer is the same: an
      // agreeing cache names nothing, and a cache not yet READ IN has
      // nothing to be wrong about.
    })))

test("a member that was rewritten to the same length IN THE STAMP'S OWN TRADE is drift", () =>
  withStore({ "a.txt": "alpha" }, ({ store, write, root }) =>
    Effect.gen(function*() {
      const file = path.join(root, "a.txt")
      const stamp = fs.statSync(file)
      write("a.txt", "ALPHA")
      fs.utimesSync(file, stamp.atime, stamp.mtime)

      expect(yield* store.drifted(["a.txt"])).toEqual(["a.txt"])
      // A resync re-reads, and then the SAME check agrees again — the answer
      // a repair builds on.
      yield* store.refresh("verified")
      expect(yield* store.drifted(["a.txt"])).toEqual([])
    })))

// The READ side of the same door: the probe's own moves re-fingerprint what
// they cache, so a file the gate itself just wrote is not drift — the check
// must agree with the set the commit published, not with whatever it asked
// to replace.
test("a file the gate itself just wrote has not drifted", () =>
  withStore({ "a.txt": "alpha" }, ({ store }) =>
    Effect.gen(function*() {
      const before = yield* snapshotOf(store)
      yield* store.commit({
        baseRev: before?.rev ?? 0,
        changes: [{ path: "a.txt", contents: "alpha, committed" }],
      })
      expect(yield* store.drifted(["a.txt"])).toEqual([])
    })))

// Membership first, exactly as {@link Store.body} holds it: a path the probe
// does not hold is not answered on bytes. That covers a file the codec does
// not claim, a `.txt` that was never listed, and a name spelled at it from
// outside.
test("a path the set does not hold is skipped, not answered", () =>
  withStore({ "a.txt": "alpha" }, ({ store }) =>
    Effect.gen(function*() {
      expect(yield* store.drifted(["b.txt", "notes.md"])).toEqual([])
    })))

// The file the set never read is never checked: a `.blob`'s answer is its
// path, and bytes nobody decoded are bytes nothing can call drifted —
// whatever they become.
test("a file the codec answers by NAME is skipped — even when its bytes move", () =>
  withStore({ "a.blob": "one-" }, ({ store, write, root }) =>
    Effect.gen(function*() {
      const file = path.join(root, "a.blob")
      const stamp = fs.statSync(file)
      write("a.blob", "TWO!")
      fs.utimesSync(file, stamp.atime, stamp.mtime)

      expect(yield* store.drifted(["a.blob"])).toEqual([])
    })))

// And one member leaving the disk behind its own stamps is drift, said the
// same way: the cached bytes no longer exist.
test("a member that vanished has drifted", () =>
  withStore({ "a.txt": "alpha", "b.txt": "beta" }, ({ store, remove }) =>
    Effect.gen(function*() {
      remove("a.txt")
      expect(yield* store.drifted(["a.txt", "b.txt"])).toEqual(["a.txt"])
    })))

// ── one write, one verdict ─────────────────────────────────────────────
//
// The gate judges the set it is ABOUT to write, and then publishes what it
// wrote. Those used to be two questions to the codec about two equal sets, and
// for a codec whose validation builds a view of the whole corpus that is the
// corpus walked twice per write.
//
// It is one question now, and these four say what that rests on: the verdict is
// spent only on the very MAP it was reached about — same paths, same order,
// same values — and the bytes on disk are still what decides what that map
// holds.

test("a commit is judged once, and its own file decoded once", () =>
  withStore({ "a.txt": "alpha", "b.txt": "beta" }, ({ store }) =>
    Effect.gen(function*() {
      const before = yield* snapshotOf(store)
      decodes = []
      validations = []
      yield* store.commit({
        baseRev: before?.rev ?? 0,
        changes: [{ path: "a.txt", contents: "alpha, committed" }],
      })

      // The set the write would make, judged before anything was renamed —
      // and no second judgement of the identical set it did make.
      expect(validations).toEqual([["a.txt", "b.txt"]])
      // The re-read still happens: the file is opened, and its bytes are
      // compared with the ones this write promised. What is skipped is turning
      // those same bytes into a second value ({@link Probe.decode}).
      expect(decodes).toEqual(["a.txt"])
      expect((yield* snapshotOf(store))?.value.text["a.txt"]).toBe("alpha, committed")
    })))

test("a set that moved under the write is judged again", () =>
  withStore({ "a.txt": "alpha" }, ({ store, write }) =>
    Effect.gen(function*() {
      const before = yield* snapshotOf(store)
      validations = []
      // Somebody else — a `git pull`, another editor — puts a file down after
      // the gate's opening probe, so the tree the write is renamed into is not
      // the tree it was judged against. The candidate was built before this
      // landed; the probe after the rename finds it, so the verdict in hand is
      // about a set that is not the one on disk and cannot be published.
      whileDecoding = () => write("c.txt", "gamma")

      yield* store.commit({
        baseRev: before?.rev ?? 0,
        changes: [{ path: "a.txt", contents: "alpha, committed" }],
      })

      expect(validations).toEqual([["a.txt"], ["a.txt", "c.txt"]])
      expect((yield* snapshotOf(store))?.value.text).toEqual({
        "a.txt": "alpha, committed",
        "c.txt": "gamma",
      })
    })))

// The other way a write can leave the map it was judged about: the same paths
// in a different ORDER. A path that did not exist before is appended to the
// gate's candidate and comes back where the LISTING puts it, which for a file
// sorting first is not where the candidate had it. Same paths, same values,
// different map — so the verdict may not be spent, and what publishes is what
// the listing says. (This is the shape of the bug found on review: for olai's
// codec the map's order IS the published file order, which `list_outlines`
// answers with.)
test("a new path that sorts to the front is judged again, in the listing's order", () =>
  withStore({ "b.txt": "beta" }, ({ store }) =>
    Effect.gen(function*() {
      const before = yield* snapshotOf(store)
      validations = []
      yield* store.commit({
        baseRev: before?.rev ?? 0,
        changes: [{ path: "a.txt", contents: "alpha" }],
      })

      expect(validations).toEqual([["b.txt", "a.txt"], ["a.txt", "b.txt"]])
      // The published value is the second verdict's, so its own order is the
      // listing's — which for this codec is the order of the record it builds.
      expect(Object.keys((yield* snapshotOf(store))?.value.text ?? {}))
        .toEqual(["a.txt", "b.txt"])
    })))

// The promise is a promise: it is taken only where the bytes that come back are
// the ones it was made about. This is the window where that matters and the
// only one — between the gate's rename and the probe's read of what it renamed
// — so the test reaches into it, through the `match` the listing calls, and
// puts somebody else's bytes under the file this write has just promised.
test("bytes that are not the ones promised are decoded, and are what publishes", () =>
  withStore({ "a.txt": "alpha" }, ({ store, write }) =>
    Effect.gen(function*() {
      const before = yield* snapshotOf(store)
      decodes = []
      validations = []
      // Armed from inside the gate, so the listing it fires on is the one after
      // the rename rather than the one the gate opened with.
      whileDecoding = () => {
        whileListing = () => write("a.txt", "somebody else's")
      }

      yield* store.commit({
        baseRev: before?.rev ?? 0,
        changes: [{ path: "a.txt", contents: "alpha, committed" }],
      })

      // TWICE: the candidate's decode, and the read that found bytes the
      // promise was not about. The second one is the whole point — a probe that
      // took the promise on trust would have decoded once and published bytes
      // that are not on the disk.
      expect(decodes).toEqual(["a.txt", "a.txt"])
      // A different value for `a.txt` is a different map, so the verdict cannot
      // be spent and the codec is asked afresh.
      expect(validations.length).toBe(2)
      expect((yield* snapshotOf(store))?.value.text).toEqual({
        "a.txt": "somebody else's",
      })
    })))

// ── what the last verdict is worth ─────────────────────────────────────
//
// The store knows two things no codec can work out for itself: what it last
// published, and which paths have moved since. Handing both over is what lets a
// codec whose validation is a whole-corpus derivation patch that derivation
// instead ({@link Since}) — and the three tests here are the promise that makes
// possible, since a codec that trusted a wrong "what moved" would publish a
// view of a directory nobody has.

test("a validation is offered the last verdict, and what has moved since it", () =>
  withStore({ "a.txt": "alpha" }, ({ store, write }) =>
    Effect.gen(function*() {
      // The first load has nothing behind it, and says so rather than saying
      // "nothing changed" — which is what a caller would read an empty pair as.
      expect(offered).toEqual([undefined])
      const first = yield* snapshotOf(store)

      write("b.txt", "beta")
      yield* store.refresh("cheap")

      const since = offered.at(-1)
      // IDENTITY: the very value on the published snapshot, so a codec may
      // build on the indexes inside it rather than on something equal to them.
      expect(since?.value).toBe(first?.value as Loaded)
      expect(since?.changed).toEqual(["b.txt"])
      expect(since?.removed).toEqual([])
    })))

test("a commit is offered the published verdict and its own files", () =>
  withStore({ "a.txt": "alpha", "b.txt": "beta" }, ({ store }) =>
    Effect.gen(function*() {
      const before = yield* snapshotOf(store)
      offered = []

      yield* store.commit({
        baseRev: before?.rev ?? 0,
        changes: [{ path: "a.txt", contents: "alpha, committed" }],
      })

      // One validation, as the section above proves — and it is reached from
      // the revision this write named as its base, which is exactly the pairing
      // an incremental codec needs: this view, plus this file.
      expect(offered.length).toBe(1)
      expect(offered[0]?.value).toBe(before?.value as Loaded)
      expect(offered[0]?.changed).toEqual(["a.txt"])
    })))

test("what moved while a verdict was refused is still owed to the next one", () =>
  withStore({ "a.txt": "alpha" }, ({ store, write }) =>
    Effect.gen(function*() {
      const first = yield* snapshotOf(store)

      // Refused whole: the reference names a file the set does not hold. The
      // snapshot stays where it is, so `b.txt` has still not been accounted for
      // to anybody holding it.
      write("b.txt", "needs nowhere")
      yield* store.refresh("cheap")
      write("c.txt", "gamma")
      yield* store.refresh("cheap")

      const since = offered.at(-1)
      expect(since?.value).toBe(first?.value as Loaded)
      expect(since?.changed).toEqual(["b.txt", "c.txt"])
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

test("PIN (stage): an interrupted write discards temps, not only a failed one", () => {
  const src = fs.readFileSync(path.join(import.meta.dirname, "store.ts"), "utf8")
  const gate = src.slice(src.indexOf("Every file staged before any is renamed"))
  expect(gate).toContain("Effect.onExit(")
  expect(gate).toContain("Exit.isSuccess(exit)")
  expect(gate.indexOf("Effect.onError(")).toBe(-1)
})

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

// ── the vintage: no read without an age ────────────────────────────────
//
// The 2026-08-25 incident, in one paragraph, because every case below is a
// piece of it: a `git rebase` replaced the served files, the watcher missed
// it, and the running server answered every read normally with week-old truth
// for thirty minutes. Nothing was invalid, so nothing reached the errors
// channel — correctly. What no cell anywhere carried was HOW CURRENT the
// answer was, and the loop's own arrangement is why: a probe whose listing is
// identical to the last one publishes nothing, so a loop that has stopped
// looking and a loop that keeps looking and keeps agreeing are the same
// silence from outside.
//
// The fix is two facts and both are pinned below. A settled probe RECORDS that
// it agreed, which is what makes a stopped loop's age grow visibly; and a
// caller that needs more than the loop's word can ask for a look taken on its
// own fiber, outside the permit the loop holds, whose disagreement it cannot
// suppress.

test("every read carries an age, and a boot's is the look that just happened", () =>
  withStore({ "a.txt": "alpha" }, ({ store }) =>
    Effect.gen(function*() {
      const aged = yield* store.read("cheap")
      expect(aged.snapshot?.rev).toBe(1)
      // The boot probe published a moment ago, so the age is small — and it is
      // `Held`, because nobody has looked since. `Held` is not "fresh": it is
      // "on the loop's word, which was earned this long ago".
      expect(aged.vintage.proof).toEqual({ _tag: "Held" })
      expect(aged.vintage.age).toBeLessThan(5_000)
      expect(aged.vintage.at).toBeGreaterThan(0)
    })))

test("a directory that never loaded still has an age", () =>
  withStore({ "a.txt": "needs missing" }, ({ store }) =>
    Effect.gen(function*() {
      // The codec refuses this set, so there is no snapshot at all — and the
      // vintage is still there, which is the point: "how old is what you are
      // serving" has an answer even when the answer to "what are you serving"
      // is nothing.
      const aged = yield* store.read("cheap")
      expect(aged.snapshot).toBeNull()
      expect(aged.vintage.proof._tag).toBe("Held")
      expect(yield* errorsOf(store)).not.toBeNull()
    })))

// THE MECHANISM, pinned on its own: a probe that finds the same tree publishes
// nothing — and that is now distinguishable from a probe that never ran.
//
// Before the vintage this was one silence. `rev` stayed at 1 either way, the
// errors channel stayed null either way, and there was no third thing to read.
test("a settled probe publishes no revision and still proves the set", () =>
  withStore({ "a.txt": "alpha" }, ({ store }) =>
    Effect.gen(function*() {
      const before = yield* store.read("cheap")
      yield* Effect.sleep("40 millis")
      // The loop has not looked in that window, and the age says so. A LOWER
      // bound, never an upper one: sleeping longer only makes this truer, so
      // there is no duration here for a loaded runner to make flaky.
      const aging = yield* store.read("cheap")
      expect(aging.vintage.age).toBeGreaterThanOrEqual(30)

      decodes = []
      validations = []
      yield* store.refresh("cheap")

      // Nothing was published: no revision, no re-decode, no validation — the
      // settled-`null` short circuit, exactly as it was.
      const after = yield* store.read("cheap")
      expect(after.snapshot?.rev).toBe(before.snapshot?.rev)
      expect(decodes).toEqual([])
      expect(validations).toEqual([])
      // And the one thing that IS different: the loop looked and agreed, so
      // the age it had accumulated is gone.
      expect(after.vintage.age).toBeLessThan(aging.vintage.age)
      expect(after.vintage.at).toBeGreaterThan(before.vintage.at)
    })))

/**
 * THE INCIDENT'S OWN SHAPE — files replaced by a rename, no watcher event, no
 * probe — and the differential the debate asked for.
 *
 * WHAT WAS RED HERE. Before this change the only door to the set was a ref
 * holding the last good snapshot, so this test could assert exactly one thing:
 * the read answers `"alpha"`. Which it still does, deliberately — a last good
 * set under a banner beats a blank page, and that rule is not what was wrong.
 * What was wrong is that there was nothing else to assert. Every line below
 * about the vintage is a line that could not have been written, and the
 * thirty-minute diagnosis of 2026-08-25 is what "could not have been written"
 * cost.
 */
test("PIN (the rebase shape): the disk moves under a loop that is not looking", () =>
  withStore({ "a.txt": "alpha", "b.txt": "beta" }, ({ store, at, write }) =>
    Effect.gen(function*() {
      expect((yield* store.read("cheap")).snapshot?.value.text["a.txt"]).toBe("alpha")

      // A REPLACEMENT, not an edit: bytes staged beside the destination and
      // renamed over it, which is what `git rebase`, `git checkout` and this
      // package's own write gate all do. The watcher is off, so no event
      // reaches the loop, and nothing below asks it to probe.
      write(".incoming", "alpha, as the rebase left it")
      fs.renameSync(at(".incoming"), at("a.txt"))
      yield* Effect.sleep("40 millis")

      decodes = []
      validations = []
      matches = 0

      // THE CHEAP CLASS still answers the set it is serving — and its age is
      // now the whole story: nothing has proved this set since before the
      // rename, and the number grows for as long as that stays true.
      const cheap = yield* store.read("cheap")
      expect(cheap.snapshot?.value.text["a.txt"]).toBe("alpha")
      expect(cheap.vintage.proof).toEqual({ _tag: "Held" })
      expect(cheap.vintage.age).toBeGreaterThanOrEqual(30)
      // It cost nothing to say so: no walk, no stat, no read.
      expect(matches).toBe(0)

      // THE VERIFIED CLASS looks, on this fiber, and names the file.
      const checked = yield* store.read("verified")
      expect(checked.vintage.proof).toEqual({ _tag: "Diverged", paths: ["a.txt"] })
      // The set still comes back — the divergence is a fact ABOUT the answer,
      // not a refusal to give one — and it is still the old one, because this
      // door does not publish.
      expect(checked.snapshot?.value.text["a.txt"]).toBe("alpha")
      expect(checked.snapshot?.rev).toBe(cheap.snapshot?.rev)
      // Its age is the standing one, not zero: a look that DISAGREED proves
      // nothing about how current the answer is.
      expect(checked.vintage.age).toBeGreaterThanOrEqual(30)

      // WITHOUT THE CYCLE. No file was re-decoded, no set was validated, and
      // nothing reached the errors channel: the divergence was found by a walk
      // of the tree and a comparison, and the publish loop was not involved in
      // any part of it.
      expect(decodes).toEqual([])
      expect(validations).toEqual([])
      expect(yield* errorsOf(store)).toBeNull()

      // AND IT CONSUMED NOTHING. The stamp table is the loop's; a read that
      // quietly re-cached what it saw would have swallowed this change, and
      // the next look would have found a tree it had already been told about.
      yield* store.refresh("cheap")
      const published = yield* store.read("verified")
      expect(published.snapshot?.value.text["a.txt"]).toBe("alpha, as the rebase left it")
      expect(published.snapshot?.rev).toBe(2)
      expect(published.vintage.proof).toEqual({ _tag: "Confirmed" })
      expect(published.vintage.age).toBe(0)
    })))

test("a set the codec refused goes on ageing, because nothing proved it", () =>
  withStore({ "a.txt": "alpha" }, ({ store, write }) =>
    Effect.gen(function*() {
      const good = yield* store.read("cheap")
      expect(good.snapshot?.rev).toBe(1)

      // A set the codec will not take. The last good snapshot stays where it
      // is and the refusal is published beside it — and the AGE is the third
      // fact: this revision has not been the disk's truth since the write.
      write("a.txt", "needs missing")
      yield* store.refresh("cheap")
      expect(yield* errorsOf(store)).not.toBeNull()

      const refused = yield* store.read("verified")
      expect(refused.snapshot?.rev).toBe(1)
      // The look measures the disk against the stamps THIS revision was read
      // at — not against the probe's live table, which has already moved on to
      // the file it refused. Compared with the live table this would read
      // `Confirmed`, which is the fresh-looking lie by another road.
      expect(refused.vintage.proof).toEqual({ _tag: "Diverged", paths: ["a.txt"] })
    })))

test("a look that cannot be taken is an answer, not a failure", () =>
  withStore({ "a.txt": "alpha" }, ({ store, root }) =>
    Effect.gen(function*() {
      fs.rmSync(root, { recursive: true, force: true })
      const aged = yield* store.read("verified")
      // The store is still serving what it last loaded, and the vintage says
      // nobody could check it and why. No exception for a caller to re-word,
      // and no pretence that the set was confirmed.
      expect(aged.snapshot?.value.text["a.txt"]).toBe("alpha")
      expect(aged.vintage.proof._tag).toBe("Unchecked")
      expect(
        (aged.vintage.proof as { readonly why: string }).why,
      ).toContain("cannot read the served directory")
      // Recreated so the fixture's own teardown has something to remove, and
      // so the loop's next backstop does not race the assertions above.
      fs.mkdirSync(root, { recursive: true })
    })))

// ── what a class costs ─────────────────────────────────────────────────
//
// The whole reason the caller states a CLASS and not a means: the thing that
// asks sixty times a second must not pay for the thing an agent asks once.

test("PIN (cost): the cheap class walks nothing, however often it is asked", () =>
  withStore({ "a.txt": "alpha", "sub/b.txt": "beta" }, ({ store }) =>
    Effect.gen(function*() {
      matches = 0
      decodes = []
      validations = []
      for (let redraw = 0; redraw < 60; redraw++) yield* store.read("cheap")
      // Sixty reads, and not one entry of the tree looked at: no listing, no
      // stat, no open. A redraw asking how old its data is costs the redraw
      // nothing new, which is what makes an age on every read affordable.
      expect(matches).toBe(0)
      expect(decodes).toEqual([])
      expect(validations).toEqual([])

      // ONE verified read is ONE walk — the two files this fixture has, each
      // asked about once (the codec is asked about files, not the directory
      // between them) — and still no decode and no validation: it looks at
      // stamps, and re-reading a file is the loop's job.
      const walked = matches
      yield* store.read("verified")
      expect(matches - walked).toBe(2)
      expect(decodes).toEqual([])
      expect(validations).toEqual([])
    })))

// ── the red line, held by what is reachable ────────────────────────────

/**
 * THE VERIFICATION CANNOT TAKE THE PUBLISH FIBER'S PERMIT, and this is the
 * structural half of saying so — the behavioural half is the rebase-shape case
 * above, which finds a divergence with no cycle having run.
 *
 * `vintage.ts` is handed a disk, a `match` and a standing record. There is no
 * store in its scope, so there is no semaphore in its scope, and no future
 * edit to that file can quietly start waiting on the loop. The store's own
 * side is the read door, which is swept as a REGION rather than as a count:
 * three permits is what this file should have, and none of them may be inside
 * the answer to a read.
 *
 * Comments are stripped first, because these are claims about code — the
 * paragraph you are reading is allowed to say `withPermit`.
 */
test("PIN (sweep): the verification path cannot reach the loop's permit", () => {
  // The same stripper `packages/web/src/client/claims.test.ts` and
  // `@olai/tests`' `support/sweep.ts` carry, and duplicated for their reason: a
  // sweep that had to import across a package wall would be a dependency taken
  // on for a test.
  const codeOf = (file: string): string =>
    fs
      .readFileSync(path.join(import.meta.dirname, file), "utf8")
      .replace(/\/\*[\s\S]*?\*\/|(^|\s)\/\/[^\n]*/g, (_taken, lead) => lead ?? "")

  const vintage = codeOf("vintage.ts")
  for (const spelling of ["Semaphore", "withPermit", "gate"]) {
    expect(vintage).not.toContain(spelling)
  }

  const store = codeOf("store.ts")
  // Three, and they are the three publishing doors: the loop's cycle, the
  // verified look, and the write gate. A fourth is a new permit-taker and
  // wants reading.
  expect([...store.matchAll(/gate\.withPermit\(/g)].length).toBe(3)

  // …and the read door holds none of them. Sliced between two anchors this
  // file owns, so what is swept is the answer to a read and nothing else.
  const from = store.indexOf("const read = (freshness")
  const to = store.indexOf("const reads =")
  expect(from).toBeGreaterThan(-1)
  expect(to).toBeGreaterThan(from)
  const answering = store.slice(from, to)
  expect(answering).not.toContain("withPermit")
  expect(answering).not.toContain("gate")
})

/**
 * NO SUCCESSFUL READ WITHOUT A VINTAGE — the type-level half, which is the
 * only place it can be said.
 *
 * The debate's red line is not "callers should look at the age". It is that a
 * caller CANNOT obtain the set without being handed the age beside it, and
 * that is a claim about what compiles. The lines below are the whole of the
 * old surface: a naked ref of snapshots, and a second look-verb whose
 * difference from the first was stamp arithmetic in a doc comment. Both are
 * gone, and `@ts-expect-error` fails the build if either comes back — which is
 * also what rules out the other way this goes wrong, an `any` swallowing the
 * annotation and leaving the directive unused.
 *
 * EACH REFUSED LINE IS OTHERWISE VALID. A line that would fail for some second
 * reason proves nothing about the first, so the two calls below name arguments
 * their doors would take if they existed at all.
 *
 * Nothing here runs a store: what is under test is the FACE, and a value of
 * that type is all a face can be asked about. The array is what it is so the
 * compiler cannot dismiss any line as dead.
 */
test("PIN (type): there is no door to the set that does not carry its age", () => {
  const doors = (
    store: Store.Store<Loaded, ReadonlyArray<string>>,
    answer: Store.Aged<Loaded>,
  ) => [
    // The two doors there are, and both of them hand over the pair.
    store.read("cheap"),
    store.read("verified"),
    store.reads,
    answer.vintage.age,
    answer.vintage.proof._tag,
    answer.snapshot?.rev,
    // @ts-expect-error — the naked ref of snapshots is gone. It was the door a
    // consumer could take the set through while learning nothing about how old
    // it was, which is the whole of what went wrong on 2026-08-25.
    store.snapshot,
    // @ts-expect-error — and so is the second look-verb. `resync` differed from
    // `refresh` by mtime-and-size arithmetic a caller had to read a doc comment
    // to choose between; the class says what you need, and the store decides
    // what that costs.
    store.resync,
    // @ts-expect-error — a read that states no class does not compile. The
    // class is the one thing the caller owes, and defaulting it would make one
    // of the two the quiet answer to a question nobody was asked.
    store.read(),
    // @ts-expect-error — nor does a look that states none.
    store.refresh(),
    // @ts-expect-error — and the answer is not the set. The revision is inside
    // it, beside the age, and there is no shape of this that hands over one
    // without the other.
    answer.rev,
  ]
  expect(typeof doors).toBe("function")
})
