/**
 * Which doorbells this directory has on, across a restart.
 *
 * `memory.test.ts`'s shape one record over, and for its reasons: the three
 * things a small file has to get right are that it comes back, that it belongs
 * to ONE directory, and that every way it can fail says so rather than reading
 * as damage somebody has to go and find.
 *
 * What is different here, and what the cases below are mostly about:
 *
 *   - a corrupt file is an EMPTY MIRROR and never a throw. Nobody is standing
 *     at the screen when this is read, and a directory whose picks will not
 *     parse must still serve;
 *   - two writes in one process must BOTH land. `@olai/state` stages per
 *     process rather than per call, so without a permit the second write's
 *     rename finds nothing and reports a failure for a pick whose bytes never
 *     arrived;
 *   - the cap evicts the least recently touched, because the alternative — a
 *     prune against what an agent lists — deletes live scopes.
 *
 * `XDG_STATE_HOME` is pointed at a temp directory per test, which is also the
 * assertion that the variable is honoured at all.
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { Effect, Result } from "effect"
import { chmodSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { forDirectory, ROWS, type Scoped } from "./scopes.ts"

let state = ""
const was = process.env["XDG_STATE_HOME"]

beforeEach(() => {
  state = mkdtempSync(join(tmpdir(), "olai-scopes-"))
  process.env["XDG_STATE_HOME"] = state
})

afterEach(() => {
  if (was === undefined) delete process.env["XDG_STATE_HOME"]
  else process.env["XDG_STATE_HOME"] = was
  rmSync(state, { recursive: true, force: true })
})

/** Where a scope record lands — the SECOND kind under the state home, which is
 *  the whole of what `@olai/state`'s union gained. */
const home = (): string => join(state, "olai", "wake")

const files = (): ReadonlyArray<string> => {
  try {
    return readdirSync(home())
  } catch {
    return []
  }
}

/** The one file that has been written, by name. Throws when there is none,
 *  which is the honest failure for a test about to damage it. */
const only = (): string => {
  const [name, ...rest] = files()
  if (name === undefined || rest.length > 0) {
    throw new Error(`expected exactly one record in ${home()}, found ${files().length}`)
  }
  return join(home(), name)
}

const run = <A, E>(effect: Effect.Effect<A, E>): Promise<A> => Effect.runPromise(effect)
const outcome = <A, E>(effect: Effect.Effect<A, E>) => Effect.runPromise(Effect.result(effect))

const HERE = "/tmp/olai-doorbell-here"
const ELSEWHERE = "/tmp/olai-doorbell-elsewhere"

const AT = "2026-08-31T09:00:00.000Z"
const LATER = "2026-08-31T10:00:00.000Z"

const IN = { agent: "claude", session: "sess-1" }

/** Everything but the stamp, which is the cap's business and nobody else's. */
const said = (rows: ReadonlyArray<Scoped>) =>
  rows.map(({ agent, session, plugin, file }) => ({ agent, session, plugin, file }))

