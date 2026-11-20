import { NodeServices } from "@effect/platform-node"
import { expect, test } from "bun:test"
import { type Duration, Effect, Fiber, FileSystem, Latch, Result, SubscriptionRef } from "effect"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"

import type { Codec, Since } from "./codec.ts"
import { replaceBehindTheStamps } from "./stamps.testlib.ts"
import * as Store from "./store.ts"

interface Loaded {
  readonly text: Readonly<Record<string, string>>
  readonly broken: ReadonlyArray<string>
}

let decodes: Array<string> = []
let matches = 0
let validations: Array<ReadonlyArray<string>> = []
let offered: Array<Since<Loaded> | undefined> = []
let stops: Array<{
  readonly paths: ReadonlyArray<string>
  readonly standing: Loaded
}> = []
let whileDecoding: (() => void) | null = null
let whileListing: (() => void) | null = null

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
    const blamed = Object.entries(text).flatMap(([path, contents]) =>
      [...contents.matchAll(/^blame (\S+)$/gm)]
        .map((match) => `${match[1]}.txt: blamed by ${path}`)
    )
    const findings = [...dangling, ...blamed]

    return findings.length > 0
      ? Result.fail(findings)
      : Result.succeed({ text, broken })
  },

  stopping: ({ candidateOutcome, writtenPaths, standingValue }) => {
    stops.push({ paths: [...writtenPaths], standing: standingValue })
    return Result.isFailure(candidateOutcome) &&
        candidateOutcome.failure.some((row) =>
          writtenPaths.some((path) => row.startsWith(`${path}:`))
        )
      ? candidateOutcome.failure
      : null
  },

  unreadable: (failure) => [`the directory could not be read: ${failure.message}`],
}

interface Fixture {
  readonly store: Store.Store<Loaded, ReadonlyArray<string>>
  readonly root: string
  readonly write: (file: string, contents: string) => void
  readonly remove: (file: string) => void
  readonly read: (file: string) => string | null
  readonly listing: () => ReadonlyArray<string>
  readonly at: (file: string) => string
  readonly settled: (
    holds: (snapshot: Store.Snapshot<Loaded> | null) => boolean,
  ) => Effect.Effect<Store.Snapshot<Loaded> | null>
}

