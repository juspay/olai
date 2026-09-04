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
      { agent: "claude", session: "sess-1", plugin: "kolu", file: "Fleet.olai" },
    ])
  })

  test("a second pick for the same doorbell replaces the first", async () => {
    const scopes = await run(forDirectory(HERE))
    await run(scopes.set(IN, "kolu", "Fleet.olai"))
    await run(scopes.set(IN, "kolu", "Other.olai"))
    expect(scopes.rows()).toEqual([
      { agent: "claude", session: "sess-1", plugin: "kolu", file: "Other.olai" },
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
      { agent: "claude", session: "sess-1", plugin: "odu", file: "Runs.olai" },
    ])
  })

  test("the same session id under another agent is another conversation", async () => {
    const scopes = await run(forDirectory(HERE))
    await run(scopes.set({ agent: "claude", session: "sess-1" }, "kolu", "A.olai"))
    await run(scopes.set({ agent: "opencode", session: "sess-1" }, "kolu", "B.olai"))
    expect(scopes.rows()).toEqual([
      { agent: "claude", session: "sess-1", plugin: "kolu", file: "A.olai" },
      { agent: "opencode", session: "sess-1", plugin: "kolu", file: "B.olai" },
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
    // `@olai/state` stages at `<file>.<pid>.tmp` — per PROCESS, not per call —
    // so two overlapping writes here share one staging path: without the
    // permit, one rename lands and the other fails ENOENT for a pick whose
    // bytes never arrived. Two tabs, or a double-click on the picker.
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
        { agent: "claude", session: "sess-2", plugin: "odu", file: "Runs.olai" },
        7,
      ],
    })
    expect((await run(forDirectory(HERE))).rows()).toEqual([
      { agent: "claude", session: "sess-2", plugin: "odu", file: "Runs.olai" },
    ])
  })
})

