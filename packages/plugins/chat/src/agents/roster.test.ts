/**
 * Which of the engines this build has a machine offers, over values.
 *
 * The roster is a pure function of a made-up environment and a made-up list of
 * engines ({@link rosterOf} hands both in), so its whole behaviour — the row
 * shapes, the fold that decides whether there is anything to talk to, what the
 * live reading remembers and what a toggle un-remembers — is assertable without
 * a serve, a filesystem or a plugin system.
 *
 * ## THE TABLE, AND WHY THE ABSENCE IS A ROW
 *
 * The roster used to drop an engine whose probe answered no, which is how a
 * panel came to offer two engines while a third sat enabled and unexplained.
 * The cases below pin the shape that closes that: every mounted engine has a
 * row, the row says which arm it is in, and the absence carries the engine's
 * own sentence for a person to read.
 */

import type { Adapter, Engine, Leg, NotHere, Where } from "@olai/acp/engine"
import { describe, expect, test } from "bun:test"
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { delimiter, join } from "node:path"

import { AGENT_ENV } from "../adapter.ts"
import { detecting, here, offBecause, onPath, type Standing, rosterOf } from "./roster.ts"

const CWD = "/vault"

/** Nothing on the machine's PATH. */
const nowhere = () => null

/** A leg is DATA about how to read a wire, and nothing here reads one — so the
 *  cases below need a value rather than a behaviour, and the value travels
 *  through {@link rosterOf} untouched. */
const NO_LEG = {} as Leg

/** One made-up engine, offered where `at` says so. Real engines each live in their own
 *  directory; what this file is about is what core does with any of them. */
const engine = (id: string, at: (where: Where) => Adapter | NotHere): Engine => ({
  id,
  name: `${id} (a name)`,
  leg: NO_LEG,
  at,
  prompt: { kind: "first-turn" },
})

/** ...one that is always here, and one that is never. */
const present = (id: string): Engine => engine(id, () => ({ command: `/bin/${id}`, args: [] }))
const absent = (id: string): Engine => engine(id, () => missing(id))

/** The sentence an absent engine hands back — its own, made up here, because
 *  what is being asserted is that it TRAVELS rather than what it says. */
const missing = (id: string): NotHere => ({
  name: `${id} (a name)`,
  where: null,
  why: `no ${id} on this machine`,
})

/** The ids of a table's `here` rows, for the cases that are about the ROWS.
 *  A bench asserting the arm is a bench about the arm, and those are below. */
const idsIn = (found: ReadonlyArray<Standing>): ReadonlyArray<string> =>
  found.flatMap((row) => row.standing === "here" ? [row.installed.id] : [])

describe("who is offered", () => {
  test("an engine whose probe answers is a `here` row, carrying what the probe said", () => {
    const found = rosterOf({ env: {}, cwd: CWD, found: nowhere }, [
      engine("one", (where) => ({ command: "/bin/one", args: ["--cwd", where.cwd] })),
    ])
    expect(idsIn(found)).toEqual(["one"])
    const row = found[0]
    expect(row?.standing).toBe("here")
    if (row?.standing === "here") {
      expect(row.installed.adapter).toEqual({ command: "/bin/one", args: ["--cwd", CWD] })
    }
  })

  test("...and one whose probe says no is a `not-here` row, carrying the engine's own sentence", () => {
    // THE ABSENCE IS A ROW, not a dropped entry: the person's panel greys it,
    // the plugins panel files it under Needs you, and the log names it. What
    // travels is the engine's own whole sentence, untouched.
    const found = rosterOf({ env: {}, cwd: CWD, found: nowhere }, [absent("one")])
    expect(found).toHaveLength(1)
    const row = found[0]
    expect(row?.standing).toBe("not-here")
    if (row?.standing === "not-here") {
      expect(row.id).toBe("one")
      expect(row.name).toBe("one (a name)")
      expect(row.missing).toEqual(missing("one"))
    }
  })


  test("no engines at all is an empty table, and the fold says which reason", () => {
    // A file policy or a build can leave every engine row
    // disabled. The panel draws the face that says so; nothing here refuses.
    const found = rosterOf({ env: {}, cwd: CWD, found: () => "/bin/anything" }, [])
    expect(found).toEqual([])
    expect(offBecause(found)).toEqual({ kind: "no-engine" })
  })

  test("an empty adapter path does not disable other engines", () => {
    // An empty path belongs to one engine. Another enabled engine still probes
    // and remains available when its own executable is present.
    let probed = false
    const found = rosterOf(
      { env: { [AGENT_ENV]: "" }, cwd: CWD, found: nowhere },
      [engine("one", () => {
        probed = true
        return { command: "/bin/one", args: [] }
      })],
    )
    expect(idsIn(found)).toEqual(["one"])
    expect(probed).toBe(true)
  })

  test("the order is the CALLER's, so the picker draws the same list every time", () => {
    // Registration order is the order two dynamic imports came back in, which is
    // a fact about the filesystem on the day; the composition root sorts against
    // the bundle's own rows before handing the list over, and this function
    // preserves whatever it was given (`@olai/server`'s `probes.ts` argues it).
    const found = rosterOf({ env: {}, cwd: CWD, found: nowhere }, [
      present("first"),
      absent("skipped"),
      present("second"),
    ])
    // THE WHOLE TABLE keeps the given order, absences included — the greyed row
    // a picker draws sits where the engine sits in the bundle, not after it.
    expect(found.map((row) => row.id)).toEqual(["first", "skipped", "second"])
    expect(idsIn(found)).toEqual(["first", "second"])
  })

  test("`here` is the fold a startable-reader wants, over a mixed table", () => {
    const found = rosterOf({ env: {}, cwd: CWD, found: nowhere }, [
      present("first"),
      absent("skipped"),
      present("second"),
    ])
    expect(here(found).map((row) => row.id)).toEqual(["first", "second"])
    expect(here(found).map((row) => row.name)).toEqual(["first (a name)", "second (a name)"])
  })
})

