/**
 * WHAT THIS ENGINE MAKES OF A HOST, over values.
 *
 * The probe is a pure function of an environment and a lookup
 * (`@olai/acp/engine`'s `Where`), so whether this row is offered — and what it
 * would spawn — is a claim a test can make without a filesystem.
 *
 * IT LIVES HERE and not in `olai-plugin-chat` because the row does: each engine's
 * probe is one plugin’s fact, and what is left in core is ordering and
 * the shape of the reading (`olai-plugin-chat`'s `agents/roster.test.ts`).
 */

import { describe, expect, test } from "bun:test"

import { name } from "./index.ts"
import { INSTALL } from "./install.ts"
import { ENGINE } from "./server.ts"

const CWD = "/vault"

describe("finding omp on a host", () => {
  test("an omp on the search path is a row, started autonomously", () => {
    expect(
      ENGINE.at({
        env: {},
        cwd: CWD,
        found: (word) => word === "omp" ? "/usr/bin/omp" : null,
      }),
    ).toEqual({
      command: "/usr/bin/omp",
      // `--approval-mode yolo` BEFORE the subcommand: it is a launch-global
      // flag omp forwards to `acp`. What it buys is the autonomy the Claude and
      // Codex rows get from a bypass mode — and it is the only way to get it
      // here, because omp's ACP modes are `default` and `plan` and
      // `bypassPermissions` is refused.
      args: ["--approval-mode", "yolo", "acp"],
    })
  })

  test("the served directory is the child's own cwd, not an argument", () => {
    // Unlike the opencode row, which has to say `--cwd`: omp reads the
    // directory it was started in and takes an absolute `cwd` on every request
    // that needs one. So nothing here may grow a `--cwd`, and the cwd handed to
    // the probe is deliberately not read — which is what makes this assertion
    // the one that would catch it.
    expect(ENGINE.at({ env: {}, cwd: "/elsewhere", found: () => "/bin/omp" }))
      .toEqual({ command: "/bin/omp", args: ["--approval-mode", "yolo", "acp"] })
  })

  test("the ABSOLUTE file the probe found, never the bare word", () => {
    // Handing over `omp` would leave the spawn to resolve it again, against
    // whatever path the child ends up with — which is a different build than
    // the one that answered.
    const at = ENGINE.at({ env: {}, cwd: CWD, found: () => "/home/u/.local/bin/omp" })
    expect(at?.command).toBe("/home/u/.local/bin/omp")
  })

  test("nothing of that name on the search path is no row at all", () => {
    expect(ENGINE.at({ env: {}, cwd: CWD, found: () => null })).toBeNull()
  })

  test("no variable is read: this engine is FOUND rather than shipped", () => {
    // Olai ships no pin for omp and has no override of its own for it. The way
    // to point olai at a different build is to put that build on the agent
    // search path, which is the same gesture as installing it. `OLAI_AGENT_PATH`
    // is where the SERVE says where that path is — one decision, made once, for
    // every row.
    expect(ENGINE.at({ env: { OLAI_ACP_AGENT: "/adapter" }, cwd: CWD, found: () => null })).toBeNull()
    expect(ENGINE.at({ env: { OLAI_AGENT_PATH: "/somewhere" }, cwd: CWD, found: () => null })).toBeNull()
  })

  test("what a person is told when this machine has no agent at all", () => {
    // THE PLUGIN'S WHOLE SENTENCE — core displays one and never composes one.
    // Asserted off the CONSTANT rather than off the registration: it is spelled
    // once here and spent once, by the browser half that hangs it in
    // `engine.install`.
    expect(INSTALL).toEqual({
      name: "Oh My Pi",
      where: "https://github.com/can1357/oh-my-pi",
      why: "put `omp` on this server's PATH",
    })
  })

  test("the standing prompt rides the first turn, like every engine olai ships", () => {
    expect(ENGINE.prompt).toEqual({ kind: "first-turn" })
  })

  test("the plugin's word is the row's id", () => {
    expect(name).toBe("omp")
    expect(ENGINE.name).toBe("Oh My Pi")
  })
})
