/**
 * The adapter's bets, over values.
 *
 * These are the payloads the pinned Claude Code adapter (0.66.0) actually
 * sends — the plan-mode permission request whose first allow-flavoured option
 * switches the session to `auto`, an ops call announced with its programmatic
 * name in `_meta`, the CLI `init` message a `/model` produces — and the point
 * of {@link ./interpret.ts} being pure is that the rule which tells them apart
 * is asserted HERE, on a value, rather than through a subprocess that has to be
 * talked into asking.
 *
 * The e2e suite drives the same two requests through a real agent
 * (`packages/tests/agent/fake-acp-agent.ts`, the `plan` and `permit` verbs) and
 * stays the regression net for the wiring. What it cannot do cheaply is the
 * near misses: a server we were not given, a name one character off the prefix,
 * a `_meta` from some other agent.
 */

import type { PermissionOption, SessionConfigOption } from "@agentclientprotocol/sdk"
import { describe, expect, test } from "bun:test"

import {
  allowedWithoutAsking,
  labelsOf,
  liveModelIn,
  NEW_SESSION_META,
  SDK_MESSAGE,
  toolNameIn,
} from "./interpret.ts"

/** The servers a session is handed: olai's own, and kolu's when the host has
 *  one. `given` in `agent.ts` is exactly this list of names. */
const GIVEN = ["olai", "kolu"]

/**
 * The adapter's plan-mode exit, as it builds it: `auto` FIRST and
 * allow-flavoured, which is the option a client answering by machine picked —
 * silently switching the session's permission mode — for as long as this panel
 * answered these itself.
 *
 * The real list is filtered against the session's available modes and can lead
 * with `bypassPermissions`, so a session may see fewer of these or one more.
 * What does not vary is that the first entry is an allow.
 */
const EXIT_PLAN_MODE: ReadonlyArray<PermissionOption> = [
  { kind: "allow_always", name: 'Yes, and use "auto" mode', optionId: "auto" },
  { kind: "allow_always", name: "Yes, and auto-accept edits", optionId: "acceptEdits" },
  { kind: "allow_once", name: "Yes, and manually approve edits", optionId: "default" },
  { kind: "reject_once", name: "No, keep planning", optionId: "plan" },
]

/** The ordinary list for a tool call, which leads with the REFUSAL — so
 *  "the allow-flavoured one" and "the first one" are different answers. */
const TOOL_CALL: ReadonlyArray<PermissionOption> = [
  { kind: "reject_once", name: "Deny", optionId: "reject" },
  { kind: "allow_once", name: "Allow Once", optionId: "allow" },
]