describe("why there is nothing to talk to", () => {
  test("a table with at least one `here` row folds to null", () => {
    const found = rosterOf({ env: {}, cwd: CWD, found: nowhere }, [present("one"), absent("two")])
    expect(offBecause(found)).toBeNull()
  })

  test("every engine absent is `none-installed`, the arm where the sentences are drawn", () => {
    const found = rosterOf({ env: {}, cwd: CWD, found: nowhere }, [absent("one"), absent("two")])
    expect(offBecause(found)).toEqual({ kind: "none-installed" })
  })

  test("an empty table is `no-engine`, the same word a build with none gives", () => {
    expect(offBecause(rosterOf({ env: {}, cwd: CWD, found: nowhere }, [])))
      .toEqual({ kind: "no-engine" })
  })
})

describe("finding an executable on a search path", () => {
  const at = mkdtempSync(join(tmpdir(), "olai-roster-"))
  const first = join(at, "first")
  const second = join(at, "second")
  mkdirSync(first)
  mkdirSync(second)

  const runnable = (dir: string, name: string): string => {
    const file = join(dir, name)
    writeFileSync(file, "#!/bin/sh\n")
    chmodSync(file, 0o755)
    return file
  }

  test("the first hit wins, the way a shell resolves one", () => {
    runnable(first, "opencode")
    runnable(second, "opencode")
    expect(onPath("opencode", [first, second].join(delimiter))).toBe(join(first, "opencode"))
  })

  test("a second engine's probe asks the same question of the same path", () => {
    expect(onPath("pi", [first, second].join(delimiter))).toBeNull()
    runnable(first, "pi")
    expect(onPath("pi", [first, second].join(delimiter))).toBe(join(first, "pi"))
  })

  test("a file that cannot be executed is not an installed agent", () => {
    const file = join(second, "notrunnable")
    writeFileSync(file, "")
    chmodSync(file, 0o644)
    expect(onPath("notrunnable", second)).toBeNull()
  })

  test("a DIRECTORY of the right name is not one either", () => {
    mkdirSync(join(second, "adirectory"))
    expect(onPath("adirectory", second)).toBeNull()
  })

  test("an empty entry finds nothing rather than the served directory", () => {
    // POSIX would read `""` as the current directory, which here is somebody's
    // vault: a file dropped beside their outlines must not decide which agent
    // olai starts. Asserted from the process's OWN cwd — an entry that was
    // honoured would find what is sitting in it.
    const probe = runnable(process.cwd(), "olai-roster-probe")
    try {
      expect(onPath("olai-roster-probe", "")).toBeNull()
      expect(onPath("olai-roster-probe", `${delimiter}${delimiter}${first}`)).toBeNull()
    } finally {
      rmSync(probe)
    }
  })

  test("nothing of that name anywhere is nothing", () => {
    expect(onPath("nosuchagent", [first, second].join(delimiter))).toBeNull()
  })
})


/**
 * THE LIVE READING — the same answer over a list that MOVES, which is what an
 * engine plugin being switched on or off at the plugins panel makes of it.
 *
 * These are about {@link detecting}, and what makes it worth being its own door
 * rather than calling {@link roster} again is the two halves it keeps apart: the
 * BUILD's half follows the fibers, and the MACHINE's half deliberately does not
 * — until the person toggles a row, which is the one "look again" this door
 * answers.
 */
