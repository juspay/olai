/**
 * WHAT THIS ENGINE MAKES OF A HOST, over values — and this is the row where
 * that matters most, because it is the PAIR.
 *
 * A pi row exists only where BOTH halves answer: the pinned adapter, named by
 * `OLAI_ACP_PI`, and a `pi` on the agent search path for it to wrap. Either one
 * missing and the row is not offered, because the picker's promise is that a row
 * it draws is an agent this machine has — a pi-acp with no `pi` behind it would
 * fail at every `session/new`.
 *
 * IT LIVES HERE and not in `olai-plugin-chat` because the row does: each engine's
 * probe is one plugin's fact now, and what is left in core is the off switch and
 * the shape of the reading (`olai-plugin-chat`'s `agents/roster.test.ts`).
 */

import { describe, expect, test } from "bun:test"

import { name } from "./index.ts"
import { ENGINE, PI_AGENT_ENV } from "./server.ts"
import { INSTALL } from "./install.ts"

const CWD = "/vault"

const nowhere = () => null
const foundPi = (word: string) => word === "pi" ? "/home/u/.npm-global/bin/pi" : null

describe("finding pi on a host", () => {
  test("the adapter named and a `pi` found is a row, wrapping the pi the probe found", () => {
    expect(
      ENGINE.at({ env: { [PI_AGENT_ENV]: "/store/bin/pi-acp --flag" }, cwd: CWD, found: foundPi }),
    ).toEqual({
      command: "/store/bin/pi-acp",
      args: ["--flag"],
      // The EXACT executable the probe found — otherwise pi-acp resolves the
      // word `pi` against its child's PATH, which is olai's and no other.
      env: { PI_ACP_PI_COMMAND: "/home/u/.npm-global/bin/pi" },
    })
  })

  test("adapter without agent is no row", () => {
    // A row that failed at every `session/new` would be offered, which is the
    // one promise the picker may not make.
    expect(ENGINE.at({ env: { [PI_AGENT_ENV]: "/store/bin/pi-acp" }, cwd: CWD, found: nowhere }))
      .toBeNull()
  })

  test("agent without adapter is no row either", () => {
    // The variable is the adapter's whole door, the way `OLAI_ACP_AGENT` is the
    // claude row's: a floating `npx -y pi-acp` is never run, because the wire
    // facts this leg is written against are one revision's.
    expect(ENGINE.at({ env: {}, cwd: CWD, found: foundPi })).toBeNull()
  })

  test("the EMPTY adapter variable is as much 'no pi row' as an absent one", () => {
    expect(ENGINE.at({ env: { [PI_AGENT_ENV]: "" }, cwd: CWD, found: foundPi })).toBeNull()
  })

  test("the adapter is asked for FIRST, so a machine without it probes nothing", () => {
    let probed = false
    ENGINE.at({
      env: {},
      cwd: CWD,
      found: () => {
        probed = true
        return "/usr/bin/pi"
      },
    })
    expect(probed).toBe(false)
  })

  test("the variable is this plugin's own, and a person types it", () => {
    // One variable per adapter rather than a pair syntax on `OLAI_ACP_AGENT`,
    // and it is asserted because it is a thing somebody writes into a config.
    expect(PI_AGENT_ENV).toBe("OLAI_ACP_PI")
  })

  test("what a person is told when this machine has no agent at all", () => {
    // THE PLUGIN'S WHOLE SENTENCE — core displays one and never composes one.
    // Asserted off the CONSTANT rather than off the registration: it is spelled
    // once here and spent once, by the browser half that hangs it in
    // `engine.install`. It rode the server registration too for a revision,
    // read by nothing, which is exactly one authored copy too many.
    expect(INSTALL).toEqual({
      name: "pi",
      where: "https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent",
      why: "put `pi` on this server's PATH — the adapter for it comes with olai",
    })
  })

  test("the standing prompt rides the first turn, like every engine olai ships", () => {
    expect(ENGINE.prompt).toEqual({ kind: "first-turn" })
  })

  test("the plugin's word is the row's id", () => {
    expect(name).toBe("pi")
    expect(ENGINE.name).toBe("pi")
  })
})
