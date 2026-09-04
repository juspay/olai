/**
 * Core's local-state door: the last snapshot handed over is the one that lands,
 * a missing file is a fresh map, and an unreadable file is a warn.
 */

import { expect, test } from "bun:test"
import { Effect } from "effect"
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { canonical, digestOf, fileForLocal, stateHome, writeLocal } from "@olai/state"

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

const waitFor = async (pred: () => boolean): Promise<void> => {
  for (let i = 0; i < 80; i++) {
    if (pred()) return
    await Bun.sleep(10)
  }
  throw new Error("local state: timed out waiting for the last snapshot")
}

test("missing local state is null, not a warning", () =>
  withHome(async ({ served }) => {
    const warnings: Array<string> = []
    const local = localStateFor("example", served, (line) => warnings.push(line))
    expect(local.load()).toBeNull()
    expect(warnings).toEqual([])
  }))

test("unreadable local state warns and answers null", () =>
  withHome(async ({ served }) => {
    const warnings: Array<string> = []
    const local = localStateFor("example", served, (line) => warnings.push(line))
    local.save({ queue: ["ok"] })
    const at = fileForLocal("example", canonical(served))
    await waitFor(() => existsSync(at))
    writeFileSync(at, "{ not json")
    const restarted = localStateFor("example", served, (line) => warnings.push(line))
    expect(restarted.load()).toBeNull()
    expect(warnings.some((line) => line.includes("could not be read"))).toBe(true)
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
    local.save({ n: 1, queue: ["A"] })
    local.save({ n: 2, queue: ["B"] })
    local.save({ n: 3, queue: [] })
    await waitFor(() => order.length === 3)
    expect(order).toEqual([1, 2, 3])
    expect(local.load()?.["n"]).toBe(3)
    expect(local.load()?.["queue"]).toEqual([])
  }))

test("the generic hold is read once and migrated on the first write", () =>
  withHome(async ({ served }) => {
    const cwd = canonical(served)
    const old = join(stateHome(), "hold", `${digestOf(cwd)}.example.json`)
    await Effect.runPromise(writeLocal(old, { cwd, queue: ["A"] }))
    const warnings: Array<string> = []
    const local = localStateFor("example", served, (line) => warnings.push(line))
    expect(local.load()?.["queue"]).toEqual(["A"])
    local.save({ queue: [] })
    await waitFor(() => warnings.some((line) => line.includes("migrated machine-local state")))
    expect(localStateFor("example", served, () => {}).load()?.["queue"]).toEqual([])
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
    expect(local.load()).toEqual({
      cwd,
      memory: { agent: "claude", session: "s1" },
      wake: { scopes: [{ plugin: "kolu" }] },
      heard: { heard: [{ session: "s1" }] },
    })
    local.save({
      memory: { agent: "claude", session: "s2" },
      wake: { scopes: [{ plugin: "kolu" }] },
      heard: { heard: [{ session: "s1" }] },
    })
    await waitFor(() => {
      const memory = localStateFor("chat", served, () => {}).load()?.["memory"]
      return (memory as { readonly session?: unknown } | undefined)?.session === "s2"
    })
    expect(localStateFor("chat", served, () => {}).load()?.["memory"]).toEqual({
      agent: "claude",
      session: "s2",
    })
  }))
