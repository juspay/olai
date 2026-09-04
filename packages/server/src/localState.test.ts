/**
 * Core's local-state door: the last snapshot handed over is the one that lands,
 * a missing file is a fresh map, and an unreadable file is a warn.
 */

import { expect, test } from "bun:test"
import { Effect, Result } from "effect"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { canonical, digestOf, fileForLocal, stateHome, StateFailure, writeLocal } from "@olai/state"
import { definePlugin, LocalState, mountPlugin, openPlugins } from "@olai/plugin-api/services"

import { localStateFor } from "./localState.ts"

const withHome = async (
  use: (dirs: { readonly served: string; readonly home: string }) => Promise<void>,
): Promise<void> => {
  const served = mkdtempSync(join(tmpdir(), "olai-local-served-"))
  const home = mkdtempSync(join(tmpdir(), "olai-local-home-"))
  const before = process.env["XDG_STATE_HOME"]
  process.env["XDG_STATE_HOME"] = home
  try {
    await use({ served, home })
  } finally {
    if (before === undefined) delete process.env["XDG_STATE_HOME"]
    else process.env["XDG_STATE_HOME"] = before
    for (const at of [served, home]) rmSync(at, { recursive: true, force: true })
  }
}

const run = <A, E>(effect: Effect.Effect<A, E>): Promise<A> => Effect.runPromise(effect)

test("missing local state is null, not a warning", () =>
  withHome(async ({ served }) => {
    const warnings: Array<string> = []
    const local = localStateFor("example", served, (line) => warnings.push(line))
    expect(await run(local.load)).toBeNull()
    expect(warnings).toEqual([])
  }))

test("unreadable local state warns and answers null", () =>
  withHome(async ({ served }) => {
    const warnings: Array<string> = []
    const local = localStateFor("example", served, (line) => warnings.push(line))
    await run(local.save({ queue: ["ok"] }))
    const at = fileForLocal("example", canonical(served))
    writeFileSync(at, "{ not json")
    const restarted = localStateFor("example", served, (line) => warnings.push(line))
    expect(await run(restarted.load)).toBeNull()
    expect(warnings.some((line) => line.includes("not readable JSON"))).toBe(true)
  }))

test("successive saves land in order: the last snapshot is the one that stays", () =>
  withHome(async ({ served }) => {
    // The first snapshot is SLOW to rename. Without the chain it would finish
    // last and overwrite 2 and 3 — which is the round-3 race. With the chain
    // the slow write still goes first, then 2, then 3, and 3 is what stays.
    const order: Array<number> = []
    const local = localStateFor("example", served, () => {}, (at, value) =>
      Effect.gen(function* () {
        const n = value["n"]
        if (n === 1) yield* Effect.sleep("40 millis")
        if (typeof n === "number") order.push(n)
        yield* writeLocal(at, value)
      }))
    await Promise.all([
      run(local.save({ n: 1, queue: ["A"] })),
      run(local.save({ n: 2, queue: ["B"] })),
      run(local.save({ n: 3, queue: [] })),
    ])
    expect(order).toEqual([1, 2, 3])
    expect((await run(local.load))?.["n"]).toBe(3)
    expect((await run(local.load))?.["queue"]).toEqual([])
  }))

test("save settles with the write and preserves the last landed snapshot on failure", () =>
  withHome(async ({ served }) => {
    const warnings: Array<string> = []
    let writes = 0
    const local = localStateFor(
      "example",
      served,
      (line) => warnings.push(line),
      () => {
        writes += 1
        return Effect.fail(new StateFailure({ why: "the state home is read-only" }))
      },
    )
    const answer = await Effect.runPromise(Effect.result(local.save({ queue: ["A"] })))
    expect(Result.isFailure(answer)).toBe(true)
    if (Result.isFailure(answer)) expect((answer.failure as { why?: unknown }).why).toBe(
      "the state home is read-only",
    )
    expect(writes).toBe(1)
    expect(await run(local.load)).toBeNull()
    expect(warnings.some((line) => line.includes("the state home is read-only"))).toBe(true)
  }))