const withStore = <A>(
  files: Readonly<Record<string, string>>,
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
  stops = []
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

const snapshotOf = (store: Store.Store<Loaded, ReadonlyArray<string>>) =>
  Effect.map(store.read("cheap"), (aged) => aged.snapshot)

const errorsOf = (store: Store.Store<Loaded, ReadonlyArray<string>>) =>
  SubscriptionRef.get(store.errors)

const settledErrors = (store: Store.Store<Loaded, ReadonlyArray<string>>) =>
  until(
    SubscriptionRef.get(store.errors),
    (errors) => errors !== null,
    "nothing reached the errors channel",
  )

test("boot publishes the directory as revision 1, with nothing wrong", () =>
  withStore(
    { "a.txt": "alpha", "sub/b.txt": "beta", "ignored.md": "not ours" },
    ({ store }) =>
      Effect.gen(function*() {
        const snapshot = yield* snapshotOf(store)
        expect(snapshot?.rev).toBe(1)
        expect(snapshot?.value.text).toEqual({ "a.txt": "alpha", "sub/b.txt": "beta" })
        expect(yield* errorsOf(store)).toBeNull()
      }),
  ))

test("a directory that already holds an unreadable file still boots", () =>
  withStore({ "a.txt": "alpha", "b.txt": "!broken" }, ({ store }) =>
    Effect.gen(function*() {
      const snapshot = yield* snapshotOf(store)
      expect(snapshot?.rev).toBe(1)
      expect(snapshot?.value.broken).toEqual(["b.txt"])
      expect(yield* errorsOf(store)).toBeNull()
    })))

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

test("a probe that finds nothing changed publishes nothing", () =>
  withStore({ "a.txt": "alpha" }, ({ store }) =>
    Effect.gen(function*() {
      decodes = []
      yield* store.refresh("cheap")
      yield* store.refresh("cheap")
      expect(decodes).toEqual([])
      expect((yield* snapshotOf(store))?.rev).toBe(1)
    })))

test("an empty verified refresh validates and publishes; a cheap look stays quiet", () =>
  withStore({}, ({ store }) =>
    Effect.gen(function*() {
      validations = []
      yield* store.refresh("cheap")
      expect((yield* snapshotOf(store))?.rev).toBe(1)
      expect(validations).toEqual([])
      yield* store.refresh("verified")
      expect((yield* snapshotOf(store))?.rev).toBe(2)
      expect(validations).toEqual([[]])
      yield* store.refresh("cheap")
      expect((yield* snapshotOf(store))?.rev).toBe(2)
      expect(validations).toEqual([[]])
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
        expect(decodes).toEqual(["a.txt"])
      }),
  ))

test("a file that is not read still MOVES like every other file", () =>
  withStore({ "big.blob": "before" }, ({ store, write, settled }) =>
    Effect.gen(function*() {
      decodes = []
      write("big.blob", "after — a different length, so the stamp moved")
      yield* store.refresh("cheap")

      const snapshot = yield* settled((at) => at?.rev === 2)
      expect(snapshot?.changed).toEqual(["big.blob"])
      expect(decodes).toEqual([])
    })))

test("`body` reads one file's text on demand, and keeps nothing", () =>
  withStore({ "big.blob": "the whole saved page" }, ({ store }) =>
    Effect.gen(function*() {
      expect(yield* store.body("big.blob")).toBe("the whole saved page")
      expect(yield* store.body("big.blob")).toBe("the whole saved page")
      expect((yield* snapshotOf(store))?.value.text).toEqual({ "big.blob": NOT_READ })
    })))

test("a body request during a verified probe waits for its stamp table", () =>
  withStore({ "a.txt": "alpha", "big.blob": "the whole saved page" }, ({ store }) =>
    Effect.gen(function*() {
      let reading: Promise<string | null> | undefined
      whileListing = () => { reading = Effect.runPromise(store.body("big.blob")) }
      yield* store.refresh("verified")
      expect(reading).toBeDefined()
      expect(yield* Effect.promise(() => reading!)).toBe("the whole saved page")
    })))

test("`body` answers null for a file that is not there", () =>
  withStore({ "a.txt": "alpha" }, ({ store }) =>
    Effect.gen(function*() {
      expect(yield* store.body("gone.blob")).toBeNull()
    })))

test("`body` reads a file of the SET, and nothing else on the disk", () =>
  withStore(
    {
      "a.txt": "alpha",
      "big.blob": "the whole saved page",
      ".git/objects/secret.blob": "not part of any set",
      "README": "not ours",
    },
    ({ store, root }) =>
      Effect.gen(function*() {
        expect(yield* store.body("big.blob")).toBe("the whole saved page")
        expect(yield* store.body(".git/objects/secret.blob")).toBeNull()
        expect(yield* store.body("README")).toBeNull()
        fs.writeFileSync(path.join(root, "..", "olai-outside.blob"), "somebody else's")
        expect(yield* store.body("../olai-outside.blob")).toBeNull()
        fs.rmSync(path.join(root, "..", "olai-outside.blob"))
      }),
  ))

test("the walk does not enter dot-directories or node_modules", () =>
  withStore(
    {
      "a.txt": "alpha",
      ".git/objects/b.txt": "not yours",
      "node_modules/pkg/c.txt": "not yours either",
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

test("a file that is deleted leaves the set", () =>
  withStore({ "a.txt": "alpha", "b.txt": "beta" }, ({ store, remove }) =>
    Effect.gen(function*() {
      remove("b.txt")
      yield* store.refresh("cheap")
      const snapshot = yield* snapshotOf(store)
      expect(snapshot?.rev).toBe(2)
      expect(snapshot?.value.text).toEqual({ "a.txt": "alpha" })
    })))

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

test("a verified look after the last file left publishes the removal", () =>
  withStore({ "a.txt": "alpha" }, ({ store, remove }) =>
    Effect.gen(function*() {
      const before = yield* snapshotOf(store)
      expect(Object.keys(before?.value.text ?? {})).toEqual(["a.txt"])
      remove("a.txt")
      yield* store.refresh("verified")
      const after = yield* snapshotOf(store)
      expect(after?.rev).toBe((before?.rev ?? 0) + 1)
      expect(after?.value.text).toEqual({})
      expect(after?.removed).toEqual(["a.txt"])
    })))

test("a verified look names a departure beside a file that stayed", () =>
  withStore({ "a.txt": "alpha", "b.txt": "beta" }, ({ store, remove }) =>
    Effect.gen(function*() {
      remove("b.txt")
      yield* store.refresh("verified")
      const after = yield* snapshotOf(store)
      expect(Object.keys(after?.value.text ?? {})).toEqual(["a.txt"])
      expect(after?.removed).toEqual(["b.txt"])
    })))

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

test("a directory that stops being readable says so, over the last good tree", () =>
  withStore(
    { "a.txt": "alpha" },
    ({ root, store }) =>
      Effect.gen(function*() {
        expect((yield* snapshotOf(store))?.rev).toBe(1)

        fs.rmSync(root, { recursive: true, force: true })

        const errors = yield* settledErrors(store)
        expect(errors?.[0]).toContain("the directory could not be read")

        const snapshot = yield* snapshotOf(store)
        expect(snapshot?.rev).toBe(1)
        expect(snapshot?.value.text).toEqual({ "a.txt": "alpha" })
      }),
    { backstop: "20 millis" },
  ))

test("a directory that stays unreadable is said once, not on every probe", () =>
  withStore(
    { "a.txt": "alpha" },
    ({ root, store }) =>
      Effect.gen(function*() {
        fs.rmSync(root, { recursive: true, force: true })
        const first = yield* settledErrors(store)

        for (let probe = 0; probe < 5; probe++) yield* Effect.ignore(store.refresh("cheap"))
        yield* Effect.sleep("120 millis")

        expect(yield* errorsOf(store)).toBe(first)
      }),
    { backstop: "20 millis" },
  ))

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

test("a burst of writes lands as one update", () =>
  withStore(
    { "a.txt": "alpha" },
    ({ store, settled, write }) =>
      Effect.gen(function*() {
        for (let n = 1; n <= 6; n++) write(`f${n}.txt`, `file number ${n}`.repeat(n))
        const snapshot = yield* settled(
          (snapshot) => Object.keys(snapshot?.value.text ?? {}).length === 7,
        )
        expect(snapshot?.rev).toBeLessThanOrEqual(3)
      }),
    { watch: true },
  ))

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

test("PIN (what Confirmed is worth): the read's look is a stamp check, and says so", () =>
  withStore({ "a.txt": "alpha" }, ({ store, write, root }) =>
    Effect.gen(function*() {
      const file = path.join(root, "a.txt")
      const stamp = fs.statSync(file)
      write("a.txt", "ALPHA")
      fs.utimesSync(file, stamp.atime, stamp.mtime)

      const checked = yield* store.read("verified")
      expect(checked.vintage.proof).toEqual({ _tag: "Confirmed" })
      expect(checked.vintage.age).toBe(0)
      expect(checked.snapshot?.value.text["a.txt"]).toBe("alpha")

      yield* store.refresh("verified")
      expect((yield* snapshotOf(store))?.value.text["a.txt"]).toBe("ALPHA")
    })))

test("a write over bytes the stamps never saw change is refused, not landed", () =>
  withStore({ "a.txt": "alpha", "b.txt": "beta" }, ({ read, root, store }) =>
    Effect.gen(function*() {
      const before = yield* snapshotOf(store)
      replaceBehindTheStamps(root, "a.txt", "ALPHA")

      const outcome = yield* Effect.flip(store.commit({
        baseRev: before?.rev ?? 0,
        changes: [{ path: "a.txt", contents: "alpha, committed" }],
      }))
      expect(outcome._tag).toBe("StaleWrite")
      expect(read("a.txt")).toBe("ALPHA")
      const after = yield* snapshotOf(store)
      expect(after?.value.text["a.txt"]).toBe("ALPHA")
      expect(after?.rev).toBeGreaterThan(before?.rev ?? 0)
    })))

test("a removal commit unlinks the file, and the revision says `removed`", () =>
  withStore({ "a.txt": "alpha", "b.txt": "beta" }, ({ read, store }) =>
    Effect.gen(function*() {
      const before = yield* snapshotOf(store)
      const committed = yield* store.commit({
        baseRev: before?.rev ?? 0,
        changes: [{ path: "b.txt", contents: null }],
      })
      expect(Result.isSuccess(committed)).toBe(true)
      expect(read("b.txt")).toBeNull()
      expect(read("a.txt")).toBe("alpha")
      const after = yield* snapshotOf(store)
      expect(after?.rev).toBe((before?.rev ?? 0) + 1)
      expect(after?.removed).toEqual(["b.txt"])
      expect(after?.value.text["b.txt"]).toBeUndefined()
      const second = yield* Effect.flip(store.commit({
        baseRev: before?.rev ?? 0,
        changes: [{ path: "b.txt", contents: null }],
      }))
      expect(second._tag).toBe("StaleWrite")
      const askAgain = yield* store.commit({
        baseRev: after?.rev ?? 0,
        changes: [{ path: "b.txt", contents: null }],
      })
      expect(Result.isSuccess(askAgain)).toBe(true)
      const afterAgain = yield* snapshotOf(store)
      expect(afterAgain?.rev).toBe(after?.rev)
    })))

test("a set the codec would not publish for the removal is a refusal, not an unlink", () =>
  withStore({ "a.txt": "alpha", "b.txt": "beta" }, ({ read, store }) =>
    Effect.gen(function*() {
      const before = yield* snapshotOf(store)
      const committed = yield* store.commit({
        baseRev: before?.rev ?? 0,
        changes: [
          { path: "a.txt", contents: "alpha, still" },
          { path: "b.txt", contents: null },
        ],
      })
      expect(Result.isSuccess(committed)).toBe(true)
      expect(read("a.txt")).toBe("alpha, still")
      expect(read("b.txt")).toBeNull()
      const after = yield* snapshotOf(store)
      expect(after?.changed).toEqual(["a.txt"])
      expect(after?.removed).toEqual(["b.txt"])
    })))

test("the same write, asked again, lands ON the bytes it was refused over", () =>
  withStore({ "a.txt": "alpha" }, ({ read, root, store }) =>
    Effect.gen(function*() {
      const before = yield* snapshotOf(store)
      replaceBehindTheStamps(root, "a.txt", "ALPHA")
      yield* Effect.flip(store.commit({
        baseRev: before?.rev ?? 0,
        changes: [{ path: "a.txt", contents: "planned off the stale copy" }],
      }))

      const healed = yield* snapshotOf(store)
      expect(healed?.value.text["a.txt"]).toBe("ALPHA")
      const committed = yield* store.commit({
        baseRev: healed?.rev ?? 0,
        changes: [{ path: "a.txt", contents: "planned off the truth" }],
      })
      expect(Result.isSuccess(committed)).toBe(true)
      expect(read("a.txt")).toBe("planned off the truth")
    })))

test("a clean write pays the check and nothing else — no extra revision, no sweep", () =>
  withStore({ "a.txt": "alpha", "b.txt": "beta" }, ({ store }) =>
    Effect.gen(function*() {
      const before = yield* snapshotOf(store)
      decodes = []
      const committed = yield* store.commit({
        baseRev: before?.rev ?? 0,
        changes: [{ path: "a.txt", contents: "ALPHA" }],
      })
      expect(Result.isSuccess(committed)).toBe(true)
      const after = yield* snapshotOf(store)
      expect(after?.rev).toBe((before?.rev ?? 0) + 1)
      expect(decodes).toEqual(["a.txt"])
    })))

test("the gate forgets what it ASKED about — a drifted file the write does not touch is left", () =>
  withStore({ "a.txt": "alpha", "b.txt": "beta" }, ({ root, store }) =>
    Effect.gen(function*() {
      const before = yield* snapshotOf(store)
      replaceBehindTheStamps(root, "a.txt", "ALPHA")
      replaceBehindTheStamps(root, "b.txt", "BETA")

      yield* Effect.flip(store.commit({
        baseRev: before?.rev ?? 0,
        changes: [{ path: "a.txt", contents: "alpha, committed" }],
      }))
      const after = yield* snapshotOf(store)
      expect(after?.value.text["a.txt"]).toBe("ALPHA")
      expect(after?.value.text["b.txt"]).toBe("beta")
      expect(yield* store.drifted(["b.txt"])).toEqual(["b.txt"])
      yield* store.refresh("verified")
      expect((yield* snapshotOf(store))?.value.text["b.txt"]).toBe("BETA")
    })))

test("a file the disk still agrees with has not drifted", () =>
  withStore({ "a.txt": "alpha", "b.txt": "beta" }, ({ store }) =>
    Effect.gen(function*() {
      expect(yield* store.drifted(["a.txt", "b.txt"])).toEqual([])
    })))

test("a member that was rewritten to the same length IN THE STAMP'S OWN TRADE is drift", () =>
  withStore({ "a.txt": "alpha" }, ({ store, write, root }) =>
    Effect.gen(function*() {
      const file = path.join(root, "a.txt")
      const stamp = fs.statSync(file)
      write("a.txt", "ALPHA")
      fs.utimesSync(file, stamp.atime, stamp.mtime)

      expect(yield* store.drifted(["a.txt"])).toEqual(["a.txt"])
      yield* store.refresh("verified")
      expect(yield* store.drifted(["a.txt"])).toEqual([])
    })))

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

test("a path the set does not hold is skipped, not answered", () =>
  withStore({ "a.txt": "alpha" }, ({ store }) =>
    Effect.gen(function*() {
      expect(yield* store.drifted(["b.txt", "notes.md"])).toEqual([])
    })))

test("a file the codec answers by NAME is skipped — even when its bytes move", () =>
  withStore({ "a.blob": "one-" }, ({ store, write, root }) =>
    Effect.gen(function*() {
      const file = path.join(root, "a.blob")
      const stamp = fs.statSync(file)
      write("a.blob", "TWO!")
      fs.utimesSync(file, stamp.atime, stamp.mtime)

      expect(yield* store.drifted(["a.blob"])).toEqual([])
    })))

test("a member that vanished has drifted", () =>
  withStore({ "a.txt": "alpha", "b.txt": "beta" }, ({ store, remove }) =>
    Effect.gen(function*() {
      remove("a.txt")
      expect(yield* store.drifted(["a.txt", "b.txt"])).toEqual(["a.txt"])
    })))

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

      expect(validations).toEqual([["a.txt", "b.txt"]])
      expect(decodes).toEqual(["a.txt"])
      expect((yield* snapshotOf(store))?.value.text["a.txt"]).toBe("alpha, committed")
    })))

