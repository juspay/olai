import { describe, expect, test } from "bun:test"

import { INSTALL } from "./install.ts"
import { CODEX_AGENT_ENV, CODEX_CONFIG_ENV, ENGINE, memoryOff } from "./server.ts"

const CWD = "/vault"
const nowhere = () => null

describe("finding the Codex adapter on a host", () => {
  test("the configured adapter is this row, including a command-line override", () => {
    expect(ENGINE.at({
      env: { [CODEX_AGENT_ENV]: "/nix/store/x/bin/codex-acp" },
      cwd: CWD,
      found: nowhere,
    })).toEqual({
      command: "/nix/store/x/bin/codex-acp",
      args: [],
      env: { [CODEX_CONFIG_ENV]: memoryOff() },
    })
    expect(ENGINE.at({
      env: { [CODEX_AGENT_ENV]: "node /a/index.js" },
      cwd: CWD,
      found: nowhere,
    })).toEqual({
      command: "node",
      args: ["/a/index.js"],
      env: { [CODEX_CONFIG_ENV]: memoryOff() },
    })
  })

  test("`features.memories` is forced OFF, over whatever the operator set", () => {
    // The MERGE assert, spelled once: an operator may have enabled Codex's
    // own memory in `~/.codex/config.toml`, and the spawn's `CODEX_CONFIG`
    // overlay is the one place olai can win. Every other key survives.
    expect(memoryOff()).toBe('{"features":{"memories":false}}')
    expect(memoryOff('{"model":"gpt-6","features":{"memories":true,"other":1}}'))
      .toBe('{"model":"gpt-6","features":{"memories":false,"other":1}}')
    // Not a JSON object — garbage, or a bare string — is treated as absent
    // and the forced value stands alone.
    expect(memoryOff("not json")).toBe('{"features":{"memories":false}}')
    expect(memoryOff('["an","array"]')).toBe('{"features":{"memories":false}}')
    // `features` that is not a record is replaced rather than crashed on.
    expect(memoryOff('{"features":"on"}')).toBe('{"features":{"memories":false}}')
    // The adapter hand gets the same answer, from wherever the operator's
    // value came — compare the whole row, as the claude sibling does.
    expect(ENGINE.at({
      env: { [CODEX_AGENT_ENV]: "/nix/store/x/bin/codex-acp", [CODEX_CONFIG_ENV]: '{"model":"gpt-6","features":{"memories":true}}' },
      cwd: CWD,
      found: nowhere,
    })).toEqual({
      command: "/nix/store/x/bin/codex-acp",
      args: [],
      env: { [CODEX_CONFIG_ENV]: '{"model":"gpt-6","features":{"memories":false}}' },
    })
  })


  test("an absent or empty pin is this engine's own sentence, and never falls through to PATH", () => {
    let probed = false
    const found = () => {
      probed = true
      return "/usr/bin/codex"
    }
    expect(ENGINE.at({ env: {}, cwd: CWD, found })).toBe(INSTALL)
    expect(ENGINE.at({ env: { [CODEX_AGENT_ENV]: "" }, cwd: CWD, found })).toBe(INSTALL)
    expect(probed).toBe(false)
  })
})

