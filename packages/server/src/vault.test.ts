import { expect, test } from "bun:test"
import { mountBundle, offered, provide, reportBundle, setRow, settled } from "@olai/bundle/bundle"
import { definePlugin, Directory, Kinds, Offers, openPlugins, Vault, mountPlugin, rowReport } from "@olai/plugin-api/services"
import { NO_KINDS } from "@olai/format"
import { NO_DIRECTORY, make as makeOps, type Store } from "@olai/ops"
import { Effect, Result } from "effect"
import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { profileRows } from "./profiles.ts"
import { vaultModule, VaultSettings } from "./vault.ts"

const flip = (host: Parameters<typeof setRow>[0], id: string, on: boolean) =>
  Effect.andThen(setRow(host, id, on), settled(host, ["vault", "observer"]))

const opening = (root: string) => Effect.gen(function*() {
  const plugins = yield* openPlugins({ vars: {}, now: () => "", served: root })
  yield* mountBundle(plugins.host, [], [], {
    rows: profileRows("test-minimal"),
    resolve: async (name) => name === "olai:vault" ? vaultModule : undefined,
  })
  const store = () => (offered(plugins.host, Directory)?.store as Store | undefined)
  const ops = makeOps({ root, store })
  yield* provide(plugins.host, VaultSettings, () => ({ root, kinds: NO_KINDS, idle: ops.idle }))
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
  const first = store()
  expect(first).toBeDefined()
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
