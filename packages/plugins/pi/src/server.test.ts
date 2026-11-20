import { describe, expect, test } from "bun:test"

import { ENGINE, PI_AGENT_ENV } from "./server.ts"
import { ADAPTER_GONE, INSTALL } from "./install.ts"

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
      env: { PI_ACP_PI_COMMAND: "/home/u/.npm-global/bin/pi" },
    })
  })

  test("adapter without agent is the agent's own sentence, not the adapter's", () => {
    expect(ENGINE.at({ env: { [PI_AGENT_ENV]: "/store/bin/pi-acp" }, cwd: CWD, found: nowhere }))
      .toBe(INSTALL)
  })

  test("agent without adapter is the ADAPTER's sentence — a different reason", () => {
    const at = ENGINE.at({ env: {}, cwd: CWD, found: foundPi })
    expect(at).toBe(ADAPTER_GONE)
    expect(at).not.toBe(INSTALL)
    expect(ADAPTER_GONE.why).not.toBe(INSTALL.why)
  })

  test("the empty adapter variable has the same absence reason as an unset one", () => {
    expect(ENGINE.at({ env: { [PI_AGENT_ENV]: "" }, cwd: CWD, found: foundPi })).toBe(ADAPTER_GONE)
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

})
