/**
 * WHAT THIS ENGINE MAKES OF A HOST, over values.
 *
 * The probe is a pure function of an environment and a lookup
 * (`@olai/acp/engine`'s `Where`), which is the whole reason it is written that
 * way: whether this row is offered depends on a variable and a filesystem, and
 * neither is a thing to arrange in order to check that a hand-rolled start is
 * still an absent row.
 *
 * IT LIVES HERE and not in `@olai/chat` because the row does. The roster's own
 * bench asked all three engines' questions when the three were a table in one
 * core file; each of them is one plugin's fact now, asserted beside the plugin
 * that answers it, and what is left in core is the OFF SWITCH and the shape of
 * the reading (`@olai/chat`'s `agents/roster.test.ts`).
 */

import { AGENT_ENV } from "@olai/acp/engine"
import { describe, expect, test } from "bun:test"

import { name } from "./index.ts"
import { ENGINE } from "./server.ts"
import { INSTALL } from "./install.ts"

const CWD = "/vault"

/** Nothing on the machine's search path — this engine never asks, and the case
 *  below that says so is the point rather than a formality. */
const nowhere = () => null

describe("finding the Claude Code adapter on a host", () => {
  test("the configured ACP agent IS this row", () => {
    expect(
      ENGINE.at({
        env: { [AGENT_ENV]: "/nix/store/x/bin/claude-agent-acp" },
        cwd: CWD,
        found: nowhere,
      }),
    ).toEqual({ command: "/nix/store/x/bin/claude-agent-acp", args: [] })
  })

  test("a command line, not a path: the adapter is often `node <file>`", () => {
    expect(ENGINE.at({ env: { [AGENT_ENV]: "node /a/index.js" }, cwd: CWD, found: nowhere }))
      .toEqual({ command: "node", args: ["/a/index.js"] })
  })

  test("nothing baked in is no row, and NOTHING is looked for on a path", () => {
    // The adapter is a wrapper inside the nix store and is on nobody's PATH, so
    // a probe here would be a lookup that could only ever answer wrongly.
    let probed = false
    const at = ENGINE.at({
      env: {},
      cwd: CWD,
      found: () => {
        probed = true
        return "/usr/bin/claude"
      },
    })
    expect(at).toBeNull()
    expect(probed).toBe(false)
  })

  test("the EMPTY variable is no row here — and core makes it the whole panel", () => {
    // This function answers only about ITS row. That the empty string is the
    // documented off switch for the WHOLE roster is core's reading, taken before
    // anything is probed (`@olai/chat`'s `agents/roster.ts`), and the two agree
    // by construction because both go through the same constant.
    expect(ENGINE.at({ env: { [AGENT_ENV]: "" }, cwd: CWD, found: nowhere })).toBeNull()
  })

  test("what a person is told when this machine has no agent at all", () => {
    // THE PLUGIN'S WHOLE SENTENCE — core displays one and never composes one.
    // Asserted off the CONSTANT rather than off the registration: it is spelled
    // once here and spent once, by the browser half that hangs it in
    // `chat.agent.install`. It rode the server registration too for a revision,
    // read by nothing, which is exactly one authored copy too many.
    expect(INSTALL).toEqual({
      name: "Claude Code",
      where: "https://claude.com/claude-code",
      why: "not found — olai was started without the wrapper that carries the pinned adapter",
    })
  })

  test("the standing prompt rides the first turn, like every engine olai ships", () => {
    expect(ENGINE.prompt).toEqual({ kind: "first-turn" })
  })

  test("the plugin's word is the row's id, and the NAME is not it", () => {
    // The two are separate fields because "Claude Code" is a name rather than
    // the word `claude` with a capital letter — which is the table that used to
    // sit in `@olai/surface` keyed by a closed union.
    expect(name).toBe("claude")
    expect(ENGINE.name).toBe("Claude Code")
  })
})