describe("which permissions are answered without asking", () => {
  test("a call to a server we handed this session is allowed", () => {
    expect(allowedWithoutAsking("mcp__olai__set_done", GIVEN, TOOL_CALL)).toBe("allow")
    expect(allowedWithoutAsking("mcp__kolu__terminal_read", GIVEN, TOOL_CALL)).toBe("allow")
  })

  test("the plan-mode exit is a person's, whatever its first option offers", () => {
    // The one that matters. `auto` is first and allow-flavoured, and answering
    // it is switching the session's permission mode on somebody's behalf.
    expect(allowedWithoutAsking("ExitPlanMode", GIVEN, EXIT_PLAN_MODE)).toBeNull()
  })

  test("a tool nothing named is a person's, not a guess", () => {
    // No `_meta`, no announcement to have learned the name from. The request
    // still leads with an allow, and that is still not this panel's to press.
    expect(allowedWithoutAsking(null, GIVEN, EXIT_PLAN_MODE)).toBeNull()
    expect(allowedWithoutAsking(null, GIVEN, TOOL_CALL)).toBeNull()
  })

  test("a built-in tool of the agent's own is a person's", () => {
    expect(allowedWithoutAsking("Bash", GIVEN, TOOL_CALL)).toBeNull()
    expect(allowedWithoutAsking("Write", GIVEN, TOOL_CALL)).toBeNull()
  })

  test("an MCP server we did not hand this session is a person's", () => {
    // Recognition is positive and it is of OURS: an MCP tool is not trusted for
    // being an MCP tool. A padi-attached server, a `.mcp.json` the agent read
    // for itself — none of those were olai's to mediate.
    expect(allowedWithoutAsking("mcp__github__create_pr", GIVEN, TOOL_CALL)).toBeNull()
    expect(allowedWithoutAsking("mcp__olai__set_done", [], TOOL_CALL)).toBeNull()
    expect(allowedWithoutAsking("mcp__olai__set_done", ["kolu"], TOOL_CALL)).toBeNull()
  })

  test("the separator is part of the name, so a longer server name is not ours", () => {
    // `mcp__olai__` and not `mcp__olai`: a server called `olaiplus` shares a
    // prefix with ours and is not ours.
    expect(allowedWithoutAsking("mcp__olaiplus__set_done", GIVEN, TOOL_CALL)).toBeNull()
    expect(allowedWithoutAsking("olai__set_done", GIVEN, TOOL_CALL)).toBeNull()
  })

  test("an agent that names its MCP tools some other way asks a person", () => {
    // The bet on the adapter's naming, losing in the direction it can afford.
    expect(allowedWithoutAsking("olai/set_done", GIVEN, TOOL_CALL)).toBeNull()
    expect(allowedWithoutAsking("set_done", GIVEN, TOOL_CALL)).toBeNull()
  })

  test("one of ours that offers no allow at all is a person's", () => {
    // Nothing is invented to answer with, and a refusal is certainly not
    // pressed on somebody's behalf either.
    const refusals: ReadonlyArray<PermissionOption> = [
      { kind: "reject_once", name: "Deny", optionId: "reject" },
      { kind: "reject_always", name: "Deny, and stop asking", optionId: "rejectAlways" },
    ]
    expect(allowedWithoutAsking("mcp__olai__set_done", GIVEN, refusals)).toBeNull()
    expect(allowedWithoutAsking("mcp__olai__set_done", GIVEN, [])).toBeNull()
  })

  test("the allow is the allow-flavoured one, not the first one", () => {
    // Both kinds count as an allow, and the order is the agent's own.
    expect(allowedWithoutAsking("mcp__olai__set_done", GIVEN, [
      { kind: "reject_once", name: "Deny", optionId: "reject" },
      { kind: "allow_always", name: "Allow Always", optionId: "allowAlways" },
      { kind: "allow_once", name: "Allow Once", optionId: "allow" },
    ])).toBe("allowAlways")
  })
})

describe("which tool a call is", () => {
  test("the adapter's `_meta` carries the programmatic name", () => {
    // What a `tool_call` announcement looks like: the permission request that
    // follows it says "Ready to code?" or a display title, and this is the
    // question the answer turns on.
    expect(toolNameIn({ claudeCode: { toolName: "mcp__olai__set_done" } }))
      .toBe("mcp__olai__set_done")
    expect(toolNameIn({ claudeCode: { toolName: "ExitPlanMode" } })).toBe("ExitPlanMode")
  })

  test("an agent that said nothing is a name we do not know", () => {
    expect(toolNameIn(undefined)).toBeNull()
    expect(toolNameIn(null)).toBeNull()
    expect(toolNameIn({})).toBeNull()
    expect(toolNameIn({ someOtherAgent: { toolName: "Bash" } })).toBeNull()
  })

  test("a `_meta` that is there but says nothing usable is the same no", () => {
    // Somebody else's extension, a shape that moved, an empty string: all of
    // them are "we cannot name this tool", which is answered by asking.
    expect(toolNameIn({ claudeCode: {} })).toBeNull()
    expect(toolNameIn({ claudeCode: { toolName: "" } })).toBeNull()
    expect(toolNameIn({ claudeCode: { toolName: 7 } })).toBeNull()
    expect(toolNameIn({ claudeCode: { toolName: null } })).toBeNull()
    expect(toolNameIn({ claudeCode: "mcp__olai__set_done" })).toBeNull()
    expect(toolNameIn({ claudeCode: null })).toBeNull()
  })

  test("an unnameable tool and a plan exit are the same answer downstream", () => {
    // The pair the whole rule rests on, read end to end: what `_meta` says, put
    // through the decision. Neither is bypassed.
    const named = { claudeCode: { toolName: "mcp__olai__set_done" } }
    expect(allowedWithoutAsking(toolNameIn(named), GIVEN, TOOL_CALL)).toBe("allow")
    expect(allowedWithoutAsking(toolNameIn({}), GIVEN, TOOL_CALL)).toBeNull()
    expect(
      allowedWithoutAsking(
        toolNameIn({ claudeCode: { toolName: "ExitPlanMode" } }),
        GIVEN,
        EXIT_PLAN_MODE,
      ),
    ).toBeNull()
  })
})

