/**
 * Opencode's bets, over values — and the fail-safe rule, pinned.
 *
 * The payloads are what opencode 1.17.9 actually sends (the spike,
 * `docs/brainstorming/opencode-chat.md`): call ids of the shape `bash:0` and
 * `olaiprobe_ping:0`, MCP tools named `<server>_<tool>`, permission options
 * that lead with an ALLOW rather than with the refusal, and not one `_meta` on
 * any frame.
 *
 * MOST OF THIS FILE IS ABOUT WHAT MUST NOT HAPPEN, deliberately. `_` is a weak
 * separator, and the rule that reads it is the one rule in this package whose
 * failure is not recoverable by pressing something: an approval nobody gave.
 * So the near misses are the subject — a tool whose prefix is a server we were
 * never given, a name that merely CONTAINS one, a request with no allow in it
 * at all — because they are cheap as values and expensive to stage.
 */

import type { PermissionOption } from "@agentclientprotocol/sdk"
import { describe, expect, test } from "bun:test"

import { allowedWithoutAsking, OPENCODE, toolNameIn } from "./opencode.ts"

/** The servers a session is handed: olai's own, and kolu's when the host has
 *  one. `given` in `agent.ts` is exactly this list of names. */
const GIVEN = ["olai", "kolu"]

/** Opencode's own option list for a tool call, in its own order — ALLOW
 *  FIRST, which is the opposite of the other agent's and the reason nothing
 *  here may read "the first option". */
const ASKED: ReadonlyArray<PermissionOption> = [
  { optionId: "allow_once", name: "Allow once", kind: "allow_once" },
  { optionId: "allow_always", name: "Allow always", kind: "allow_always" },
  { optionId: "reject_once", name: "Reject", kind: "reject_once" },
]

describe("which tool a call is", () => {
  test("is the head of the call id, which is the only name that holds still", () => {
    // The title moves over a call's life — the tool's name, then a sentence
    // about what it is doing, then the tool's name again when it fails. The id
    // is minted once.
    expect(toolNameIn("bash:0")).toBe("bash")
    expect(toolNameIn("olaiprobe_ping:0")).toBe("olaiprobe_ping")
    expect(toolNameIn("read:12")).toBe("read")
  })

  test("takes the FIRST separator, so a colon in a name under-reads", () => {
    // Under-reading a name costs a question; over-reading one could cost an
    // approval.
    expect(toolNameIn("weird:name:0")).toBe("weird")
  })

  test("answers nothing for an id that is not one", () => {
    expect(toolNameIn("bash")).toBeNull()
    expect(toolNameIn(":0")).toBeNull()
    expect(toolNameIn("")).toBeNull()
  })

  test("is what the leg reads, and the leg reads no meta", () => {
    expect(OPENCODE.toolName(undefined, "bash:0")).toBe("bash")
    // A `_meta` cannot make a call something else here — there are none on this
    // wire, and a leg that read one would be reading another agent's.
    expect(OPENCODE.toolName({ claudeCode: { toolName: "Bash" } }, "bash:0")).toBe("bash")
  })
})

describe("which permissions are answered without asking", () => {
  test("a tool of a server we handed this session is allowed", () => {
    expect(allowedWithoutAsking("olai_set_done", GIVEN, ASKED)).toBe("allow_once")
    expect(allowedWithoutAsking("kolu_terminal_open", GIVEN, ASKED)).toBe("allow_once")
  })

  test("and NOTHING else is — this is the line that must never widen", () => {
    // A server we were never given.
    expect(allowedWithoutAsking("other_read", GIVEN, ASKED)).toBeNull()
    // A builtin whose name merely CONTAINS one of ours.
    expect(allowedWithoutAsking("read_olai_file", GIVEN, ASKED)).toBeNull()
    // The server's bare name, with no tool after the separator this rule
    // requires — `startsWith(server)` would take it, `startsWith(server + "_")`
    // does not.
    expect(allowedWithoutAsking("olai", GIVEN, ASKED)).toBeNull()
    // A name that is a prefix of ours rather than the other way round.
    expect(allowedWithoutAsking("ola_i_read", GIVEN, ASKED)).toBeNull()
    // An ordinary builtin.
    expect(allowedWithoutAsking("bash", GIVEN, ASKED)).toBeNull()
    // A tool that looks like the OTHER agent's spelling.
    expect(allowedWithoutAsking("mcp__olai__set_done", GIVEN, ASKED)).toBeNull()
  })

  test("a call nobody named is a call a person is asked about", () => {
    expect(allowedWithoutAsking(null, GIVEN, ASKED)).toBeNull()
  })

  test("with no servers handed over, nothing is ours", () => {
    expect(allowedWithoutAsking("olai_set_done", [], ASKED)).toBeNull()
  })

  test("the option is chosen by its KIND, not by its place in the list", () => {
    // Opencode leads with an allow and the Claude adapter leads with the
    // refusal; one rule, read off `kind`, is right on both wires.
    const refusalFirst: ReadonlyArray<PermissionOption> = [
      { optionId: "no", name: "Reject", kind: "reject_once" },
      { optionId: "yes", name: "Allow", kind: "allow_always" },
    ]
    expect(allowedWithoutAsking("olai_add_node", GIVEN, refusalFirst)).toBe("yes")
  })

  test("one of ours with no allow offered at all is still a person's", () => {
    const refusalsOnly: ReadonlyArray<PermissionOption> = [
      { optionId: "no", name: "Reject", kind: "reject_once" },
    ]
    expect(allowedWithoutAsking("olai_add_node", GIVEN, refusalsOnly)).toBeNull()
  })
})

describe("what opencode does not do", () => {
  test("carries no attribution, so nothing is drawn in a subagent's name", () => {
    expect(OPENCODE.parentToolUse({ claudeCode: { parentToolUseId: "toolu_1" } })).toBeNull()
    expect(OPENCODE.spawned({ claudeCode: { subagent: true } }, { subagent_type: "Explore" }))
      .toBeNull()
  })

  test("has no bypass mode to ask for and no way to steer a running turn", () => {
    // Both are requests opencode refuses (`-32602` and `-32601`), so olai sends
    // neither — see the leg. `null` here is what stops them being sent.
    expect(OPENCODE.bypassMode).toBeNull()
    expect(OPENCODE.steering).toBeNull()
  })

  test("forwards no messages of its own", () => {
    // Its settings come back in method RESPONSES; nothing is pushed.
    expect(OPENCODE.rawMessages).toBeNull()
  })
})
