import { describe, expect, test } from "bun:test"

import { ENGINE } from "./server.ts"
import { INSTALL } from "./install.ts"

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
      args: ["acp"],
    })
  })

  test("the ABSOLUTE file the probe found, never the bare word", () => {
    const at = ENGINE.at({ env: {}, cwd: CWD, found: () => "/home/u/.local/bin/opencode" })
    expect(at).toMatchObject({ command: "/home/u/.local/bin/opencode" })
  })

  test("nothing of that name on the search path is this engine's own sentence", () => {
    expect(ENGINE.at({ env: {}, cwd: CWD, found: () => null })).toBe(INSTALL)
  })

  test("no variable is read: this engine is FOUND rather than shipped", () => {
    expect(
      ENGINE.at({ env: { KOLU_ACP_AGENT: "/adapter" }, cwd: CWD, found: () => null }),
    ).toBe(INSTALL)
  })

})