test("a flip reads the same door, and a restart reads the same record from disk", () =>
  withHome(async ({ served }) => {
    await run(Effect.scoped(Effect.gen(function*() {
      const plugins = yield* openPlugins({
        vars: {},
        now: () => "2026-09-04T12:00:00Z",
        served,
        localStateFor: (plugin) => localStateFor(plugin, served, () => {}),
      })
      let activation = 0
      const seen: Array<Record<string, unknown> | null> = []
      const plugin = definePlugin({
        name: "example",
        needs: [LocalState],
        apply: Effect.gen(function*() {
          const local = yield* LocalState
          activation += 1
          if (activation === 1) {
            yield* Effect.orDie(local.save({ queue: ["A"] }))
          } else {
            seen.push(yield* local.load)
          }
        }),
      })

      const first = yield* mountPlugin(plugins.host, plugin)
      yield* first.dispose
      const at = fileForLocal("example", canonical(served))
      const persisted = readFileSync(at, "utf8")
      rmSync(at)

      const second = yield* mountPlugin(plugins.host, plugin)
      yield* second.dispose
      expect(seen).toEqual([{ cwd: canonical(served), queue: ["A"] }])

      writeFileSync(at, persisted)
      expect(yield* localStateFor("example", served, () => {}).load).toEqual(seen[0] ?? null)
    })))
  }))

test("the generic hold is read once and migrated on the first write", () =>
  withHome(async ({ served }) => {
    const cwd = canonical(served)
    const old = join(stateHome(), "hold", `${digestOf(cwd)}.example.json`)
    await Effect.runPromise(writeLocal(old, { cwd, queue: ["A"] }))
    const warnings: Array<string> = []
    const local = localStateFor("example", served, (line) => warnings.push(line))
    expect((await run(local.load))?.["queue"]).toEqual(["A"])
    await run(local.save({ queue: [] }))
    expect(warnings.some((line) => line.includes("migrated machine-local state"))).toBe(true)
    expect((await run(localStateFor("example", served, () => {}).load))?.["queue"]).toEqual([])
  }))

test("xyne-spaces migrates its pre-plugin mirror record", () =>
  withHome(async ({ served }) => {
    const cwd = canonical(served)
    const old = join(stateHome(), "mirror", `${digestOf(cwd)}.json`)
    await Effect.runPromise(writeLocal(old, {
      cwd,
      channel: "team",
      lastLane: "general",
      threads: [],
      queue: [{ op: "post", lane: "general", kind: "note", text: "queued" }],
    }))
    const warnings: Array<string> = []
    const local = localStateFor("xyne-spaces", served, (line) => warnings.push(line))
    const migrated = await run(local.load)
    expect(migrated?.["queue"]).toEqual([
      { op: "post", lane: "general", kind: "note", text: "queued" },
    ])
    await run(local.save(migrated ?? {}))
    expect(warnings.some((line) => line.includes(old))).toBe(true)
    expect((await run(localStateFor("xyne-spaces", served, () => {}).load))?.["queue"]).toEqual([
      { op: "post", lane: "general", kind: "note", text: "queued" },
    ])
  }))

test("chat's three old files become three sections of one local-state document", () =>
  withHome(async ({ served }) => {
    const cwd = canonical(served)
    const digest = digestOf(cwd)
    const memory = join(stateHome(), "chat", `${digest}.json`)
    const wake = join(stateHome(), "wake", `${digest}.json`)
    const heard = join(stateHome(), "heard", `${digest}.json`)
    await Effect.runPromise(writeLocal(memory, { cwd, agent: "claude", session: "s1" }))
    await Effect.runPromise(writeLocal(wake, { cwd, scopes: [{ plugin: "kolu" }] }))
    await Effect.runPromise(writeLocal(heard, { cwd, heard: [{ session: "s1" }] }))

    const local = localStateFor("chat", served, () => {})
    expect(await run(local.load)).toEqual({
      cwd,
      memory: { agent: "claude", session: "s1" },
      wake: { scopes: [{ plugin: "kolu" }] },
      heard: { heard: [{ session: "s1" }] },
    })
    await run(local.save({
      memory: { agent: "claude", session: "s2" },
      wake: { scopes: [{ plugin: "kolu" }] },
      heard: { heard: [{ session: "s1" }] },
    }))
    expect((await run(localStateFor("chat", served, () => {}).load))?.["memory"]).toEqual({
      agent: "claude",
      session: "s2",
    })
  }))
