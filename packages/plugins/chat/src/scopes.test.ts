/**
 * Which doorbells this directory has on, across a restart.
 *
 * `memory.test.ts`'s shape one record over, and for its reasons: the three
 * things a small pick has to get right are that it comes back, that it belongs
 * to ONE directory, and that every way it can fail says so rather than reading
 * as damage somebody has to go and find.
 *
 * What is different here, and what the cases below are mostly about:
 *
 *   - a corrupt pick is an EMPTY MIRROR and never a throw. Nobody is standing
 *     at the screen when this is read, and a directory whose picks will not
 *     parse must still serve;
 *   - two writes in one process must BOTH land. The section is a
 *     read-modify-write state machine, so without its permit two picks can
 *     derive from the same old rows and one disappears;
 *   - the cap evicts the least recently touched, because the alternative — a
 *     prune against what an agent lists — deletes live scopes. "Least recently
 *     touched" is the FRONT OF THE ARRAY and nothing else: every write
 *     re-appends, and a JSON array comes back in the order it went out, so the
 *     cases below assert the eviction against the write order rather than
 *     against a stamp.
 *
 * `XDG_STATE_HOME` is pointed at a temp directory per test, which is also the
 * assertion that the variable is honoured at all.
 */

import { beforeEach, describe, expect, test } from "bun:test"
import { Effect } from "effect"

import { type LocalHarness, localHarness } from "./local.testlib.ts"
import { forLocalState, ROWS } from "./scopes.ts"

/** Every plugin can be told, which is the ordinary serve — the arm where one
 *  cannot is `a tenant this serve did not compose` below. */
const TELLABLE = (): boolean => true

let local: LocalHarness

beforeEach(() => {
  local = localHarness()
})

const forDirectory = (cwd: string) => forLocalState(local.forDirectory(cwd))
const files = (): ReadonlyArray<string> => local.writes(HERE) === 0 ? [] : ["record"]

const run = <A, E>(effect: Effect.Effect<A, E>): Promise<A> => Effect.runPromise(effect)
const outcome = <A, E>(effect: Effect.Effect<A, E>) => Effect.runPromise(Effect.result(effect))

const HERE = "/tmp/olai-doorbell-here"
const ELSEWHERE = "/tmp/olai-doorbell-elsewhere"

const IN = { agent: "claude", session: "sess-1" }

describe("a pick, across a restart", () => {
  test("a directory nobody has scoped has no doorbells", async () => {
    expect((await run(forDirectory(HERE))).rows()).toEqual([])
    // ... and nothing was written to find that out.
    expect(files()).toEqual([])
  })

  test("what was picked is what comes back", async () => {
    const scopes = await run(forDirectory(HERE))
    await run(scopes.set(IN, "kolu", "Fleet.olai"))
    // A SECOND store over the same directory: the point is the disk, not the
    // closure — the next boot is a different process.
    expect((await run(forDirectory(HERE))).rows()).toEqual([
      { agent: "claude", session: "sess-1", plugin: "kolu", pick: "Fleet.olai" },
    ])
  })

  test("a second pick for the same doorbell replaces the first", async () => {
    const scopes = await run(forDirectory(HERE))
    await run(scopes.set(IN, "kolu", "Fleet.olai"))
    await run(scopes.set(IN, "kolu", "Other.olai"))
    expect(scopes.rows()).toEqual([
      { agent: "claude", session: "sess-1", plugin: "kolu", pick: "Other.olai" },
    ])
  })

  test("`null` clears it, and clearing is how a doorbell goes off", async () => {
    const scopes = await run(forDirectory(HERE))
    await run(scopes.set(IN, "kolu", "Fleet.olai"))
    await run(scopes.set(IN, "kolu", null))
    expect(scopes.rows()).toEqual([])
    expect((await run(forDirectory(HERE))).rows()).toEqual([])
  })

  test("two plugins in one conversation are two picks", async () => {
    const scopes = await run(forDirectory(HERE))
    await run(scopes.set(IN, "kolu", "Fleet.olai"))
    await run(scopes.set(IN, "odu", "Runs.olai"))
    // The triple's middle column is what makes a per-plugin door answerable at
    // all: clearing one must not clear the other.
    await run(scopes.set(IN, "kolu", null))
    expect(scopes.rows()).toEqual([
      { agent: "claude", session: "sess-1", plugin: "odu", pick: "Runs.olai" },
    ])
  })

  test("the same session id under another agent is another conversation", async () => {
    const scopes = await run(forDirectory(HERE))
    await run(scopes.set({ agent: "claude", session: "sess-1" }, "kolu", "A.olai"))
    await run(scopes.set({ agent: "opencode", session: "sess-1" }, "kolu", "B.olai"))
    expect(scopes.rows()).toEqual([
      { agent: "claude", session: "sess-1", plugin: "kolu", pick: "A.olai" },
      { agent: "opencode", session: "sess-1", plugin: "kolu", pick: "B.olai" },
    ])
  })

  test("another directory's picks are not this one's", async () => {
    await run((await run(forDirectory(HERE))).set(IN, "kolu", "Fleet.olai"))
    expect((await run(forDirectory(ELSEWHERE))).rows()).toEqual([])
  })

  test("a trailing slash is the same directory, not a second one", async () => {
    await run((await run(forDirectory(HERE))).set(IN, "kolu", "Fleet.olai"))
    expect((await run(forDirectory(`${HERE}/`))).rows().length).toBe(1)
    expect(files().length).toBe(1)
  })

  test("the section holds the picks and never a message", async () => {
    // The claim the whole design rests on, asserted on the BYTES: a held body
    // is a derivation of state that is still true, and whatever derived it
    // rings again. Nothing puts one here, and this is where that would show.
    const scopes = await run(forDirectory(HERE))
    await run(scopes.set(IN, "kolu", "Fleet.olai"))
    const written = local.read(HERE, "wake") ?? {}
    expect(Object.keys(written)).toEqual(["scopes"])
  })
})

