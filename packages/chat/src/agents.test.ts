/**
 * WHICH CONVERSATION EACH NODE AGENT IS BOUND TO, across a restart.
 *
 * `scopes.test.ts`'s shape one record over, and mostly for its reasons — it
 * comes back, it belongs to ONE directory, and a file that will not read is an
 * empty mirror rather than a throw.
 *
 * What is different here is WHO WRITES IT. The picks are olai's; a binding is a
 * PERSON'S, typed into an editor with no schema in front of them, so the cases
 * below are heavier on leniency than on writing: a row missing a field is
 * dropped and the rest of the file stands, a `taught` that is not `true` is
 * untaught, and a `said` that is half there is a door with no line rather than
 * a record refused. And nothing here EVICTS: `scopes.ts` caps because olai
 * fills that table, and a cap over rows somebody authored would throw away a
 * binding they made.
 *
 * `XDG_STATE_HOME` is pointed at a temp directory per test, which is also the
 * assertion that the variable is honoured at all.
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { Effect, Result } from "effect"
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { mkdirSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { canonical, digestOf } from "@olai/state"

import { forDirectory } from "./agents.ts"

let state = ""
const was = process.env["XDG_STATE_HOME"]

beforeEach(() => {
  state = mkdtempSync(join(tmpdir(), "olai-agents-"))
  process.env["XDG_STATE_HOME"] = state
})

afterEach(() => {
  if (was === undefined) delete process.env["XDG_STATE_HOME"]
  else process.env["XDG_STATE_HOME"] = was
  rmSync(state, { recursive: true, force: true })
})

/** Where a binding record lands — the THIRD kind under the state home, which is
 *  the whole of what `@olai/state`'s union gained. */
const home = (): string => join(state, "olai", "agents")

const files = (): ReadonlyArray<string> => {
  try {
    return readdirSync(home())
  } catch {
    return []
  }
}

const run = <A, E>(effect: Effect.Effect<A, E>): Promise<A> => Effect.runPromise(effect)
const outcome = <A, E>(effect: Effect.Effect<A, E>) => Effect.runPromise(Effect.result(effect))

const HERE = "/tmp/olai-agents-here"
const ELSEWHERE = "/tmp/olai-agents-elsewhere"

const IN = { agent: "claude", session: "sess-1" }

/** A binding file, WRITTEN BY HAND — which is the only way one is written in
 *  this phase, so every case starts the way a person's directory does. */
const handWritten = (cwd: string, bound: unknown): void => {
  mkdirSync(home(), { recursive: true, mode: 0o700 })
  const at = join(home(), `${digestOf(canonical(cwd))}.json`)
  writeFileSync(at, `${JSON.stringify({ cwd: canonical(cwd), bound })}\n`)
}

const written = (cwd: string): Record<string, unknown> => {
  const at = join(home(), `${digestOf(canonical(cwd))}.json`)
  return JSON.parse(readFileSync(at, "utf8")) as Record<string, unknown>
}

describe("what a hand-written record says", () => {
  test("a directory nobody has bound has no node agents talking through anything", async () => {
    const bindings = await run(forDirectory(HERE))
    expect(bindings.rows()).toEqual([])
    expect(bindings.at(IN)).toBeUndefined()
    // ... and nothing was written to find that out.
    expect(files()).toEqual([])
  })

  test("a binding names the node a conversation belongs to", async () => {
    handWritten(HERE, [{ node: "spaces", agent: "claude", session: "sess-1" }])
    const bindings = await run(forDirectory(HERE))
    expect(bindings.at(IN)?.node).toBe("spaces")
  })

  test("the PAIR is the key: a session id means nothing to the wrong agent", async () => {
    handWritten(HERE, [{ node: "spaces", agent: "claude", session: "sess-1" }])
    const bindings = await run(forDirectory(HERE))
    expect(bindings.at({ agent: "opencode", session: "sess-1" })).toBeUndefined()
  })

  test("a record about ANOTHER directory is not this one's", async () => {
    handWritten(ELSEWHERE, [{ node: "spaces", agent: "claude", session: "sess-1" }])
    expect((await run(forDirectory(ELSEWHERE))).rows()).toHaveLength(1)
    expect((await run(forDirectory(HERE))).rows()).toEqual([])
  })
})

