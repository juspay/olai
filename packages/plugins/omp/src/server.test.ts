import { describe, expect, test } from "bun:test"

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
      args: ["--approval-mode", "yolo", "acp"],
    })
  })

  test("the served directory is the child's own cwd, not an argument", () => {
    expect(ENGINE.at({ env: {}, cwd: "/elsewhere", found: () => "/bin/omp" }))
      .toEqual({ command: "/bin/omp", args: ["--approval-mode", "yolo", "acp"] })
  })

  test("the ABSOLUTE file the probe found, never the bare word", () => {
    const at = ENGINE.at({ env: {}, cwd: CWD, found: () => "/home/u/.local/bin/omp" })
    expect(at).toMatchObject({ command: "/home/u/.local/bin/omp" })
  })

  test("nothing of that name on the search path is this engine's own sentence", () => {
    expect(ENGINE.at({ env: {}, cwd: CWD, found: () => null })).toBe(INSTALL)
  })

  test("no variable is read: this engine is FOUND rather than shipped", () => {
    expect(ENGINE.at({ env: { KOLU_ACP_AGENT: "/adapter" }, cwd: CWD, found: () => null })).toBe(INSTALL)
    expect(ENGINE.at({ env: { OLAI_AGENT_PATH: "/somewhere" }, cwd: CWD, found: () => null })).toBe(INSTALL)
  })

})