describe("a pick, across a restart", () => {
  test("a directory nobody has scoped has no doorbells", async () => {
    expect((await run(forDirectory(HERE))).rows()).toEqual([])
    // ... and nothing was written to find that out.
    expect(files()).toEqual([])
  })

  test("what was picked is what comes back", async () => {
    const scopes = await run(forDirectory(HERE))
    await run(scopes.set(IN, "kolu", "Fleet.olai", AT))
    // A SECOND store over the same directory: the point is the disk, not the
    // closure — the next boot is a different process.
    expect(said((await run(forDirectory(HERE))).rows())).toEqual([
      { agent: "claude", session: "sess-1", plugin: "kolu", file: "Fleet.olai" },
    ])
  })

  test("a second pick for the same doorbell replaces the first", async () => {
    const scopes = await run(forDirectory(HERE))
    await run(scopes.set(IN, "kolu", "Fleet.olai", AT))
    await run(scopes.set(IN, "kolu", "Other.olai", LATER))
    expect(said(scopes.rows())).toEqual([
      { agent: "claude", session: "sess-1", plugin: "kolu", file: "Other.olai" },
    ])
  })

  test("`null` clears it, and clearing is how a doorbell goes off", async () => {
    const scopes = await run(forDirectory(HERE))
    await run(scopes.set(IN, "kolu", "Fleet.olai", AT))
    await run(scopes.set(IN, "kolu", null, LATER))
    expect(scopes.rows()).toEqual([])
    expect((await run(forDirectory(HERE))).rows()).toEqual([])
  })

  test("two plugins in one conversation are two picks", async () => {
    const scopes = await run(forDirectory(HERE))
    await run(scopes.set(IN, "kolu", "Fleet.olai", AT))
    await run(scopes.set(IN, "odu", "Runs.olai", AT))
    // The triple's middle column is what makes a per-plugin door answerable at
    // all: clearing one must not clear the other.
    await run(scopes.set(IN, "kolu", null, LATER))
    expect(said(scopes.rows())).toEqual([
      { agent: "claude", session: "sess-1", plugin: "odu", file: "Runs.olai" },
    ])
  })

  test("the same session id under another agent is another conversation", async () => {
    const scopes = await run(forDirectory(HERE))
    await run(scopes.set({ agent: "claude", session: "sess-1" }, "kolu", "A.olai", AT))
    await run(scopes.set({ agent: "opencode", session: "sess-1" }, "kolu", "B.olai", AT))
    expect(said(scopes.rows())).toEqual([
      { agent: "claude", session: "sess-1", plugin: "kolu", file: "A.olai" },
      { agent: "opencode", session: "sess-1", plugin: "kolu", file: "B.olai" },
    ])
  })

  test("another directory's picks are not this one's", async () => {
    await run((await run(forDirectory(HERE))).set(IN, "kolu", "Fleet.olai", AT))
    expect((await run(forDirectory(ELSEWHERE))).rows()).toEqual([])
  })

  test("a trailing slash is the same directory, not a second one", async () => {
    await run((await run(forDirectory(HERE))).set(IN, "kolu", "Fleet.olai", AT))
    expect((await run(forDirectory(`${HERE}/`))).rows().length).toBe(1)
    expect(files().length).toBe(1)
  })

  test("nothing is written under the served directory", async () => {
    const served = mkdtempSync(join(tmpdir(), "olai-served-"))
    try {
      await run((await run(forDirectory(served))).set(IN, "kolu", "Fleet.olai", AT))
      // The served directory is somebody's outline set — the store probes it
      // and a commit would commit it. The picks go to the state home.
      expect(readdirSync(served)).toEqual([])
      expect(files().length).toBe(1)
    } finally {
      rmSync(served, { recursive: true, force: true })
    }
  })

  test("the record holds the picks and never a message", async () => {
    // The claim the whole design rests on, asserted on the BYTES: a held body
    // is a derivation of state that is still true, and whatever derived it
    // rings again. Nothing puts one here, and this is where that would show.
    const scopes = await run(forDirectory(HERE))
    await run(scopes.set(IN, "kolu", "Fleet.olai", AT))
    const written = JSON.parse(readFileSync(only(), "utf8")) as Record<string, unknown>
    expect(Object.keys(written).sort()).toEqual(["cwd", "scopes"])
  })
})

describe("two picks at once", () => {
  test("both land, rather than one racing the other's staging file", async () => {
    // `@olai/state` stages at `<file>.<pid>.tmp` — per PROCESS, not per call —
    // so two overlapping writes here share one staging path: without the
    // permit, one rename lands and the other fails ENOENT for a pick whose
    // bytes never arrived. Two tabs, or a double-click on the picker.
    const scopes = await run(forDirectory(HERE))
    const both = await Promise.all([
      outcome(scopes.set(IN, "kolu", "Fleet.olai", AT)),
      outcome(scopes.set(IN, "odu", "Runs.olai", AT)),
    ])
    expect(both.map((one) => one._tag)).toEqual(["Success", "Success"])
    expect(said((await run(forDirectory(HERE))).rows()).map((row) => row.plugin).sort())
      .toEqual(["kolu", "odu"])
  })
})