test("a set that moved under the write is judged again", () =>
  withStore({ "a.txt": "alpha" }, ({ store, write }) =>
    Effect.gen(function*() {
      const before = yield* snapshotOf(store)
      validations = []
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
      expect(Object.keys((yield* snapshotOf(store))?.value.text ?? {}))
        .toEqual(["a.txt", "b.txt"])
    })))

test("bytes that are not the ones promised are decoded, and are what publishes", () =>
  withStore({ "a.txt": "alpha" }, ({ store, write }) =>
    Effect.gen(function*() {
      const before = yield* snapshotOf(store)
      decodes = []
      validations = []
      whileDecoding = () => {
        whileListing = () => write("a.txt", "somebody else's")
      }

      yield* store.commit({
        baseRev: before?.rev ?? 0,
        changes: [{ path: "a.txt", contents: "alpha, committed" }],
      })

      expect(decodes).toEqual(["a.txt", "a.txt"])
      expect(validations.length).toBe(2)
      expect((yield* snapshotOf(store))?.value.text).toEqual({
        "a.txt": "somebody else's",
      })
    })))

test("a validation is offered the last verdict, and what has moved since it", () =>
  withStore({ "a.txt": "alpha" }, ({ store, write }) =>
    Effect.gen(function*() {
      expect(offered).toEqual([undefined])
      const first = yield* snapshotOf(store)

      write("b.txt", "beta")
      yield* store.refresh("cheap")

      const since = offered.at(-1)
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

      expect(offered.length).toBe(1)
      expect(offered[0]?.value).toBe(before?.value as Loaded)
      expect(offered[0]?.changed).toEqual(["a.txt"])
    })))

