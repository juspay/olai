import { runtimePaths } from "./runtime-paths.ts"
import { expect, test } from "bun:test"
import { configsOf, mountBundle, offered, provide, reportBundle, setRow, settled } from "@olai/bundle/bundle"
import { definePlugin, Directory, Ops as OpsDoor, openPlugins, Vault, mountPlugin, rowReport } from "@olai/plugin-api/services"
import { NO_KINDS } from "@olai/format"
import { NO_DIRECTORY, NO_LEDGER, NO_SEARCH, liveOps, type Ledger, type Ops, type Store } from "@olai/ops"
import { Deferred, Effect, Fiber, Result, Stream } from "effect"
import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { profileRows } from "./profiles.ts"
import { VaultSettings } from "@olai/plugin-api/services"

const flip = (host: Parameters<typeof setRow>[0], id: string, on: boolean) =>
  Effect.andThen(setRow(host, id, on), settled(host, ["vault", "observer"]))

const opening = (root: string, options: { readonly format?: string; readonly ledger?: Ledger } = {}) => Effect.gen(function*() {
  const plugins = yield* openPlugins({ vars: {}, now: () => "" })
  yield* mountBundle(plugins.host, { kind: "exact", names: ["vault"] }, options.format === undefined ? [] : [{ id: "vault", config: { format: options.format } }], {
    rows: profileRows("test-minimal"),
    resolve: async () => undefined,
  })
  const store = () => (offered(plugins.host, Directory)?.store as Store | undefined)
  const ops = liveOps(() => offered(plugins.host, OpsDoor)?.gate as Ops | undefined)
  yield* provide(plugins.host, VaultSettings, () => ({ root, runtime: runtimePaths, kinds: NO_KINDS, ledger: options.ledger ?? NO_LEDGER, search: NO_SEARCH }))
  yield* settled(plugins.host, ["vault"])
  return { plugins, store, ops }
})

const rootWithNote = () => {
  const root = mkdtempSync(join(tmpdir(), "olai-vault-row-"))
  writeFileSync(join(root, "a.olai"), '{"id":"a","ord":"a0","title":"first"}\n')
  return root
}

test("minimal profile has one active row; its offers and listeners leave and return", () => Effect.runPromise(Effect.scoped(Effect.gen(function*() {
  const root = rootWithNote()
  const { plugins, store, ops } = yield* opening(root)
  const firstGate = offered(plugins.host, OpsDoor)?.gate as Ops
  const first = store()
  expect(first).toBeDefined()
  expect(configsOf(plugins.host).get("vault")).toEqual({ format: "olai" })
  const report = yield* reportBundle(plugins.host, ["vault", "ws", "mcp", "web-app"])
  expect([...report].filter(([, row]) => row.state === "running").map(([name]) => name)).toEqual(["vault"])
  let revisions = 0
  let releases = 0
  yield* mountPlugin(plugins.host, definePlugin({
    name: "observer", needs: [Vault], apply: Effect.gen(function*() {
      yield* (yield* Vault).revision(() => Effect.sync(() => { revisions++ }))
      yield* Effect.addFinalizer(() => Effect.sync(() => { releases++ }))
    }),
  }))
  expect(revisions).toBeGreaterThan(0)
  for (let i = 0; i < 2; i++) {
    yield* flip(plugins.host, "vault", false)
    expect(store()).toBeUndefined()
    expect(offered(plugins.host, OpsDoor)).toBeUndefined()
    expect(yield* Effect.result(firstGate.run({ op: "title", id: "a", title: "retired" }, "web"))).toEqual(Result.fail(NO_DIRECTORY))
    expect(offered(plugins.host, Vault)).toBeUndefined()
    expect((yield* rowReport(plugins.host, ["observer"])).get("observer")?.state).toBe("waiting")
    expect((yield* Effect.result(ops.run({ op: "title", id: "a", title: "no" }, "web")))._tag).toBe("Failure")
    expect((yield* Effect.result(ops.read))).toEqual(Result.fail(NO_DIRECTORY))
    const before = revisions
    writeFileSync(join(root, "a.olai"), `{"id":"a","ord":"a0","title":"activation ${i}"}\n`)
    // A second provider can now take the released lock, and releases it again.
    yield* Effect.scoped(opening(root))
    expect(revisions).toBe(before)
    yield* flip(plugins.host, "vault", true)
    expect(store()).not.toBe(first)
    expect(offered(plugins.host, OpsDoor)?.gate).not.toBe(firstGate)
    expect((yield* rowReport(plugins.host, ["observer"])).get("observer")?.state).toBe("running")
    expect(revisions).toBeGreaterThan(before)
    expect(JSON.stringify(yield* ops.read)).toContain(`activation ${i}`)
  }
  expect(releases).toBe(2)
}))))