describe("a table that moves", () => {
  test("an engine that leaves the list leaves the table, and one that arrives enters it", () => {
    const detect = detecting({}, CWD)
    expect(idsIn(detect.read([present("one"), present("two")]))).toEqual(["one", "two"])
    expect(idsIn(detect.read([present("two")]))).toEqual(["two"])
    // BOTH DIRECTIONS: a reading that only ever shrank would pass the first two
    // lines and be exactly wrong for somebody turning a plugin back on.
    expect(idsIn(detect.read([present("one"), present("two")]))).toEqual(["one", "two"])
  })

  test("the last engine leaving is `no-engine`, the same word a build with none gives", () => {
    // The invariant the loader surface rests on, at this end: a row somebody
    // switched off and a row with `on: no` in `_olai/Settings.olai` are ONE state, so they are one
    // word — and the panel draws one face for both.
    const detect = detecting({}, CWD)
    expect(offBecause(detect.read([present("one")]))).toBeNull()
    expect(offBecause(detect.read([]))).toEqual({ kind: "no-engine" })
  })

  test("each engine's own probe is asked once, however often the list moves", () => {
    // THE MACHINE'S HALF IS FROZEN ON PURPOSE — which agents are INSTALLED is
    // not re-decided under a reader, because re-deciding it would flip the
    // panel's whole face because somebody's `$HOME/.local/bin` was written to.
    // The count is what makes that a fact rather than an intention: the list is
    // asked four times, in three shapes, and each engine answered once.
    const asked: Array<string> = []
    const counting = (id: string): Engine =>
      engine(id, () => {
        asked.push(id)
        return { command: `/bin/${id}`, args: [] }
      })
    const one = counting("one")
    const two = counting("two")
    const detect = detecting({}, CWD)
    detect.read([one, two])
    detect.read([two])
    detect.read([one, two])
    detect.read([one, two])
    expect(asked).toEqual(["one", "two"])
  })

  test("...including an engine that was NOT installed, which is an answer too", () => {
    // Re-asking an absence is the re-probing this whole arrangement exists to
    // avoid, and it is the easy half to get wrong: a cache keyed on a truthy
    // value would ask the missing engine again on every flip, which on a machine
    // with three engines installed and one not is a `PATH` walk per press.
    let asked = 0
    const missing = engine("gone", () => {
      asked += 1
      return { name: "gone", where: null, why: "no" }
    })
    const detect = detecting({}, CWD)
    detect.read([missing])
    detect.read([missing])
    detect.read([missing])
    expect(asked).toBe(1)
  })

  test("an empty adapter path still allows independently offered engines", () => {
    const detect = detecting({ [AGENT_ENV]: "" }, CWD)
    expect(idsIn(detect.read([present("one")]))).toEqual(["one"])
    expect(idsIn(detect.read([present("one"), present("two")]))).toEqual(["one", "two"])
  })

  test("forget re-probes exactly the id it is handed, and nothing else", () => {
    // A TOGGLE IS A PERSON ASKING: turning a row off and on at the panel must
    // re-read that engine on the way back — a person who has just installed
    // `omp` and flipped its row is owed the new answer without a restart —
    // while every other row keeps its cached answer, which is the frozen half
    // the header refuses to give up.
    const probed: Array<string> = []
    const counting = (id: string, present: () => boolean): Engine =>
      engine(id, () => {
        probed.push(id)
        return present() ? { command: `/bin/${id}`, args: [] } : { name: id, where: null, why: `no ${id}` }
      })
    let ompPresent = false
    const omp = counting("omp", () => ompPresent)
    const claude = counting("claude", () => true)
    const detect = detecting({}, CWD)

    expect(detect.read([omp, claude]).map((row) => row.standing)).toEqual(["not-here", "here"])
    // ...and moving the table alone changes nothing: the cache holds.
    expect(detect.read([omp, claude]).map((row) => row.standing)).toEqual(["not-here", "here"])
    expect(probed).toEqual(["omp", "claude"])

    // The executable arrives, the person toggles the row: the finalizer calls
    // `forget` on the way out, so the re-registration on the way back probes.
    ompPresent = true
    detect.forget("omp")
    const again = detect.read([omp, claude])
    expect(again.map((row) => row.standing)).toEqual(["here", "here"])
    // ...and ONLY that id: claude is still answered from the cache, one probe
    // each for it across the whole case.
    expect(probed).toEqual(["omp", "claude", "omp"])
  })

  test("forgetting an id nobody cached probes it when it next arrives", () => {
    // The registration order the finalizer runs in: an engine may be forgotten
    // before it is ever asked (a row switched off in the same beat it was
    // switched on). `forget` on an absent id is a no-op, and the arrival asks.
    let asked = 0
    const arriving = engine("late", () => {
      asked += 1
      return { command: "/bin/late", args: [] }
    })
    const detect = detecting({}, CWD)
    detect.forget("late")
    detect.read([])
    expect(asked).toBe(0)
    expect(idsIn(detect.read([arriving]))).toEqual(["late"])
    expect(asked).toBe(1)
  })
})