describe("what it does with a file somebody typed", () => {
  test("a row missing a name is dropped, and the rest of the file stands", async () => {
    handWritten(HERE, [
      { agent: "claude", session: "sess-0" },
      { node: "spaces", agent: "claude", session: "sess-1" },
      { node: "odu", session: "sess-2" },
      "not a row at all",
    ])
    expect((await run(forDirectory(HERE))).rows().map((row) => row.node)).toEqual(["spaces"])
  })

  test("a file that will not read is an EMPTY MIRROR, never a refusal to serve", async () => {
    mkdirSync(home(), { recursive: true, mode: 0o700 })
    writeFileSync(join(home(), `${digestOf(canonical(HERE))}.json`), "{ not json")
    expect((await run(forDirectory(HERE))).rows()).toEqual([])
  })

  test("`taught` is only `true`; anything else is a session that has not been told", async () => {
    handWritten(HERE, [
      { node: "spaces", agent: "claude", session: "sess-1", taught: "yes" },
    ])
    expect((await run(forDirectory(HERE))).at(IN)?.taught).toBeUndefined()
  })

  test("a half-written `said` is a door with no line, not a record refused", async () => {
    handWritten(HERE, [
      { node: "spaces", agent: "claude", session: "sess-1", said: { text: "hello" } },
    ])
    const row = (await run(forDirectory(HERE))).at(IN)
    expect(row?.node).toBe("spaces")
    expect(row?.said).toBeUndefined()
  })
})

describe("what olai writes back", () => {
  test("teaching is remembered, and remembered across a restart", async () => {
    handWritten(HERE, [{ node: "spaces", agent: "claude", session: "sess-1" }])
    const bindings = await run(forDirectory(HERE))
    await run(bindings.teach(IN))
    expect(bindings.at(IN)?.taught).toBe(true)
    // A SECOND store over the same directory: the point is the disk, since the
    // next boot is a different process and must not teach the session again.
    expect((await run(forDirectory(HERE))).at(IN)?.taught).toBe(true)
  })

  test("teaching a session already taught writes nothing at all", async () => {
    handWritten(HERE, [{ node: "spaces", agent: "claude", session: "sess-1", taught: true }])
    const bindings = await run(forDirectory(HERE))
    // The hand-written file has no other key on the row; a write would have
    // added olai's own spelling of it. Nothing moved, so nothing was written.
    await run(bindings.teach(IN))
    expect(written(HERE)["bound"]).toEqual([
      { node: "spaces", agent: "claude", session: "sess-1", taught: true },
    ])
  })

  test("a conversation NO node claims is taught nothing and writes nothing", async () => {
    handWritten(HERE, [{ node: "spaces", agent: "claude", session: "sess-1" }])
    const bindings = await run(forDirectory(HERE))
    await run(bindings.teach({ agent: "claude", session: "somebody-else" }))
    expect(bindings.rows()).toEqual([
      { node: "spaces", agent: "claude", session: "sess-1" },
    ])
  })

  test("the last line an agent said is written down, and comes back", async () => {
    handWritten(HERE, [{ node: "spaces", agent: "claude", session: "sess-1" }])
    const bindings = await run(forDirectory(HERE))
    const said = { text: "the mirror lane is in flight", at: "2026-09-01T16:41:00Z" }
    await run(bindings.said(IN, said))
    expect((await run(forDirectory(HERE))).at(IN)?.said).toEqual(said)
  })

  test("the same line twice is one write — an agent repeating itself costs the disk once", async () => {
    handWritten(HERE, [{ node: "spaces", agent: "claude", session: "sess-1" }])
    const bindings = await run(forDirectory(HERE))
    const said = { text: "still working", at: "2026-09-01T16:41:00Z" }
    await run(bindings.said(IN, said))
    const after = written(HERE)
    await run(bindings.said(IN, said))
    expect(written(HERE)).toEqual(after)
  })

  test("two writes in one process both land — the permit, and the record after", async () => {
    handWritten(HERE, [
      { node: "spaces", agent: "claude", session: "sess-1" },
      { node: "odu", agent: "claude", session: "sess-2" },
    ])
    const bindings = await run(forDirectory(HERE))
    const other = { agent: "claude", session: "sess-2" }
    const both = await Promise.all([
      outcome(bindings.teach(IN)),
      outcome(bindings.said(other, { text: "ci is green", at: "2026-09-01T17:00:00Z" })),
    ])
    expect(both.every(Result.isSuccess)).toBe(true)
    const back = (await run(forDirectory(HERE))).rows()
    expect(back.find((row) => row.node === "spaces")?.taught).toBe(true)
    expect(back.find((row) => row.node === "odu")?.said?.text).toBe("ci is green")
  })

  test("a bookkeeping write leaves the person's rows where they stood", async () => {
    handWritten(HERE, [
      { node: "spaces", agent: "claude", session: "sess-1" },
      { node: "odu", agent: "claude", session: "sess-2" },
    ])
    const bindings = await run(forDirectory(HERE))
    await run(bindings.teach(IN))
    // No touch order here, unlike the doorbells: this is somebody's file and a
    // write of olai's must not reorder it.
    expect(bindings.rows().map((row) => row.node)).toEqual(["spaces", "odu"])
  })
})
