import { AGENT_ENV } from "@kolu/acp/engine"
import { describe, expect, test } from "bun:test"

import { REMOTE_SIGNALS } from "@kolu/acp-claude"
import { DISABLE_AUTO_MEMORY_ENV, ENGINE } from "./server.ts"
import { INSTALL } from "./install.ts"

const CWD = "/vault"

const nowhere = () => null

describe("finding the Claude Code adapter on a host", () => {
  test("the configured ACP agent IS this row", () => {
    expect(
      ENGINE.at({
        env: { [AGENT_ENV]: "/nix/store/x/bin/claude-agent-acp" },
        cwd: CWD,
        found: nowhere,
      }),
    ).toEqual({
      command: "/nix/store/x/bin/claude-agent-acp",
      args: [],
      env: { [DISABLE_AUTO_MEMORY_ENV]: "1" },
      unset: REMOTE_SIGNALS,
    })
  })

  test("the adapter's own memory is switched OFF on every spawn", () => {
    expect(
      ENGINE.at({
        env: { [AGENT_ENV]: "/nix/store/x/bin/claude-agent-acp", [DISABLE_AUTO_MEMORY_ENV]: "0" },
        cwd: CWD,
        found: nowhere,
      }),
    ).toEqual({
      command: "/nix/store/x/bin/claude-agent-acp",
      args: [],
      env: { [DISABLE_AUTO_MEMORY_ENV]: "1" },
      unset: REMOTE_SIGNALS,
    })
  })

  test("a command line, not a path: the adapter is often `node <file>`", () => {
    expect(ENGINE.at({ env: { [AGENT_ENV]: "node /a/index.js" }, cwd: CWD, found: nowhere }))
      .toEqual({
        command: "node",
        args: ["/a/index.js"],
        env: { [DISABLE_AUTO_MEMORY_ENV]: "1" },
        unset: REMOTE_SIGNALS,
      })
  })

  test("nothing baked in is this engine's own sentence, and NOTHING is looked for on a path", () => {
    let probed = false
    const at = ENGINE.at({
      env: {},
      cwd: CWD,
      found: () => {
        probed = true
        return "/usr/bin/claude"
      },
    })
    expect(at).toBe(INSTALL)
    expect(probed).toBe(false)
  })

  test("the variables the adapter reads as \"remote\" are its own ssh and browser signals", () => {
    expect([...REMOTE_SIGNALS].sort()).toEqual([
      "CLAUDE_CODE_REMOTE",
      "NO_BROWSER",
      "SSH_CLIENT",
      "SSH_CONNECTION",
      "SSH_TTY",
    ])
  })

  test("an empty adapter path leaves this engine unavailable, saying so", () => {
    expect(ENGINE.at({ env: { [AGENT_ENV]: "" }, cwd: CWD, found: nowhere })).toBe(INSTALL)
  })

})