describe("which model a turn is running on", () => {
  /** What the adapter forwards under {@link SDK_MESSAGE}, having been asked to
   *  by {@link NEW_SESSION_META}: the CLI's own `init`, verbatim, with the
   *  sessionId the notification carries. */
  const init = (model: unknown) => ({
    sessionId: "s1",
    message: { type: "system", subtype: "init", model, cwd: "/srv/outlines" },
  })

  test("the `init` message names the model the CLI is running", () => {
    expect(liveModelIn(init("claude-opus-4-5"))).toBe("claude-opus-4-5")
  })

  test("what we asked to be forwarded is what is read", () => {
    // The ask and the read are one bet, so they are written down together: a
    // subtype nobody subscribed to would arrive under a different filter.
    expect(NEW_SESSION_META.claudeCode.emitRawSDKMessages).toEqual([
      { type: "system", subtype: "init" },
    ])
    expect(SDK_MESSAGE).toBe("_claude/sdkMessage")
  })

  test("another message of the CLI's is not a model", () => {
    // Only `system`/`init` carries it. A result, an assistant turn, a system
    // message of some other subtype: all say nothing about which model is
    // running, and a field lifted out of one would be a guess.
    expect(liveModelIn({ message: { type: "result", subtype: "success", model: "x" } }))
      .toBeNull()
    expect(liveModelIn({ message: { type: "system", subtype: "compact", model: "x" } }))
      .toBeNull()
    expect(liveModelIn({ message: { type: "assistant", model: "x" } })).toBeNull()
  })

  test("a message that says nothing readable leaves the model alone", () => {
    expect(liveModelIn(init(undefined))).toBeNull()
    expect(liveModelIn(init(""))).toBeNull()
    expect(liveModelIn(init(42))).toBeNull()
    expect(liveModelIn({ sessionId: "s1" })).toBeNull()
    expect(liveModelIn({ message: "system init" })).toBeNull()
    expect(liveModelIn({ message: null })).toBeNull()
    expect(liveModelIn(null)).toBeNull()
    expect(liveModelIn(undefined)).toBeNull()
  })
})

describe("the picker, as labels", () => {
  const select = (
    options: Extract<SessionConfigOption, { type: "select" }>["options"],
  ): Extract<SessionConfigOption, { type: "select" }> => ({
    id: "model",
    name: "Model",
    type: "select",
    currentValue: "claude-opus-4-5",
    options,
  })

  test("a flat picker is value → label", () => {
    const labels = labelsOf(select([
      { value: "claude-opus-4-5", name: "Opus" },
      { value: "claude-sonnet-4-5", name: "Sonnet" },
    ]))
    expect(labels.get("claude-opus-4-5")).toBe("Opus")
    expect(labels.get("claude-sonnet-4-5")).toBe("Sonnet")
    expect(labels.size).toBe(2)
  })

  test("a grouped picker is read through its groups", () => {
    // The protocol tells a group from an option by SHAPE rather than by a tag,
    // and the adapter groups its models by tier.
    const labels = labelsOf(select([
      {
        group: "latest",
        name: "Latest",
        options: [
          { value: "claude-opus-4-5", name: "Opus" },
          { value: "claude-fable-5", name: "Fable" },
        ],
      },
      {
        group: "legacy",
        name: "Legacy",
        options: [{ value: "claude-sonnet-4-0", name: "Sonnet 4" }],
      },
    ]))
    expect([...labels]).toEqual([
      ["claude-opus-4-5", "Opus"],
      ["claude-fable-5", "Fable"],
      ["claude-sonnet-4-0", "Sonnet 4"],
    ])
  })

  test("a live id the picker does not offer is absent rather than approximated", () => {
    // Which is what lets the caller keep the raw id and say so: a nearest match
    // onto a nearby row would be a model name nobody reported.
    const labels = labelsOf(select([{ value: "claude-opus-4-5", name: "Opus" }]))
    expect(labels.get("claude-opus-4-5-20260101")).toBeUndefined()
    expect(labelsOf(select([])).size).toBe(0)
  })
})