test("a commit's gate is asked over its own files and what was last published", () =>
  withStore({ "a.txt": "alpha", "b.txt": "beta" }, ({ store }) =>
    Effect.gen(function*() {
      const before = yield* snapshotOf(store)
      stops = []

      yield* store.commit({
        baseRev: before?.rev ?? 0,
        changes: [
          { path: "a.txt", contents: "alpha, committed" },
          { path: "c.txt", contents: "gamma" },
        ],
      })

      expect(stops.length).toBe(1)
      expect(stops[0]?.paths).toEqual(["a.txt", "c.txt"])
      expect(stops[0]?.standing).toBe(before?.value as Loaded)

      const after = yield* snapshotOf(store)
      expect(after?.value).not.toBe(before?.value as Loaded)
      stops = []
      yield* store.commit({
        baseRev: after?.rev ?? 0,
        changes: [{ path: "b.txt", contents: "beta, committed" }],
      })
      expect(stops[0]?.standing).toBe(after?.value as Loaded)
    })))

test("what moved while a verdict was refused is still owed to the next one", () =>
  withStore({ "a.txt": "alpha" }, ({ store, write }) =>
    Effect.gen(function*() {
      const first = yield* snapshotOf(store)

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
      write("a.txt", "alpha, from elsewhere")

      const failure = yield* Effect.flip(
        store.commit({
          baseRev: before?.rev ?? 0,
          changes: [{ path: "a.txt", contents: "alpha, from us" }],
        }),
      )
      expect(failure._tag).toBe("StaleWrite")
      expect(failure).toMatchObject({ baseRev: before?.rev, currentRev: 2 })
      expect(read("a.txt")).toBe("alpha, from elsewhere")

      const retried = yield* store.commit({
        baseRev: 2,
        changes: [{ path: "a.txt", contents: "alpha, from us" }],
      })
      expect(Result.isSuccess(retried)).toBe(true)
      expect(read("a.txt")).toBe("alpha, from us")
    })))

