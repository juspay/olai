/**
 * Core's held door: the last snapshot handed over is the one that lands,
 * a missing file is a fresh map, and an unreadable file is a warn.
 */

import { expect, test } from "bun:test"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { canonical, fileForHold } from "@olai/state"

import { heldFor } from "./held.ts"

const withHome = async (
  use: (dirs: { readonly served: string; readonly home: string }) => Promise<void>,
): Promise<void> => {
  const served = mkdtempSync(join(tmpdir(), "olai-held-served-"))
  const home = mkdtempSync(join(tmpdir(), "olai-held-home-"))
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
  throw new Error("held: timed out waiting for the last snapshot")
}

test("a missing hold is null, not a warning", () =>
  withHome(async ({ served }) => {
    const warnings: Array<string> = []
    const held = heldFor("example", served, (line) => warnings.push(line))
    expect(held.load()).toBeNull()
    expect(warnings).toEqual([])
  }))

test("an unreadable hold warns and answers null", () =>
  withHome(async ({ served }) => {
    const warnings: Array<string> = []
    const held = heldFor("example", served, (line) => warnings.push(line))
    held.save({ queue: ["ok"] })
    await waitFor(() => held.load() !== null)
    writeFileSync(fileForHold("example", canonical(served)), "{ not json")
    expect(held.load()).toBeNull()
    expect(warnings.some((line) => line.includes("could not be read"))).toBe(true)
  }))

test("successive saves land in order: the last snapshot is the one that stays", () =>
  withHome(async ({ served }) => {
    const held = heldFor("example", served, () => {})
    held.save({ n: 1, queue: ["A"] })
    held.save({ n: 2, queue: ["B"] })
    held.save({ n: 3, queue: [] })
    await waitFor(() => held.load()?.["n"] === 3)
    expect(held.load()?.["queue"]).toEqual([])
  }))