describe("the cap", () => {
  test("the least recently touched pick goes, and only it", async () => {
    // A COUNT and never a liveness question: an agent's session list is paged,
    // so membership is no proof of absence and a prune against it would delete
    // a live scope in silence.
    const scopes = await run(forDirectory(HERE))
    for (let n = 0; n <= ROWS; n++) {
      const stamp = `2026-08-31T${String(n).padStart(2, "0")}:00:00.000Z`
      await run(scopes.set({ agent: "claude", session: `sess-${n}` }, "kolu", "F.olai", stamp))
    }
    const kept = scopes.rows()
    expect(kept.length).toBe(ROWS)
    // The first one written is the one with the oldest stamp, and it is gone.
    expect(kept.some((row) => row.session === "sess-0")).toBe(false)
    expect(kept.some((row) => row.session === `sess-${ROWS}`)).toBe(true)
    // ... and the disk agrees, which is the half a restart reads.
    expect((await run(forDirectory(HERE))).rows().length).toBe(ROWS)
  })

  test("touching a pick again keeps it, whatever its position", async () => {
    const scopes = await run(forDirectory(HERE))
    await run(scopes.set({ agent: "claude", session: "old" }, "kolu", "F.olai", "2026-01-01T00:00:00.000Z"))
    for (let n = 0; n < ROWS; n++) {
      await run(scopes.set(
        { agent: "claude", session: `sess-${n}` },
        "kolu",
        "F.olai",
        `2026-08-31T${String(n).padStart(2, "0")}:00:00.000Z`,
      ))
    }
    // Re-picking moves the stamp, which is the whole of what "recently
    // touched" means here.
    await run(scopes.set({ agent: "claude", session: "old" }, "kolu", "G.olai", LATER))
    expect(scopes.rows().some((row) => row.session === "old")).toBe(true)
    expect(scopes.rows().length).toBe(ROWS)
  })
})

describe("a record that cannot be trusted", () => {
  const damage = (text: string): void => {
    writeFileSync(only(), text)
  }

  test("a file that is not JSON is an empty mirror and no throw", async () => {
    await run((await run(forDirectory(HERE))).set(IN, "kolu", "Fleet.olai", AT))
    damage("{ half a fi")
    const again = await outcome(forDirectory(HERE))
    expect(Result.isSuccess(again)).toBe(true)
    if (!Result.isSuccess(again)) return
    expect(again.success.rows()).toEqual([])
  })

  test("a damaged ROW is dropped and the rest still open their doorbells", async () => {
    // All-or-nothing here would turn every doorbell in the directory off over
    // one row, which is the louder failure and the wrong one.
    await run((await run(forDirectory(HERE))).set(IN, "kolu", "Fleet.olai", AT))
    damage(JSON.stringify({
      cwd: HERE,
      scopes: [
        { agent: "claude", session: "sess-1", plugin: "kolu", at: AT },
        { agent: "claude", session: "sess-2", plugin: "odu", file: "Runs.olai", at: AT },
        7,
      ],
    }))
    expect(said((await run(forDirectory(HERE))).rows())).toEqual([
      { agent: "claude", session: "sess-2", plugin: "odu", file: "Runs.olai" },
    ])
  })

  test("a record about another directory is not this one's picks", async () => {
    await run((await run(forDirectory(HERE))).set(IN, "kolu", "Fleet.olai", AT))
    damage(JSON.stringify({ cwd: ELSEWHERE, scopes: [{ ...IN, plugin: "kolu", file: "X.olai", at: AT }] }))
    expect((await run(forDirectory(HERE))).rows()).toEqual([])
  })

  test("a state directory that will not take a write refuses OUT LOUD", async () => {
    // The opposite discipline to the read above, and deliberately so: a person
    // just made this gesture, and a pick that did not stick is a thing they
    // need told. Root can write into a 0500 directory, so the assertion is
    // skipped there rather than inverted.
    if (typeof process.getuid === "function" && process.getuid() === 0) return
    const scopes = await run(forDirectory(HERE))
    chmodSync(state, 0o500)
    try {
      expect(Result.isFailure(await outcome(scopes.set(IN, "kolu", "Fleet.olai", AT)))).toBe(true)
    } finally {
      chmodSync(state, 0o700)
    }
  })
})
