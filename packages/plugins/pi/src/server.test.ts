/**
 * WHAT THIS ENGINE MAKES OF A HOST, over values — and this is the row where
 * that matters most, because it is the PAIR.
 *
 * Starting requires both the pinned adapter and a pi executable. Missing either
 * returns a distinct reason rather than offering an engine that cannot start.
 *
 * IT LIVES HERE and not in `olai-plugin-chat` because the row does: each engine's
 * probe is one plugin’s fact, and what is left in core is ordering and
 * the shape of the reading (`olai-plugin-chat`'s `agents/roster.test.ts`).
 */

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
      // The EXACT executable the probe found — otherwise pi-acp resolves the
      // word `pi` against its child's PATH, which is olai's and no other.
      env: { PI_ACP_PI_COMMAND: "/home/u/.npm-global/bin/pi" },
    })
  })

  test("adapter without agent is the agent's own sentence, not the adapter's", () => {
    // A row that failed at every `session/new` would be offered, which is the
    // one promise the picker may not make. The absence names the half that
    // failed — `pi` is the person's to install — so the sentence a machine
    // without it is owed is the PATH one and not the adapter one.
    expect(ENGINE.at({ env: { [PI_AGENT_ENV]: "/store/bin/pi-acp" }, cwd: CWD, found: nowhere }))
      .toBe(INSTALL)
  })

  test("agent without adapter is the ADAPTER's sentence — a different reason", () => {
    // The variable is the adapter's whole door, the way `OLAI_ACP_AGENT` is the
    // claude row's: a floating `npx -y pi-acp` is never run, because the wire
    // facts this leg is written against are one revision's. TWO ABSENCES, TWO
    // SENTENCES: telling somebody whose pin is unset to go and put `pi` on a
    // PATH would be a remedy that changes nothing, so the arms are told apart.
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
