/**
 * Which agents a machine offers, over values.
 *
 * The table is a pure function of an environment and a probe ({@link
 * ./roster.ts}'s `Where`), which is the whole reason it is written that way:
 * what a person is offered depends on two variables and a filesystem, and none
 * of those is a thing to arrange in order to check that the off switch is still
 * the off switch.
 *
 * {@link onPath} gets its own tests against a real directory, because what it
 * is about is the disk: a file that is not executable, a directory with the
 * right name, an empty PATH entry. It is one line over `Bun.which` and the
 * tests are still here deliberately — what they assert is not that Bun works
 * but that the answers olai DEPENDS on are the ones it gives, which is a claim
 * about this feature rather than about that function.
 */

import { describe, expect, test } from "bun:test"
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { delimiter, join } from "node:path"

import { AGENT_ENV, AGENT_PATH_ENV, PI_AGENT_ENV } from "../adapter.ts"
import { BEFORE_THE_ROSTER, onPath, rosterOf } from "./roster.ts"

const CWD = "/vault"

/** Nothing on the machine's PATH. */
const nowhere = () => null

describe("who is offered", () => {
  test("the configured ACP agent is the Claude row", () => {
    const found = rosterOf({
      env: { [AGENT_ENV]: "/nix/store/x/bin/claude-agent-acp" },
      cwd: CWD,
      found: nowhere,
    })
    expect(found.map((row) => row.id)).toEqual(["claude"])
    expect(found[0]?.name).toBe("Claude Code")
    expect(found[0]?.adapter).toEqual({
      command: "/nix/store/x/bin/claude-agent-acp",
      args: [],
    })
  })

  test("an opencode on the search path is a row of its own, started for THIS directory", () => {
    const found = rosterOf({
      env: { [AGENT_ENV]: "/adapter" },
      cwd: CWD,
      found: (name) => name === "opencode" ? "/usr/bin/opencode" : null,
    })
    expect(found.map((row) => row.id)).toEqual(["claude", "opencode"])
    expect(found[1]?.adapter).toEqual({
      command: "/usr/bin/opencode",
      // `--cwd` on the command line is the only cwd opencode's session list
      // hears — see the table.
      args: ["acp", "--cwd", CWD],
    })
  })

  test("opencode alone is a perfectly good roster", () => {
    // Nothing baked in and nothing set: a hand-rolled start on a machine that
    // has opencode is a working panel rather than an empty one.
    const found = rosterOf({
      env: {},
      cwd: CWD,
      found: () => "/usr/bin/opencode",
    })
    expect(found.map((row) => row.id)).toEqual(["opencode"])
  })

  test("pi is the pinned adapter PLUS a found `pi` — either one missing is no row", () => {
    // Adapter without agent: a row that failed at every `session/new` would
    // be offered, which is the one promise the picker may not make.
    expect(
      rosterOf({ env: { [PI_AGENT_ENV]: "/store/bin/pi-acp" }, cwd: CWD, found: nowhere })
        .map((row) => row.id),
    ).toEqual([])
    // Agent without adapter: the variable is the adapter's whole door, the
    // way `OLAI_ACP_AGENT` is the claude row's.
    expect(
      rosterOf({ env: {}, cwd: CWD, found: (name) => name === "pi" ? "/usr/bin/pi" : null })
        .map((row) => row.id),
    ).toEqual([])
  })

  test("a pi on the search path with the adapter named is a row, wrapping the pi the probe found", () => {
    const found = rosterOf({
      env: { [PI_AGENT_ENV]: "/store/bin/pi-acp --flag" },
      cwd: CWD,
      found: (name) => name === "pi" ? "/home/u/.npm-global/bin/pi" : null,
    })
    expect(found.map((row) => row.id)).toEqual(["pi"])
    expect(found[0]?.adapter).toEqual({
      command: "/store/bin/pi-acp",
      args: ["--flag"],
      // The EXACT executable the probe found — otherwise pi-acp resolves the
      // word `pi` against its child's PATH, which is olai's and no other.
      env: { PI_ACP_PI_COMMAND: "/home/u/.npm-global/bin/pi" },
    })
  })

  test("the empty pi variable is as much 'no pi row' as an absent one", () => {
    expect(
      rosterOf({
        env: { [PI_AGENT_ENV]: "" },
        cwd: CWD,
        found: (name) => name === "pi" ? "/usr/bin/pi" : null,
      }).map((row) => row.id),
    ).toEqual([])
  })

  test("nothing installed is nothing offered", () => {
    expect(rosterOf({ env: {}, cwd: CWD, found: nowhere })).toEqual([])
  })

  test("the EMPTY variable is the whole off switch, not one missing row", () => {
    // The documented way to turn chat off. A machine with opencode installed
    // must not get opencode instead of the "off" somebody asked for — and
    // nothing is probed at all.
    let probed = false
    const found = rosterOf({
      env: { [AGENT_ENV]: "" },
      cwd: CWD,
      found: () => {
        probed = true
        return "/usr/bin/opencode"
      },
    })
    expect(found).toEqual([])
    expect(probed).toBe(false)
  })

  test("the order is the table's, so the picker draws the same list every time", () => {
    const found = rosterOf({
      env: { [AGENT_ENV]: "/adapter", [PI_AGENT_ENV]: "/store/bin/pi-acp" },
      cwd: CWD,
      found: () => "/usr/bin/opencode",
    })
    expect(found.map((row) => row.name)).toEqual(["Claude Code", "opencode", "pi"])
  })

  test("a memory that names no agent is about the row that used to be the only one", () => {
    expect(BEFORE_THE_ROSTER).toBe("claude")
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

  test("the pi probe asks the same question of the same path", () => {
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
