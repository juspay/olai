/**
 * Which of the engines this build has a machine offers, over values.
 *
 * The reading is a pure function of an environment, a probe
 * (`@olai/acp/engine`'s `Where`) and THE ENGINES IT IS HANDED, which is the
 * whole reason it is written that way: what a person is offered depends on two
 * variables, a filesystem and a bundle, and none of those is a thing to arrange
 * in order to check that the off switch is still the off switch.
 *
 * ## The engines here are MADE UP, and that is the phase
 *
 * This file used to assert what each of the three rows made of an environment —
 * the variable one, the PATH one, the pair — because the three were a table in
 * this directory. Each is a plugin now, with its own directory and its own
 * release clock, and each of those claims is asserted beside the plugin that
 * answers it (`packages/plugins/<engine>/src/server.test.ts`). What is left here
 * is what CORE decides, and the fakes below are what make that visible: the off
 * switch, the order, and that a row is offered exactly when its own probe
 * answered.
 *
 * {@link onPath} gets its own tests against a real directory, because what it is
 * about is the disk: a file that is not executable, a directory with the right
 * name, an empty PATH entry. It is one line over `Bun.which` and the tests are
 * still here deliberately — what they assert is not that Bun works but that the
 * answers olai DEPENDS on are the ones it gives, which is a claim about this
 * feature rather than about that function.
 */

import type { Adapter, Engine, Leg, Where } from "@olai/acp/engine"
import { describe, expect, test } from "bun:test"
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { delimiter, join } from "node:path"

import { AGENT_ENV, AGENT_PATH_ENV } from "../adapter.ts"
import { detecting, type Installed, onPath, type Roster, rosterOf } from "./roster.ts"

const CWD = "/vault"

/** Nothing on the machine's PATH. */
const nowhere = () => null

/** A leg is DATA about how to read a wire, and nothing here reads one — so the
 *  cases below need a value rather than a behaviour, and the value travels
 *  through {@link rosterOf} untouched. */
const NO_LEG = {} as Leg

/** One made-up engine, offered where `at` says so. The three real ones are three
 *  directories; what this file is about is what core does with any of them. */
const engine = (id: string, at: (where: Where) => Adapter | null): Engine => ({
  id,
  name: `${id} (a name)`,
  leg: NO_LEG,
  at,
  prompt: { kind: "first-turn" },
})

/** ...one that is always here, and one that is never. */
const here = (id: string): Engine => engine(id, () => ({ command: `/bin/${id}`, args: [] }))
const absent = (id: string): Engine => engine(id, () => null)

/** The rows off a roster that has some, for the cases that are about the ROWS.
 *  A bench asserting the arm is a bench about the arm, and those are below. */
const rowsIn = (found: Roster): ReadonlyArray<Installed> =>
  found.kind === "here" ? found.installed : []

