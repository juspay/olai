import type { Adapter, Engine, Leg, NotHere, Where } from "@kolu/acp/engine"
import { describe, expect, test } from "bun:test"
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { delimiter, join } from "node:path"

import { AGENT_ENV, AGENT_PATH_ENV } from "../adapter.ts"
import { choiceOf, detecting, here, offBecause, onPath, type Standing, rosterOf } from "./roster.ts"

const CWD = "/vault"

const nowhere = () => null

const NO_LEG = {} as Leg

const engine = (id: string, at: (where: Where) => Adapter | NotHere): Engine => ({
  id,
  name: `${id} (a name)`,
  leg: NO_LEG,
  at,
  prompt: { kind: "first-turn" },
})

const present = (id: string): Engine => engine(id, () => ({ command: `/bin/${id}`, args: [] }))
const absent = (id: string): Engine => engine(id, () => missing(id))

const missing = (id: string): NotHere => ({
  name: `${id} (a name)`,
  where: null,
  why: `no ${id} on this machine`,
})

const idsIn = (found: ReadonlyArray<Standing>): ReadonlyArray<string> =>
  found.flatMap((row) => row.standing === "here" ? [row.installed.id] : [])

describe("who is offered", () => {
  test("a here row carries the engine's name, prompt and serve-resolved adapter", () => {
    const found = rosterOf({ env: {}, cwd: CWD, found: word => `/serve/bin/${word}` }, [
      engine("one", (where) => ({ command: where.found("one")!, args: ["--cwd", where.cwd] })),
    ])
    expect(idsIn(found)).toEqual(["one"])
    const row = found[0]
    expect(row?.standing).toBe("here")
    if (row?.standing === "here") {
      expect(row.installed.adapter).toEqual({ command: "/serve/bin/one", args: ["--cwd", CWD] })
      expect(row.installed.name).toBe("one (a name)")
      expect(row.installed.prompt).toEqual({ kind: "first-turn" })
    }
  })

  test("...and one whose probe says no is a `not-here` row, carrying the engine's own sentence", () => {
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
    const found = rosterOf({ env: {}, cwd: CWD, found: () => "/bin/anything" }, [])
    expect(found).toEqual([])
    expect(offBecause(found)).toEqual({ kind: "no-engine" })
  })

  test("an empty adapter path does not disable other engines", () => {
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
    const found = rosterOf({ env: {}, cwd: CWD, found: nowhere }, [
      present("first"),
      absent("skipped"),
      present("second"),
    ])
    expect(found.map(choiceOf).map(row => row.id)).toEqual(["first", "skipped", "second"])
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
})

describe("finding an executable on a search path", () => {
  test("the public override keeps its documented spelling", () => {
    expect(AGENT_PATH_ENV).toBe("OLAI_AGENT_PATH")
  })

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

describe("a table that moves", () => {
  test("an engine that leaves the list leaves the table, and one that arrives enters it", () => {
    const detect = detecting({}, CWD)
    expect(idsIn(detect.read([present("one"), present("two")]))).toEqual(["one", "two"])
    expect(idsIn(detect.read([present("two")]))).toEqual(["two"])
    expect(idsIn(detect.read([present("one"), present("two")]))).toEqual(["one", "two"])
  })

  test("the last engine leaving is `no-engine`, the same word a build with none gives", () => {
    const detect = detecting({}, CWD)
    expect(offBecause(detect.read([present("one")]))).toBeNull()
    expect(offBecause(detect.read([]))).toEqual({ kind: "no-engine" })
  })

  test("each engine's own probe is asked once, however often the list moves", () => {
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
    expect(detect.read([omp, claude]).map((row) => row.standing)).toEqual(["not-here", "here"])
    expect(probed).toEqual(["omp", "claude"])

    ompPresent = true
    detect.forget("omp")
    const again = detect.read([omp, claude])
    expect(again.map((row) => row.standing)).toEqual(["here", "here"])
    expect(probed).toEqual(["omp", "claude", "omp"])
  })

  test("forgetting an id nobody cached probes it when it next arrives", () => {
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