test("an interrupted write discards every temp it staged, not only a failed one", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "olai-store-"))
  fs.writeFileSync(path.join(root, "a.txt"), "alpha")
  fs.writeFileSync(path.join(root, "b.txt"), "beta")
  const temps = () => fs.readdirSync(root).filter((name) => name.endsWith(".tmp"))
  try {
    await Effect.gen(function*() {
      const real = yield* FileSystem.FileSystem
      const staging = yield* Latch.make(false)
      const wedged = yield* Latch.make(false)
      let written = 0
      const wedgedAtTheSecondTemp: FileSystem.FileSystem = {
        ...real,
        writeFileString: (file, contents, options) =>
          file.endsWith(".tmp") && ++written === 2
            ? Effect.andThen(
              staging.open,
              Effect.andThen(wedged.await, real.writeFileString(file, contents, options)),
            )
            : real.writeFileString(file, contents, options),
      }

      yield* Effect.gen(function*() {
        const store = yield* Store.make({
          root,
          codec,
          watch: false,
          settle: "20 millis",
        })
        const base = (yield* snapshotOf(store))?.rev ?? 0
        const writing = yield* Effect.forkChild(
          store.commit({
            baseRev: base,
            changes: [
              { path: "a.txt", contents: "alpha, interrupted" },
              { path: "b.txt", contents: "beta, interrupted" },
            ],
          }),
          { startImmediately: true },
        )

        yield* staging.await
        expect(temps().length).toBe(1)

        yield* Fiber.interrupt(writing)
        expect(temps()).toEqual([])
        expect(fs.readFileSync(path.join(root, "a.txt"), "utf8")).toBe("alpha")
        expect(fs.readFileSync(path.join(root, "b.txt"), "utf8")).toBe("beta")
      }).pipe(
        Effect.provideService(FileSystem.FileSystem, wedgedAtTheSecondTemp),
        Effect.scoped,
      )
    }).pipe(Effect.provide(NodeServices.layer), Effect.scoped, Effect.runPromise)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
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
      expect((yield* snapshotOf(store))?.rev).toBe(before?.rev)
      expect(yield* errorsOf(store)).toBeNull()
    })))

