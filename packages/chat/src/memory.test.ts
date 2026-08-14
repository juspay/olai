/**
 * What the panel remembers about which conversation is its own.
 *
 * The bug this is the test for: a restart adopted the newest session in the
 * served directory, so anything that touched a session more recently than you
 * did — a terminal `claude`, a `/clear` sibling, a stale timestamp — took the
 * panel over. Remembering costs one small file, and the three things a small
 * file has to get right are here: it comes back, it belongs to ONE directory,
 * and every way it can fail says so rather than reading as "nothing was
 * remembered".
 *
 * `XDG_STATE_HOME` is pointed at a temp directory per test, which is also the
 * assertion that the variable is honoured at all: a memory written to the
 * developer's own `~/.local/state` while these run would pass every line below
 * and pollute their machine.
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { chmodSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { forDirectory, nothing } from "./memory.ts"

let state = ""
const was = process.env["XDG_STATE_HOME"]

beforeEach(() => {
  state = mkdtempSync(join(tmpdir(), "olai-memory-"))
  process.env["XDG_STATE_HOME"] = state
})

afterEach(() => {
  if (was === undefined) delete process.env["XDG_STATE_HOME"]
  else process.env["XDG_STATE_HOME"] = was
  rmSync(state, { recursive: true, force: true })
})

/** The one file the directory below is remembered in, whatever it is called. */
const files = (): ReadonlyArray<string> => {
  const home = join(state, "olai", "chat")
  try {
    return readdirSync(home)
  } catch {
    return []
  }
}

const HERE = "/tmp/olai-somewhere"
const ELSEWHERE = "/tmp/olai-somewhere-else"

describe("the panel's own conversation, across a restart", () => {
  test("a directory that has never been served remembers nothing", async () => {
    const memory = forDirectory(HERE)
    expect(await Effect.runPromise(memory.recall)).toBe(null)
  })

  test("what was entered is what comes back", async () => {
    await Effect.runPromise(forDirectory(HERE).remember("session-a"))
    // A SECOND memory over the same directory: the point is the disk, not the
    // closure — the next boot is a different process.
    expect(await Effect.runPromise(forDirectory(HERE).recall)).toBe("session-a")
  })

  test("the last conversation entered is the one remembered", async () => {
    const memory = forDirectory(HERE)
    await Effect.runPromise(memory.remember("session-a"))
    await Effect.runPromise(memory.remember("session-b"))
    expect(await Effect.runPromise(forDirectory(HERE).recall)).toBe("session-b")
  })

  test("a trailing slash is the same directory, not a second one", async () => {
    await Effect.runPromise(forDirectory(HERE).remember("session-a"))
    expect(await Effect.runPromise(forDirectory(`${HERE}/`).recall)).toBe("session-a")
    // ... and one file rather than two, which is the fact behind it.
    expect(files().length).toBe(1)
  })

  test("another directory's panel is not this one's", async () => {
    await Effect.runPromise(forDirectory(HERE).remember("session-a"))
    expect(await Effect.runPromise(forDirectory(ELSEWHERE).recall)).toBe(null)
  })

  test("nothing is written under the served directory", async () => {
    const served = mkdtempSync(join(tmpdir(), "olai-served-"))
    try {
      await Effect.runPromise(forDirectory(served).remember("session-a"))
      // The served directory is somebody's outline set — the store probes it
      // and a commit would commit it. The memory goes to the state home.
      expect(readdirSync(served)).toEqual([])
      expect(files().length).toBe(1)
    } finally {
      rmSync(served, { recursive: true, force: true })
    }
  })
})

describe("a memory that cannot be trusted", () => {
  /** Whatever the one file is called, with something else in it. */
  const damage = (text: string): void => {
    const home = join(state, "olai", "chat")
    const [name] = readdirSync(home)
    writeFileSync(join(home, name ?? "none.json"), text)
  }

  test("a file that is not JSON is a reason, not a shrug", async () => {
    await Effect.runPromise(forDirectory(HERE).remember("session-a"))
    damage("{ half a fi")
    const outcome = await Effect.runPromise(Effect.result(forDirectory(HERE).recall))
    expect(outcome._tag).toBe("Failure")
    // The path, because that is the thing somebody can go and look at.
    if (outcome._tag === "Failure") expect(outcome.failure.why).toContain(state)
  })

  test("JSON that names no conversation is a reason too", async () => {
    await Effect.runPromise(forDirectory(HERE).remember("session-a"))
    damage(`{"cwd":"${HERE}"}`)
    const outcome = await Effect.runPromise(Effect.result(forDirectory(HERE).recall))
    expect(outcome._tag).toBe("Failure")
  })

  test("a state directory that will not take a write refuses out loud", async () => {
    // Refusing is the whole point: the panel goes on working, and a person is
    // told their conversation will not come back. Root can write into a 0500
    // directory, so the assertion is skipped there rather than inverted.
    if (typeof process.getuid === "function" && process.getuid() === 0) return
    chmodSync(state, 0o500)
    try {
      const outcome = await Effect.runPromise(
        Effect.result(forDirectory(HERE).remember("session-a")),
      )
      expect(outcome._tag).toBe("Failure")
    } finally {
      chmodSync(state, 0o700)
    }
  })
})

describe("a memory that keeps nothing", () => {
  test("recalls nothing and writes nothing", async () => {
    await Effect.runPromise(nothing.remember("session-a"))
    expect(await Effect.runPromise(nothing.recall)).toBe(null)
    expect(files()).toEqual([])
  })
})