describe("two picks at once", () => {
  test("both land, rather than one racing the other's staging file", async () => {
    // Two overlapping read-modify-writes must not both derive from the same
    // old section. Two tabs, or a double-click on the picker.
    const scopes = await run(forDirectory(HERE))
    const both = await Promise.all([
      outcome(scopes.set(IN, "kolu", "Fleet.olai")),
      outcome(scopes.set(IN, "odu", "Runs.olai")),
    ])
    expect(both.map((one) => one._tag)).toEqual(["Success", "Success"])
    expect((await run(forDirectory(HERE))).rows().map((row) => row.plugin).sort())
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
      await run(scopes.set({ agent: "claude", session: `sess-${n}` }, "kolu", "F.olai"))
    }
    const kept = scopes.rows()
    expect(kept.length).toBe(ROWS)
    // The first one written is the one at the front of the array, and it is
    // gone. Nothing here says WHEN — the write order is the touch order.
    expect(kept.some((row) => row.session === "sess-0")).toBe(false)
    expect(kept.some((row) => row.session === `sess-${ROWS}`)).toBe(true)
    // ... and the disk agrees, which is the half a restart reads.
    expect((await run(forDirectory(HERE))).rows().length).toBe(ROWS)
  })

  test("touching a pick again keeps it, whatever its position", async () => {
    const scopes = await run(forDirectory(HERE))
    await run(scopes.set({ agent: "claude", session: "old" }, "kolu", "F.olai"))
    // Fill the table exactly, so `old` is at the front of a full array and is
    // the next thing the cap would take.
    for (let n = 0; n < ROWS - 1; n++) {
      await run(scopes.set({ agent: "claude", session: `sess-${n}` }, "kolu", "F.olai"))
    }
    // Re-picking moves the row to the BACK of the array, which is the whole of
    // what "recently touched" means here — no stamp moves, the position does.
    await run(scopes.set({ agent: "claude", session: "old" }, "kolu", "G.olai"))
    // ... so the next pick evicts, and what it takes is the row `old` was in
    // front of rather than `old`.
    await run(scopes.set({ agent: "claude", session: "fresh" }, "kolu", "H.olai"))
    expect(scopes.rows().some((row) => row.session === "old")).toBe(true)
    expect(scopes.rows().some((row) => row.session === "sess-0")).toBe(false)
    expect(scopes.rows().length).toBe(ROWS)
  })
})

describe("a section that cannot be trusted", () => {
  test("a damaged ROW is dropped and the rest still open their doorbells", async () => {
    // All-or-nothing here would turn every doorbell in the directory off over
    // one row, which is the louder failure and the wrong one.
    local.write(HERE, "wake", {
      scopes: [
        { agent: "claude", session: "sess-1", plugin: "kolu" },
        { agent: "claude", session: "sess-2", plugin: "odu", pick: "Runs.olai" },
        7,
      ],
    })
    expect((await run(forDirectory(HERE))).rows()).toEqual([
      { agent: "claude", session: "sess-2", plugin: "odu", pick: "Runs.olai" },
    ])
  })
})

describe("what a write says it removed", () => {
  test("a write answers with the rows it removed, so a caller can take their doorbells back", async () => {
    const scopes = await run(forDirectory(HERE))
    // A fresh pick removes nothing.
    expect(await run(scopes.set(IN, "kolu", "Fleet.olai"))).toEqual([])
    // Re-pointing removes the row it replaced — the caller holds bodies derived
    // from the OLD pick and has to hear that it is gone.
    const moved = await run(scopes.set(IN, "kolu", "Other.olai"))
    expect(moved.map((row) => row.pick)).toEqual(["Fleet.olai"])
    // ... and so does a clear.
    const cleared = await run(scopes.set(IN, "kolu", null))
    expect(cleared.map((row) => row.pick)).toEqual(["Other.olai"])
  })

  test("an EVICTED row is reported too, which is the one nobody made a gesture about", async () => {
    const scopes = await run(forDirectory(HERE))
    // Fill the table, oldest first — which is just write order — so the cap has
    // an unambiguous victim.
    for (let n = 0; n < ROWS; n++) {
      await run(scopes.set({ agent: "claude", session: `sess-${n}` }, "kolu", `File-${n}.olai`))
    }
    const left = await run(scopes.set({ agent: "claude", session: "sess-new" }, "kolu", "New.olai"))
    // The least recently touched one, and only it. A person never touched that
    // conversation, so this report is the only way its held bodies are ever
    // taken back.
    expect(left.map((row) => row.session)).toEqual(["sess-0"])
    expect(scopes.rows().some((row) => row.session === "sess-0")).toBe(false)
  })
})

test("picks are opaque JSON, survive restart and revoke on replacement", async () => {
  const scopes = await run(forDirectory(HERE))
  const choice = { enabled: true, nested: ["arbitrary", 3, false] }
  await run(scopes.set(IN, "mail", choice))
  const issued = scopes.recipient(scopes.rows()[0]!)
  expect(issued.pick).toEqual(choice)
  expect(Object.keys(issued).sort()).toEqual(["agent", "current", "pick", "session"])
  expect((await run(forDirectory(HERE))).rows()[0]?.pick).toEqual(choice)
  await run(scopes.set(IN, "mail", true))
  expect(issued.current()).toBe(false)
})
