import { describe, expect, test } from "bun:test"

import { name } from "./index.ts"
import { INSTALL } from "./install.ts"
import { CODEX_AGENT_ENV, ENGINE } from "./server.ts"

const CWD = "/vault"
const nowhere = () => null

describe("finding the Codex adapter on a host", () => {
  test("the configured adapter is this row, including a command-line override", () => {
    expect(ENGINE.at({
      env: { [CODEX_AGENT_ENV]: "/nix/store/x/bin/codex-acp" },
      cwd: CWD,
      found: nowhere,
    })).toEqual({ command: "/nix/store/x/bin/codex-acp", args: [] })
    expect(ENGINE.at({
      env: { [CODEX_AGENT_ENV]: "node /a/index.js" },
      cwd: CWD,
      found: nowhere,
    })).toEqual({ command: "node", args: ["/a/index.js"] })
  })

  test("an absent or empty pin is no row and never falls through to PATH", () => {
    let probed = false
    const found = () => {
      probed = true
      return "/usr/bin/codex"
    }
    expect(ENGINE.at({ env: {}, cwd: CWD, found })).toBeNull()
    expect(ENGINE.at({ env: { [CODEX_AGENT_ENV]: "" }, cwd: CWD, found })).toBeNull()
    expect(probed).toBe(false)
  })

  test("contributes its identity, install sentence and standing-prompt channel", () => {
    expect(name).toBe("codex")
    expect(ENGINE.name).toBe("Codex")
    expect(ENGINE.prompt).toEqual({ kind: "first-turn" })
    expect(INSTALL).toEqual({
      name: "Codex",
      where: "https://developers.openai.com/codex",
      why: "not found — olai was started without the wrapper that carries the pinned adapter",
    })
  })
})
