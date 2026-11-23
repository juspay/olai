/**
 * WHAT THIS ENGINE MAKES OF A HOST, over values.
 *
 * The probe is a pure function of an environment and a lookup
 * (`@kolu/acp/engine`'s `Where`), which is the whole reason it is written that
 * way: whether this row is offered depends on a variable and a filesystem, and
 * neither is a thing to arrange in order to check that a hand-rolled start is
 * still an absent row.
 *
 * IT LIVES HERE and not in `olai-plugin-chat` because the row does. The roster's own
 * bench asked all three engines' questions when the three were a table in one
 * core file; each of them is one plugin's fact now, asserted beside the plugin
 * that answers it, and what is left in core is ordering and the shape of
 * the reading (`olai-plugin-chat`'s `agents/roster.test.ts`).
 */

import { AGENT_ENV } from "@kolu/acp/engine"
import { describe, expect, test } from "bun:test"

import { CLAUDE, LAUNCHER_SETTINGS, REMOTE_SIGNALS } from "@kolu/acp-claude"
import { DISABLE_AUTO_MEMORY_ENV, ENGINE } from "./server.ts"
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
    ).toEqual({
      command: "/nix/store/x/bin/claude-agent-acp",
      args: [],
      // THE ADAPTER'S OWN MEMORY IS SWITCHED OFF, and the five variables the
      // adapter guesses from are taken away from every spawn of it: olai runs
      // the far end of a browser, and the node's subtree is the only memory
      // ({@link DISABLE_AUTO_MEMORY_ENV}, and `olai-plugin-chat`'s `agent.ts`
      // for what the removal does for a sign-in).
      env: { [DISABLE_AUTO_MEMORY_ENV]: "1" },
      unset: REMOTE_SIGNALS,
    })
  })

  test("the adapter's own memory is switched OFF on every spawn", () => {
    // The node's subtree is the only memory; a second one the panel cannot
    // see would drift from it. The env var wins over `autoMemoryEnabled` in
    // the adapter's `settings.json`, and an operator's contrary export loses
    // on purpose — the return value here is unconditional.
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
    // The adapter is a wrapper inside the nix store and is on nobody's PATH, so
    // a probe here would be a lookup that could only ever answer wrongly. The
    // answer is the INSTALL sentence rather than a dropped row: the roster
    // publishes the absence, the picker draws it greyed.
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
    // ASSERTED BY NAME, because the whole value of the list is that it is those
    // five: `acp-agent.js` (0.81.2) computes `isRemote` from exactly these, and
    // a sixth added or one dropped is a change in which login methods the
    // adapter offers (`olai-plugin-chat`'s `agent.ts` is where that is drawn).
    expect([...REMOTE_SIGNALS].sort()).toEqual([
      "CLAUDE_CODE_REMOTE",
      "NO_BROWSER",
      "SSH_CLIENT",
      "SSH_CONNECTION",
      "SSH_TTY",
    ])
  })

  test("an empty adapter path leaves this engine unavailable, saying so", () => {
    // This engine cannot start without its adapter; other engines decide independently.
    expect(ENGINE.at({ env: { [AGENT_ENV]: "" }, cwd: CWD, found: nowhere })).toBe(INSTALL)
  })

})

describe("telling Claude Code where to compact", () => {
  const compacting = ENGINE.compacting
  if (compacting === undefined) throw new Error("the Claude engine must say how it is told where to compact")

  test("the session open turns auto-compaction on at the number, beside the raw-message subscription", () => {
    const { leg } = compacting(200_000)
    // THE WINDOW IS THE NUMBER PLUS kolu's 33k RESERVE, measured on the pinned
    // pair: Claude Code fires that far below the window it is given. THE
    // LAUNCHER'S OWN SETTINGS RIDE BESIDE IT, because session settings replace
    // the `--settings` agent-distro's `claude` was launched with: said again,
    // or lost while compaction is on.
    expect(leg.rawMessages?.openMeta).toEqual({
      claudeCode: {
        ...(CLAUDE.rawMessages?.openMeta["claudeCode"] as object),
        options: { settings: { ...LAUNCHER_SETTINGS, autoCompactEnabled: true, autoCompactWindow: 233_000 } },
      },
    })
    expect(compacting(500_000).leg.rawMessages?.openMeta).toMatchObject({
      claudeCode: { options: { settings: { autoCompactWindow: 533_000 } } },
    })
    // ... AND EVERYTHING ELSE IS THE REGISTERED LEG'S, so the panel reads this
    // agent's wire exactly as it did: the same forwarded-message channel and
    // the same readers off it.
    expect(leg.rawMessages?.method).toBe(CLAUDE.rawMessages?.method)
    expect(leg.rawMessages?.modelIn).toBe(CLAUDE.rawMessages?.modelIn)
    expect(leg.rawMessages?.serversIn).toBe(CLAUDE.rawMessages?.serversIn)
    expect(leg.models).toBe(CLAUDE.models)
    expect(ENGINE.leg).toBe(CLAUDE)
  })

  test("compaction reports are not asked for, so a compaction stays the tool row the panel draws", () => {
    // Asked for, the adapter sends `compaction_update` frames instead of its
    // "Compact conversation" tool call, and the chat passes nothing that draws
    // them: a compaction would vanish from the transcript.
    expect(compacting(200_000).leg.compaction).toBeFalsy()
  })

  test("the variables that would override the number are taken from the spawn", () => {
    expect([...compacting(200_000).unset].sort()).toEqual([
      "CLAUDE_AUTOCOMPACT_PCT_OVERRIDE",
      "CLAUDE_CODE_AUTO_COMPACT_WINDOW",
      "DISABLE_AUTO_COMPACT",
      "DISABLE_COMPACT",
    ])
  })
})