test("PIN (alreadyBroken): errors null refuses a write whose findings sit elsewhere; errors non-null lets a healthy write land", () =>
  withStore({ "a.txt": "alpha", "b.txt": "beta" }, ({ read, store, write }) =>
    Effect.gen(function*() {
      const before = yield* snapshotOf(store)
      expect(yield* errorsOf(store)).toBeNull()

      const fromHealthy = yield* store.commit({
        baseRev: before?.rev ?? 0,
        changes: [{ path: "a.txt", contents: "blame b" }],
      })
      expect(Result.isFailure(fromHealthy)).toBe(true)
      if (Result.isFailure(fromHealthy)) {
        expect(fromHealthy.failure).toEqual(["b.txt: blamed by a.txt"])
      }
      expect(read("a.txt")).toBe("alpha")
      expect(yield* errorsOf(store)).toBeNull()

      write("a.txt", "needs missing")
      yield* store.refresh("cheap")
      expect(yield* errorsOf(store)).not.toBeNull()
      const standing = yield* snapshotOf(store)
      expect(standing?.rev).toBe(before?.rev)
      expect(standing?.value.text).toEqual({ "a.txt": "alpha", "b.txt": "beta" })

      const healthy = yield* store.commit({
        baseRev: standing?.rev ?? 0,
        changes: [{ path: "b.txt", contents: "beta, still fine" }],
      })
      expect(Result.isSuccess(healthy)).toBe(true)
      expect(read("b.txt")).toBe("beta, still fine")
      expect((yield* snapshotOf(store))?.value.text["b.txt"]).toBe("beta")
      expect(yield* errorsOf(store)).not.toBeNull()
    })))