describe("what a write says it removed", () => {
  test("a write answers with the rows it removed, so a caller can take their doorbells back", async () => {
    const scopes = await run(forDirectory(HERE))
    // A fresh pick removes nothing.
    expect(await run(scopes.set(IN, "kolu", "Fleet.olai"))).toEqual([])
    // Re-pointing removes the row it replaced — the caller holds bodies derived
    // from the OLD file and has to hear that it is gone.
    const moved = await run(scopes.set(IN, "kolu", "Other.olai"))
    expect(moved.map((row) => row.file)).toEqual(["Fleet.olai"])
    // ... and so does a clear.
    const cleared = await run(scopes.set(IN, "kolu", null))
    expect(cleared.map((row) => row.file)).toEqual(["Other.olai"])
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

/**
 * A PICK WHOSE FILE STOPPED BEING SERVED, across a restart — the half of the
 * fault that only the disk can answer for.
 *
 * The rule itself (mark on the edge, unmark when it comes back, answer with
 * only what just broke) is asserted here rather than only against the chat's
 * stand-in, because the property that makes it worth having is a property of
 * the RECORD: "the conversation is told once, and not again after a restart"
 * cannot be driven through anything in memory. So every case below crosses a
 * second `forDirectory` over the same directory, which is what a next boot is.
 *
 * The judgement is a FUNCTION over a plugin and a path, which is the shape the
 * member takes: the caller holds a revision and a table of what each doorbell
 * declared, and materialising the list of what broke would mean walking a
 * directory per revision. It answers with the CAUSE, because the two causes
 * reach a person as two different sentences and this file decides neither.
 */
describe("a pick its doorbell cannot watch", () => {
  const ALL_WELL = () => null
  const RENAMED = (_plugin: string, file: string): "gone" | null =>
    file === "Fleet.olai" ? "gone" : null
  /** The other cause: the file is right there and is not a kind that doorbell
   *  reads — a `.md` under a wake that derives from nodes, which is the state a
   *  picker offering every served file could leave on the disk. */
  const WRONG_KIND = (_plugin: string, file: string): "unwatchable" | null =>
    file === "Fleet.olai" ? "unwatchable" : null

  test("nothing is answered, and nothing is written, while the file is there", async () => {
    const scopes = await run(forDirectory(HERE))
    await run(scopes.set(IN, "kolu", "Fleet.olai"))
    const written = local.writes(HERE)
    expect(await run(scopes.faults(ALL_WELL, TELLABLE))).toEqual([])
    // A revision in which nothing moved is every revision anybody publishes,
    // and it must not put a filesystem write behind each of them.
    expect(local.writes(HERE)).toBe(written)
  })

  test("the edge is answered once, and the mark is on the disk", async () => {
    const scopes = await run(forDirectory(HERE))
    await run(scopes.set(IN, "kolu", "Fleet.olai"))
    const fell = await run(scopes.faults(RENAMED, TELLABLE))
    expect(fell.map((row) => row.file)).toEqual(["Fleet.olai"])
    expect(scopes.rows()[0]?.fault).toBe("gone")
    // ... and again on the same missing file says nothing more. One rename is
    // one sentence, not one per revision for as long as it stays renamed.
    expect(await run(scopes.faults(RENAMED, TELLABLE))).toEqual([])
  })

  test("A RESTART SAYS NOTHING, because the record remembers it was said", async () => {
    // THE CASE THIS FIELD EXISTS FOR. Without a persisted mark the next boot
    // reads the pick, finds the file still missing, and tells the conversation
    // again — every boot, forever, about a fault somebody was told about days
    // ago. Driven through a SECOND STORE over the same directory, because the
    // next boot is a different process and the closure is not the point.
    await run((await run(forDirectory(HERE))).set(IN, "kolu", "Fleet.olai"))
    await run((await run(forDirectory(HERE))).faults(RENAMED, TELLABLE))
    const restarted = await run(forDirectory(HERE))
    expect(restarted.rows()[0]?.fault).toBe("gone")
    expect(await run(restarted.faults(RENAMED, TELLABLE))).toEqual([])
  })

  test("the file coming back unmarks it, and the record is the bytes it was", async () => {
    const scopes = await run(forDirectory(HERE))
    await run(scopes.set(IN, "kolu", "Fleet.olai"))
    const untroubled = local.read(HERE, "wake")
    await run(scopes.faults(RENAMED, TELLABLE))
    // A HEALED TABLE IS AN UNTROUBLED TABLE. Written back without the key
    // rather than with a `false`, so there is no third state on the disk and a
    // row an older olai wrote reads the same as a row this one healed.
    expect(await run(scopes.faults(ALL_WELL, TELLABLE))).toEqual([])
    expect(local.read(HERE, "wake")).toEqual(untroubled)
    expect((await run(forDirectory(HERE))).rows()[0]?.fault).toBeUndefined()
  })

  test("... and it can break again afterwards, which is a second thing that happened", async () => {
    const scopes = await run(forDirectory(HERE))
    await run(scopes.set(IN, "kolu", "Fleet.olai"))
    await run(scopes.faults(RENAMED, TELLABLE))
    await run(scopes.faults(ALL_WELL, TELLABLE))
    expect((await run(scopes.faults(RENAMED, TELLABLE))).map((row) => row.file)).toEqual(["Fleet.olai"])
  })

  test("THE SECOND CAUSE IS A FAULT ON THE SAME TERMS — said once, and written down", async () => {
    // The picker offers only the kinds a doorbell declared, so nothing a person
    // presses can reach this any more. A record can: a pick stored before that
    // filter existed, a stale tab, a hand-edited file. It must not be the one
    // silent arm left — a scope nothing watches while the heartbeat says the
    // watcher is alive is the whole defect, whichever way it got there.
    const scopes = await run(forDirectory(HERE))
    await run(scopes.set(IN, "kolu", "Fleet.olai"))
    const fell = await run(scopes.faults(WRONG_KIND, TELLABLE))
    expect(fell.map((row) => row.fault)).toEqual(["unwatchable"])
    expect(scopes.rows()[0]?.fault).toBe("unwatchable")
    expect(await run(scopes.faults(WRONG_KIND, TELLABLE))).toEqual([])
    // ... and a restart is still quiet about it, which is what the record buys.
    expect((await run(forDirectory(HERE))).rows()[0]?.fault).toBe("unwatchable")
  })

  test("a cause that changes under a standing fault is written, and says nothing again", async () => {
    // Somebody scoped a `.md` and then deleted it. The conversation has already
    // been told its doorbell is watching nothing; what changed is what the STRIP
    // should say, and one fault is one interruption.
    const scopes = await run(forDirectory(HERE))
    await run(scopes.set(IN, "kolu", "Fleet.olai"))
    await run(scopes.faults(WRONG_KIND, TELLABLE))
    expect(await run(scopes.faults(RENAMED, TELLABLE))).toEqual([])
    expect(scopes.rows()[0]?.fault).toBe("gone")
  })

  test("a standing fault of one cause is not written back per revision", async () => {
    // The write happens on the EDGE, and a fault that stands is not an edge —
    // otherwise every keystroke that lands in an outline is a filesystem write
    // for as long as somebody's doorbell is broken.
    const scopes = await run(forDirectory(HERE))
    await run(scopes.set(IN, "kolu", "Fleet.olai"))
    await run(scopes.faults(RENAMED, TELLABLE))
    const marked = local.writes(HERE)
    expect(await run(scopes.faults(RENAMED, TELLABLE))).toEqual([])
    expect(local.writes(HERE)).toBe(marked)
  })

  test("a re-pick clears the mark, so the new file gets its own fault", async () => {
    // A person who has just pointed this doorbell somewhere is owed the next
    // fault on the NEW file; carrying the old file's mark across would swallow
    // it silently.
    const scopes = await run(forDirectory(HERE))
    await run(scopes.set(IN, "kolu", "Fleet.olai"))
    await run(scopes.faults(RENAMED, TELLABLE))
    await run(scopes.set(IN, "kolu", "Other.olai"))
    expect(scopes.rows()[0]?.fault).toBeUndefined()
    expect(
      (await run(scopes.faults((_plugin, file) => file === "Other.olai" ? "gone" : null, () => true)))
        .map((row) => row.file),
    ).toEqual(["Other.olai"])
  })

  test("only the rows whose own file went are marked", async () => {
    const scopes = await run(forDirectory(HERE))
    await run(scopes.set(IN, "kolu", "Fleet.olai"))
    await run(scopes.set(IN, "odu", "Runs.olai"))
    const fell = await run(scopes.faults(RENAMED, TELLABLE))
    expect(fell.map((row) => row.plugin)).toEqual(["kolu"])
    expect(scopes.rows().map((row) => row.fault)).toEqual(["gone", undefined])
  })

  test("a tenant this serve did not compose leaves its row untouched, mark and all", async () => {
    // The mark IS the saying: a serve running `--plugins` without this row's
    // tenant can still see the file went, but nothing would say so — and
    // marking it would spend the one signal on a serve with no doorbell to
    // lose. Turn that plugin back on and the row must still be tellable.
    const scopes = await run(forDirectory(HERE))
    await run(scopes.set(IN, "kolu", "Fleet.olai"))
    const silent = (): boolean => false
    expect(await run(scopes.faults(RENAMED, silent))).toEqual([])
    expect(scopes.rows().map((row) => row.fault)).toEqual([undefined])
    // ... and with the tenant back, the fault is still owed and still said.
    const fell = await run(scopes.faults(RENAMED, TELLABLE))
    expect(fell.map((row) => row.file)).toEqual(["Fleet.olai"])
  })

  test("a fault is not a TOUCH, so it does not move a row's place in the eviction order", async () => {
    // The array's order means "least recently touched" and nothing else. A
    // rename somebody did in another window is not somebody touching their
    // doorbell, and a fault that walked a row to the back would evict a pick
    // whose conversation was genuinely older.
    const scopes = await run(forDirectory(HERE))
    await run(scopes.set({ agent: "claude", session: "a" }, "kolu", "Fleet.olai"))
    await run(scopes.set({ agent: "claude", session: "b" }, "kolu", "Other.olai"))
    await run(scopes.faults(RENAMED, TELLABLE))
    expect(scopes.rows().map((row) => row.session)).toEqual(["a", "b"])
  })

  test("a mark that will not parse reads as an unmarked row, and the pick survives", async () => {
    // The mark is not load-bearing: a row with a damaged one still names a
    // conversation, a doorbell and a file perfectly well, and dropping it would
    // turn somebody's doorbell off over a byte that means "we already said
    // something about this".
    const scopes = await run(forDirectory(HERE))
    await run(scopes.set(IN, "kolu", "Fleet.olai"))
    const held = local.read(HERE, "wake") as { scopes: Array<Record<string, unknown>> }
    held.scopes[0]!["fault"] = "yes"
    local.write(HERE, "wake", held)
    const restarted = await run(forDirectory(HERE))
    expect(restarted.rows().map((row) => row.file)).toEqual(["Fleet.olai"])
    expect(restarted.rows()[0]?.fault).toBeUndefined()
  })

  test("a row the olai before this one marked `gone: true` is read as the word it meant", async () => {
    // One line of leniency for a record a day old, and it is worth it for what
    // the mark IS: dropping it re-tells a conversation about a rename it was
    // already told about, on the first revision after an upgrade.
    const scopes = await run(forDirectory(HERE))
    await run(scopes.set(IN, "kolu", "Fleet.olai"))
    const held = local.read(HERE, "wake") as { scopes: Array<Record<string, unknown>> }
    held.scopes[0]!["gone"] = true
    local.write(HERE, "wake", held)
    const restarted = await run(forDirectory(HERE))
    expect(restarted.rows()[0]?.fault).toBe("gone")
    expect(await run(restarted.faults(RENAMED, TELLABLE))).toEqual([])
  })
})
