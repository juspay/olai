/**
 * WHAT THIS ENGINE MAKES OF A HOST, over values.
 *
 * The probe is a pure function of an environment and a lookup
 * (`@olai/acp/engine`'s `Where`), so whether this row is offered — and what it
 * would spawn — is a claim a test can make without a filesystem.
 *
 * IT LIVES HERE and not in `@olai/chat` because the row does: each engine's
 * probe is one plugin's fact now, and what is left in core is the off switch and
 * the shape of the reading (`@olai/chat`'s `agents/roster.test.ts`).
 */

import { describe, expect, test } from "bun:test"

import { name } from "./index.ts"
import { ENGINE } from "./server.ts"

const CWD = "/vault"

describe("finding opencode on a host", () => {
  test("an opencode on the search path is a row, started for THIS directory", () => {
    expect(
      ENGINE.at({
        env: {},
        cwd: CWD,
        found: (word) => word === "opencode" ? "/usr/bin/opencode" : null,
      }),
    ).toEqual({
      command: "/usr/bin/opencode",
      // `--cwd` on the command line is the only cwd opencode's session list
      // hears — see the probe.
      args: ["acp", "--cwd", CWD],
    })
  })

  test("the ABSOLUTE file the probe found, never the bare word", () => {
    // Handing over `opencode` would leave the spawn to resolve it again, against
    // whatever path the child ends up with — which is a different build than the
    // one that answered.
    const at = ENGINE.at({ env: {}, cwd: CWD, found: () => "/home/u/.local/bin/opencode" })
    expect(at?.command).toBe("/home/u/.local/bin/opencode")
  })

  test("nothing of that name on the search path is no row at all", () => {
    expect(ENGINE.at({ env: {}, cwd: CWD, found: () => null })).toBeNull()
  })

  test("no variable is read: this engine is FOUND rather than shipped", () => {
    // Olai ships no pin for opencode and has no override of its own for it. The
    // way to point olai at a different build is to put that build on the agent
    // search path, which is the same gesture as installing it.
    expect(
      ENGINE.at({ env: { OLAI_ACP_AGENT: "/adapter" }, cwd: CWD, found: () => null }),
    ).toBeNull()
  })

  test("what a person is told when this machine has no agent at all", () => {
    expect(ENGINE.missing).toEqual({
      name: "opencode",
      where: "https://opencode.ai",
      why: "put `opencode` on this server's PATH",
    })
  })

  test("the standing prompt rides the first turn, like every engine olai ships", () => {
    expect(ENGINE.prompt).toEqual({ kind: "first-turn" })
  })

  test("the plugin's word is the row's id", () => {
    expect(name).toBe("opencode")
    expect(ENGINE.name).toBe("opencode")
  })
})