describe("who is offered", () => {
  test("an engine whose probe answers is a row, carrying what the probe said", () => {
    const found = rosterOf({ env: {}, cwd: CWD, found: nowhere }, [
      engine("one", (where) => ({ command: "/bin/one", args: ["--cwd", where.cwd] })),
    ])
    expect(rowsIn(found).map((row) => row.id)).toEqual(["one"])
    expect(rowsIn(found)[0]?.adapter).toEqual({ command: "/bin/one", args: ["--cwd", CWD] })
  })

  test("...and one whose probe says nothing is simply absent", () => {
    // `null` from a probe is NOT A FAULT: a machine that is not running the tool
    // has had nothing go wrong, and what a person is owed about it is the
    // engine's own install sentence on the no-agent face rather than a row that
    // would fail at every `session/new`.
    expect(rosterOf({ env: {}, cwd: CWD, found: nowhere }, [absent("one")]))
      .toEqual({ kind: "none", because: { kind: "none-installed" } })
  })

  test("every row carries the engine's own name and prompt channel, untouched", () => {
    const found = rosterOf({ env: {}, cwd: CWD, found: nowhere }, [here("one")])
    expect(rowsIn(found)[0]?.name).toBe("one (a name)")
    expect(rowsIn(found)[0]?.prompt).toEqual({ kind: "first-turn" })
  })

  test("the probe is handed the SERVE's own lookup, not one of its own", () => {
    // Where this process may look is a fact about the serve — olai's PATH is not
    // your shell's — so an engine asks the `found` it is given and never
    // resolves a name for itself.
    const asked: Array<string> = []
    const found = (word: string): string | null => {
      asked.push(word)
      return "/bin/x"
    }
    rosterOf(
      { env: {}, cwd: CWD, found },
      [engine("one", (where) => where.found("one") === null ? null : { command: "x", args: [] })],
    )
    expect(asked).toEqual(["one"])
  })

  test("no engines at all is a whole state, and it is the empty roster", () => {
    // `--plugins=` with nothing named, or a build with every engine row
    // disabled. The panel draws the face that says so; nothing here refuses.
    expect(rosterOf({ env: {}, cwd: CWD, found: () => "/bin/anything" }, []))
      .toEqual({ kind: "none", because: { kind: "no-engine" } })
  })

  test("the EMPTY variable is the whole off switch, not one missing row", () => {
    // The documented way to turn chat off. A machine with an engine installed
    // must not get that engine instead of the "off" somebody asked for — and
    // nothing is probed at all, whichever engines the build has.
    let probed = false
    const found = rosterOf(
      { env: { [AGENT_ENV]: "" }, cwd: CWD, found: nowhere },
      [engine("one", () => {
        probed = true
        return { command: "/bin/one", args: [] }
      })],
    )
    expect(found).toEqual({ kind: "none", because: { kind: "switched-off" } })
    expect(probed).toBe(false)
  })

  test("the order is the CALLER's, so the picker draws the same list every time", () => {
    // Registration order is the order two dynamic imports came back in, which is
    // a fact about the filesystem on the day; the composition root sorts against
    // the bundle's own rows before handing the list over, and this function
    // preserves whatever it was given (`@olai/server`'s `probes.ts` argues it).
    const found = rosterOf({ env: {}, cwd: CWD, found: nowhere }, [
      here("first"),
      absent("skipped"),
      here("second"),
    ])
    expect(rowsIn(found).map((row) => row.id)).toEqual(["first", "second"])
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

describe("where the probes look", () => {
  test("the search path is a variable of its own, so a service can be told", () => {
    // olai's PATH is not your shell's — a home-manager unit inherits neither.
    // The name is asserted because it is a thing a person types into a config.
    expect(AGENT_PATH_ENV).toBe("OLAI_AGENT_PATH")
  })
})

/**
 * THE LIVE READING — the same answer over a list that MOVES, which is what an
 * engine plugin being switched on or off at the plugins panel makes of it.
 *
 * These are about {@link detecting}, and what makes it worth being its own door
 * rather than calling {@link roster} again is the two halves it keeps apart: the
 * BUILD's half follows the fibers, and the MACHINE's half deliberately does not.
 */
describe("a table that moves", () => {
  test("an engine that leaves the list leaves the roster, and one that arrives enters it", () => {
    const detect = detecting({}, CWD)
    expect(rowsIn(detect([here("one"), here("two")])).map((row) => row.id)).toEqual(["one", "two"])
    expect(rowsIn(detect([here("two")])).map((row) => row.id)).toEqual(["two"])
    // BOTH DIRECTIONS: a reading that only ever shrank would pass the first two
    // lines and be exactly wrong for somebody turning a plugin back on.
    expect(rowsIn(detect([here("one"), here("two")])).map((row) => row.id)).toEqual(["one", "two"])
  })

  test("the last engine leaving is `no-engine`, the same word a build with none gives", () => {
    // The invariant the loader surface rests on, at this end: a row somebody
    // switched off and a row the flag never named are ONE state, so they are one
    // word — and the panel draws one face for both.
    const detect = detecting({}, CWD)
    expect(detect([here("one")]).kind).toBe("here")
    expect(detect([])).toEqual({ kind: "none", because: { kind: "no-engine" } })
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
    detect([one, two])
    detect([two])
    detect([one, two])
    detect([one, two])
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
      return null
    })
    const detect = detecting({}, CWD)
    detect([missing])
    detect([missing])
    detect([missing])
    expect(asked).toBe(1)
  })

  test("the off switch is read every time, because it is a person's and not the disk's", () => {
    // `OLAI_ACP_AGENT=` is the whole panel rather than one row, and it is one map
    // lookup — so it is not cached, and a detector built against an environment
    // that has it set says so on every ask rather than only the first.
    const detect = detecting({ [AGENT_ENV]: "" }, CWD)
    expect(detect([here("one")])).toEqual({ kind: "none", because: { kind: "switched-off" } })
    expect(detect([here("one"), here("two")])).toEqual({
      kind: "none",
      because: { kind: "switched-off" },
    })
  })
})