test("several files land together or not at all", () =>
  withStore({ "a.txt": "alpha", "b.txt": "beta" }, ({ read, store }) =>
    Effect.gen(function*() {
      const before = yield* snapshotOf(store)
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

test("two writers on one revision: one commits, the other retries", () =>
  withStore({ "a.txt": "alpha" }, ({ read, store }) =>
    Effect.gen(function*() {
      const base = (yield* snapshotOf(store))?.rev ?? 0
      const attempt = (mark: string) =>
        Effect.gen(function*() {
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

test("every read carries an age, and a boot's is the look that just happened", () =>
  withStore({ "a.txt": "alpha" }, ({ store }) =>
    Effect.gen(function*() {
      const aged = yield* store.read("cheap")
      expect(aged.snapshot?.rev).toBe(1)
      expect(aged.vintage.proof).toEqual({ _tag: "Held" })
      expect(aged.vintage.age).toBeLessThan(5_000)
      expect(aged.vintage.provedAt).toBeGreaterThan(0)
    })))

test("a directory that never loaded still has an age", () =>
  withStore({ "a.txt": "needs missing" }, ({ store }) =>
    Effect.gen(function*() {
      const aged = yield* store.read("cheap")
      expect(aged.snapshot).toBeNull()
      expect(aged.vintage.proof._tag).toBe("Held")
      expect(yield* errorsOf(store)).not.toBeNull()
    })))

test("a settled probe publishes no revision and still proves the set", () =>
  withStore({ "a.txt": "alpha" }, ({ store }) =>
    Effect.gen(function*() {
      const before = yield* store.read("cheap")
      yield* Effect.sleep("40 millis")
      const aging = yield* store.read("cheap")
      expect(aging.vintage.age).toBeGreaterThanOrEqual(30)

      decodes = []
      validations = []
      yield* store.refresh("cheap")

      const after = yield* store.read("cheap")
      expect(after.snapshot?.rev).toBe(before.snapshot?.rev)
      expect(decodes).toEqual([])
      expect(validations).toEqual([])
      expect(after.vintage.age).toBeLessThan(aging.vintage.age)
      expect(after.vintage.provedAt).toBeGreaterThan(before.vintage.provedAt)
    })))

test("PIN (the rebase shape): the disk moves under a loop that is not looking", () =>
  withStore({ "a.txt": "alpha", "b.txt": "beta" }, ({ store, at, write }) =>
    Effect.gen(function*() {
      expect((yield* store.read("cheap")).snapshot?.value.text["a.txt"]).toBe("alpha")

      write(".incoming", "alpha, as the rebase left it")
      fs.renameSync(at(".incoming"), at("a.txt"))
      yield* Effect.sleep("40 millis")

      decodes = []
      validations = []
      matches = 0

      const cheap = yield* store.read("cheap")
      expect(cheap.snapshot?.value.text["a.txt"]).toBe("alpha")
      expect(cheap.vintage.proof).toEqual({ _tag: "Held" })
      expect(cheap.vintage.age).toBeGreaterThanOrEqual(30)
      expect(matches).toBe(0)

      const checked = yield* store.read("verified")
      expect(checked.vintage.proof).toEqual({ _tag: "Diverged", paths: ["a.txt"] })
      expect(checked.snapshot?.value.text["a.txt"]).toBe("alpha")
      expect(checked.snapshot?.rev).toBe(cheap.snapshot?.rev)
      expect(checked.vintage.age).toBeGreaterThanOrEqual(30)

      expect(decodes).toEqual([])
      expect(validations).toEqual([])
      expect(yield* errorsOf(store)).toBeNull()

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

      write("a.txt", "needs missing")
      yield* store.refresh("cheap")
      expect(yield* errorsOf(store)).not.toBeNull()

      const refused = yield* store.read("verified")
      expect(refused.snapshot?.rev).toBe(1)
      expect(refused.vintage.proof).toEqual({ _tag: "Diverged", paths: ["a.txt"] })
    })))

test("a look that cannot be taken is an answer, not a failure", () =>
  withStore({ "a.txt": "alpha" }, ({ store, root }) =>
    Effect.gen(function*() {
      fs.rmSync(root, { recursive: true, force: true })
      const aged = yield* store.read("verified")
      expect(aged.snapshot?.value.text["a.txt"]).toBe("alpha")
      expect(aged.vintage.proof._tag).toBe("Unchecked")
      expect(
        (aged.vintage.proof as { readonly why: string }).why,
      ).toContain("cannot read the served directory")
      fs.mkdirSync(root, { recursive: true })
    })))

test("PIN (cost): the cheap class walks nothing, however often it is asked", () =>
  withStore({ "a.txt": "alpha", "sub/b.txt": "beta" }, ({ store }) =>
    Effect.gen(function*() {
      matches = 0
      decodes = []
      validations = []
      for (let redraw = 0; redraw < 60; redraw++) yield* store.read("cheap")
      expect(matches).toBe(0)
      expect(decodes).toEqual([])
      expect(validations).toEqual([])

      const walked = matches
      yield* store.read("verified")
      expect(matches - walked).toBe(2)
      expect(decodes).toEqual([])
      expect(validations).toEqual([])
    })))

test("PIN (sweep): the verification path cannot reach the loop's permit", () => {
  const codeOf = (file: string): string =>
    fs
      .readFileSync(path.join(import.meta.dirname, file), "utf8")
      .replace(/\/\*[\s\S]*?\*\/|(^|\s)\/\/[^\n]*/g, (_taken, lead) => lead ?? "")

  const vintage = codeOf("vintage.ts")
  for (const spelling of ["Semaphore", "withPermit", "gate"]) {
    expect(vintage).not.toContain(spelling)
  }

  const store = codeOf("store.ts")
  expect([...store.matchAll(/gate\.withPermit\(/g)].length).toBe(4)

  const from = store.indexOf("const read = (freshness")
  const to = store.indexOf("const reads =")
  expect(from).toBeGreaterThan(-1)
  expect(to).toBeGreaterThan(from)
  const answering = store.slice(from, to)
  expect(answering).not.toContain("withPermit")
  expect(answering).not.toContain("gate")
})

type Absent<T, K extends PropertyKey> = K extends keyof T ? false : true

type TakesAFreshnessClass<F extends (...args: never[]) => unknown> = [] extends Parameters<F>
  ? false
  : true

type Doors = Store.Store<Loaded, ReadonlyArray<string>>
type Answer = Store.Aged<Loaded>

test("PIN (type): there is no door to the set that does not carry its age", () => {
  const carried = (store: Doors, answer: Answer) => [
    store.read("cheap"),
    store.read("verified"),
    store.reads,
    answer.vintage.age,
    answer.vintage.proof._tag,
    answer.snapshot?.rev,
  ]

  const gone: [
    Absent<Doors, "snapshot">,
    Absent<Doors, "resync">,
    Absent<Answer, "rev">,
  ] = [true, true, true]

  const classed: [
    TakesAFreshnessClass<Doors["read"]>,
    TakesAFreshnessClass<Doors["refresh"]>,
  ] = [true, true]

  expect(typeof carried).toBe("function")
  expect([...gone, ...classed]).toEqual([true, true, true, true, true])
})