test("lock conflict is a failed row and can recover after the owner releases it", () => Effect.runPromise(Effect.scoped(Effect.gen(function*() {
  const root = rootWithNote()
  const owner = yield* opening(root)
  const contender = yield* opening(root)
  const row = (yield* reportBundle(contender.plugins.host, ["vault"])).get("vault")
  expect(row?.state).toBe("failed")
  expect(row?.state === "failed" ? row.fault : undefined).toContain("another olai is serving this directory")
  expect(contender.store()).toBeUndefined()
  yield* flip(owner.plugins.host, "vault", false)
  yield* flip(contender.plugins.host, "vault", false)
  yield* flip(contender.plugins.host, "vault", true)
  expect(contender.store()).toBeDefined()
}))))

test("a non-directory root fails only its vault row", () => Effect.runPromise(Effect.scoped(Effect.gen(function*() {
  const root = rootWithNote()
  const { plugins, store } = yield* opening(join(root, "a.olai"))
  const row = (yield* reportBundle(plugins.host, ["vault"])).get("vault")
  expect(row?.state).toBe("failed")
  expect(row?.state === "failed" ? row.fault : undefined).toContain("is not a directory")
  expect(store()).toBeUndefined()
}))))

test("an unsupported format fails the row before it acquires a directory or gate", () => Effect.runPromise(Effect.scoped(Effect.gen(function*() {
  const root = rootWithNote()
  const invalid = yield* opening(root, { format: "org" })
  const row = (yield* reportBundle(invalid.plugins.host, ["vault"])).get("vault")
  expect(row?.state).toBe("failed")
  expect(row?.state === "failed" ? row.fault : undefined).toContain("olai")
  expect(invalid.store()).toBeUndefined()
  expect(offered(invalid.plugins.host, OpsDoor)).toBeUndefined()
  // A supported row can still acquire the same directory: schema refusal did
  // not claim its lock, even briefly, or leave a store behind.
  const valid = yield* opening(root)
  expect(valid.store()).toBeDefined()
}))))

test("vault teardown drains an accepted write before releasing the directory lock", () => Effect.runPromise(Effect.scoped(Effect.gen(function*() {
  const root = rootWithNote()
  const writing = yield* Deferred.make<void>()
  const finish = yield* Deferred.make<void>()
  const ledger: Ledger = {
    ...NO_LEDGER,
    whyWaiting: () => Effect.gen(function*() {
      yield* Deferred.succeed(writing, undefined)
      yield* Deferred.await(finish)
      return "recording is off"
    }),
  }
  const { plugins, ops } = yield* opening(root, { ledger })
  const write = yield* Effect.forkScoped(ops.run({ op: "title", id: "a", title: "accepted" }, "web"))
  yield* Deferred.await(writing)
  const stopped = yield* Deferred.make<void>()
  const stop = yield* Effect.forkScoped(Effect.andThen(flip(plugins.host, "vault", false), Deferred.succeed(stopped, undefined)))
  yield* plugins.changes.pipe(
    Stream.filter(() => offered(plugins.host, OpsDoor) === undefined),
    Stream.take(1), Stream.runDrain,
  )
  expect(yield* Deferred.isDone(stopped)).toBe(false)
  expect(yield* Effect.result(ops.run({ op: "title", id: "a", title: "too late" }, "web"))).toEqual(Result.fail(NO_DIRECTORY))
  // The lock is still held while the accepted operation completes.
  const contender = yield* opening(root)
  expect(contender.store()).toBeUndefined()
  yield* Deferred.succeed(finish, undefined)
  yield* Fiber.join(write)
  yield* Fiber.join(stop)
  yield* flip(contender.plugins.host, "vault", false)
  yield* flip(contender.plugins.host, "vault", true)
  expect(JSON.stringify(yield* contender.ops.read)).toContain("accepted")
}))))
