/**
 * The adapter's bets, over values.
 *
 * The payloads here are what the pinned Claude Code adapter (0.66.0) actually
 * sends: the plan-mode permission request whose first allow-flavoured option
 * switches the session to `auto`, an ops call announced with its programmatic
 * name in `_meta`, the CLI `init` message a `/model` produces. Why any of that
 * is worth a unit test rather than a scenario is {@link ./interpret.ts}'s own
 * argument; what this file adds is the near misses, which are cheap as values
 * and expensive to stage — a server we were not given, a name one character off
 * the prefix, a `_meta` from some other agent.
 *
 * The e2e suite drives the same two permission requests through a real agent
 * (`packages/tests/agent/fake-acp-agent.ts`, the `plan` and `permit` verbs) and
 * stays the regression net for the wiring.
 */

import type { PermissionOption, SessionConfigOption } from "@agentclientprotocol/sdk"
import { describe, expect, test } from "bun:test"

import {
  allowedWithoutAsking,
  liveModelIn,
  modelNameIn,
  modelPickerIn,
  NEW_SESSION_META,
  parentToolUseIn,
  STEER_METHOD,
  STEER_WHEN_IDLE,
  steerTaken,
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

describe("steering a turn that is already running", () => {
  test("the method and the idle behaviour are the wire's own spellings", () => {
    // Two literals the adapter matches EXACTLY — an underscore or a casing off
    // and the request is a method the agent has never heard of, which is a
    // refusal per mid-turn message and no other symptom.
    expect(STEER_METHOD).toBe("_session/steering")
    // Without the opt-in a steer against an idle agent starts a DETACHED turn
    // olai never asked for, never tracks and cannot cancel. The literal is
    // what buys the message back instead.
    expect(STEER_WHEN_IDLE).toEqual({ steering: { idleBehavior: "promptRequired" } })
  })

  test("`injected` is the answer that means the running turn has it", () => {
    // What the adapter actually answered, captured against 0.66.0 by steering
    // a turn that was counting to 600: it took the message at 28.
    expect(steerTaken({ outcome: "injected" })).toBe(true)
  })

  test("nothing was running, so the caller still has the message", () => {
    // The opt-in's whole purpose. Read as taken, this would be the one message
    // in the conversation that exists on screen and nowhere else.
    expect(steerTaken({ outcome: "promptRequired", reason: "noRunningTurn" })).toBe(false)
  })

  test("an outcome nobody here knows is NOT taken", () => {
    // The losing direction, chosen: a message the agent hears twice beats a
    // message nobody has. `startedNewTurn` is the extension's own legacy
    // answer for a host that did not opt in — a turn olai never asked for and
    // could not cancel, so not taken is also the truthful reading of it.
    expect(steerTaken({ outcome: "startedNewTurn" })).toBe(false)
    expect(steerTaken({ outcome: "somethingLater" })).toBe(false)
    expect(steerTaken({})).toBe(false)
    expect(steerTaken(null)).toBe(false)
    expect(steerTaken(undefined)).toBe(false)
    // Truthy is not the word: an agent answering `outcome: true` said
    // something, and it did not say `injected`.
    expect(steerTaken({ outcome: true })).toBe(false)
  })
})

describe("which agent made a call", () => {
  test("a subagent's frame names the Agent call that spawned it", () => {
    // What the adapter stamps onto every frame that comes out of a spawned
    // task: the id of the `Agent`/`Task` tool call it was started by.
    expect(parentToolUseIn({ claudeCode: { parentToolUseId: "toolu_01AGENT" } }))
      .toBe("toolu_01AGENT")
  })

  test("the two readings of one `_meta` are independent", () => {
    // A frame carries either, both or neither, and the adapter sends all three
    // shapes: a streamed subagent `tool_call` carries the name AND the parent,
    // its terminal output carries only the parent, and a plan exit only the
    // name. Neither reader may need the other to be there.
    const both = { claudeCode: { toolName: "Bash", parentToolUseId: "toolu_01AGENT" } }
    expect(toolNameIn(both)).toBe("Bash")
    expect(parentToolUseIn(both)).toBe("toolu_01AGENT")
    expect(toolNameIn({ claudeCode: { parentToolUseId: "toolu_01AGENT" } })).toBeNull()
    expect(parentToolUseIn({ claudeCode: { toolName: "Bash" } })).toBeNull()
  })

  test("a frame that says nothing is the main agent's own", () => {
    // The losing direction this can afford: an agent that is not that adapter
    // has no subagents as far as the panel is concerned, and the transcript
    // looks exactly as it did before any of this was read.
    expect(parentToolUseIn(undefined)).toBeNull()
    expect(parentToolUseIn(null)).toBeNull()
    expect(parentToolUseIn({})).toBeNull()
    expect(parentToolUseIn({ someOtherAgent: { parentToolUseId: "x" } })).toBeNull()
    expect(parentToolUseIn({ claudeCode: {} })).toBeNull()
    expect(parentToolUseIn({ claudeCode: { parentToolUseId: "" } })).toBeNull()
    expect(parentToolUseIn({ claudeCode: { parentToolUseId: 7 } })).toBeNull()
    expect(parentToolUseIn({ claudeCode: null })).toBeNull()
    expect(parentToolUseIn({ claudeCode: "toolu_01AGENT" })).toBeNull()
  })
})

describe("which model a turn is running on", () => {
  /** What the adapter forwards under `_claude/sdkMessage`, having been asked to
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
    // The ask and the read are one bet, so the message is built out of the
    // filter we subscribed with: a reader that drifted from the subscription
    // would go quiet on exactly the messages the adapter still sends.
    const [subscribed] = NEW_SESSION_META.claudeCode.emitRawSDKMessages
    expect(liveModelIn({ message: { ...subscribed, model: "claude-opus-4-5" } }))
      .toBe("claude-opus-4-5")
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

describe("which config option is the model, and what it calls its values", () => {
  const picker = (
    options: Extract<SessionConfigOption, { type: "select" }>["options"],
  ): ReadonlyArray<SessionConfigOption> => [
    { id: "mode", name: "Mode", type: "select", currentValue: "plan", options: [] },
    { id: "model", name: "Model", type: "select", currentValue: "claude-opus-4-5", options },
  ]

  const labelsIn = (options: Extract<SessionConfigOption, { type: "select" }>["options"]) => {
    const read = modelPickerIn(picker(options))
    if (read === null) throw new Error("no model picker")
    return read.labels
  }

  test("the picked value is what the session says it is picking", () => {
    expect(modelPickerIn(picker([{ value: "claude-opus-4-5", name: "Opus" }])))
      .toMatchObject({ picked: "claude-opus-4-5" })
  })

  test("a flat picker is value → label", () => {
    const labels = labelsIn([
      { value: "claude-opus-4-5", name: "Opus" },
      { value: "claude-sonnet-4-5", name: "Sonnet" },
    ])
    expect(labels.get("claude-opus-4-5")).toBe("Opus")
    expect(labels.get("claude-sonnet-4-5")).toBe("Sonnet")
    expect(labels.size).toBe(2)
  })

  test("a grouped picker is read through its groups", () => {
    // The protocol tells a group from an option by SHAPE rather than by a tag,
    // and the adapter groups its models by tier.
    const labels = labelsIn([
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
    ])
    expect([...labels]).toEqual([
      ["claude-opus-4-5", "Opus"],
      ["claude-fable-5", "Fable"],
      ["claude-sonnet-4-0", "Sonnet 4"],
    ])
  })

  test("a live id the picker does not offer is absent rather than approximated", () => {
    // Which is what lets the caller keep the raw id and say so: a nearest match
    // onto a nearby row would be a model name nobody reported.
    expect(labelsIn([{ value: "claude-opus-4-5", name: "Opus" }])
      .get("claude-opus-4-5-20260101")).toBeUndefined()
    expect(labelsIn([]).size).toBe(0)
  })

  test("a session with no picker this adapter's shape leaves the model alone", () => {
    // `id === "model"` is the adapter's own spelling — ACP's only reserved hint
    // is `category`, and it says itself that it is UX-only. An agent that
    // spells the entry differently, or answers with something that is not a
    // select, costs the header a name and nothing else.
    expect(modelPickerIn(undefined)).toBeNull()
    expect(modelPickerIn([])).toBeNull()
    expect(modelPickerIn([
      { id: "model_id", name: "Model", type: "select", currentValue: "x", options: [] },
    ])).toBeNull()
    expect(modelPickerIn([{ id: "model", name: "Model", type: "boolean", currentValue: true }]))
      .toBeNull()
  })
})

describe("what the agent calls the model it is running", () => {
  /** The picker the pinned adapter (0.66.0) actually sent, captured off the
   *  wire. Every value in it is an ALIAS — this is the whole reason the lookup
   *  needs a rule rather than a `Map.get`. */
  const OFFERED = new Map([
    ["default", "Default (recommended)"],
    ["opus[1m]", "Opus (1M context)"],
    ["claude-fable-5[1m]", "Fable"],
    ["sonnet", "Sonnet"],
    ["haiku", "Haiku"],
  ])

  test("a picked value is itself, which is the case that always worked", () => {
    expect(modelNameIn(OFFERED, "sonnet")).toBe("Sonnet")
    expect(modelNameIn(OFFERED, "claude-fable-5[1m]")).toBe("Fable")
    expect(modelNameIn(OFFERED, "default")).toBe("Default (recommended)")
  })

  test("the same model in the adapter's two spellings of a context lane", () => {
    // What the session came up on: the picker said `claude-fable-5[1m]` and the
    // CLI's `init` said `claude-fable-5`. One model, two spellings, and reading
    // them as two was the header changing its language mid-session.
    expect(modelNameIn(OFFERED, "claude-fable-5")).toBe("Fable")
    // The other spelling of the same hint, which the adapter treats as equal.
    expect(modelNameIn(OFFERED, "claude-fable-5-1m")).toBe("Fable")
  })

  test("a live API id lands on the alias row that names it", () => {
    // The bug, as three lines. After a `/model`, the next turn's `init` reports
    // the concrete API id; the picker offers only the alias. The header used to
    // give up and print the id.
    expect(modelNameIn(OFFERED, "claude-sonnet-5")).toBe("Sonnet")
    expect(modelNameIn(OFFERED, "claude-haiku-4-5")).toBe("Haiku")
  })

  test("a family alias does not lend the live id a context lane it never stated", () => {
    // Constructed against the real adapter in review, not imagined: `/model
    // claude-opus-4-5` runs a 200k session, the live id arrives laneless, and
    // the picker's only Opus row is the 1M one. Answering it named a context
    // window five times the real one — in the header a person reads to decide
    // whether to `/compact`, which is the one question that number is for.
    //
    // The raw id claims nothing, and claiming nothing is the truthful answer to
    // a lane the CLI did not report.
    expect(modelNameIn(OFFERED, "claude-opus-4-5")).toBeNull()
    expect(modelNameIn(OFFERED, "claude-opus-5")).toBeNull()
    // A LANELESS Opus row answers it, because then nothing is being added.
    const plain = new Map([...OFFERED, ["opus", "Opus"]])
    plain.delete("opus[1m]")
    expect(modelNameIn(plain, "claude-opus-5")).toBe("Opus")
  })

  test("tier 2 is an identity, so the adapter's own two spellings still meet", () => {
    // Not the same claim as the alias tier above, and the difference is why
    // this one is allowed to cross a lane spelling: `claude-fable-5[1m]` and
    // `claude-fable-5` are ONE id written the adapter's two ways
    // (`canonicalizeModelId` is its own equality), not a family and a guess at
    // which member of it. Refusing here would have flipped the header from
    // "Fable" to a raw id on the first turn of every session.
    expect(modelNameIn(OFFERED, "claude-fable-5")).toBe("Fable")
  })

  test("`default` names no model, so nothing resolves onto it", () => {
    // It is the adapter's word for "whichever one the CLI recommends today".
    // It is also a bare word sitting in the alias tier, so it has to be said
    // rather than assumed.
    expect(modelNameIn(new Map([["default", "Default (recommended)"]]), "claude-opus-5"))
      .toBeNull()
    expect(modelNameIn(new Map([["default", "Default (recommended)"]]), "default-5"))
      .toBeNull()
  })

  test("two lanes on offer is answered by the one the live id is in", () => {
    // A picker offering a bare `sonnet` and a `sonnet[1m]` is offering two
    // context lanes. The live id states none, so it is the LANELESS row — and
    // saying "Sonnet" adds nothing to what the CLI reported, where naming the
    // 1M row would have.
    const both = new Map([["sonnet", "Sonnet"], ["sonnet[1m]", "Sonnet (1M context)"]])
    expect(modelNameIn(both, "claude-sonnet-5")).toBe("Sonnet")
  })

  test("two rows that could both be it is a question this does not answer", () => {
    // Tier 2, where the lane rule cannot help: two values that are one id in
    // the adapter's two spellings of the SAME lane. Nothing tells them apart,
    // so nothing is said.
    const lanes = new Map([
      ["claude-opus-5[1m]", "Opus (1M context)"],
      ["claude-opus-5-1m", "Opus, again"],
    ])
    expect(modelNameIn(lanes, "claude-opus-5")).toBeNull()
    // ... and the same refusal a tier down, on two spellings of one family.
    const cased = new Map([["sonnet", "Sonnet"], ["SONNET", "Sonnet, shouting"]])
    expect(modelNameIn(cased, "claude-sonnet-5")).toBeNull()
  })

  test("nothing is approximated onto a row that is merely nearby", () => {
    // The rule the picker's own note has always stated, and it still holds:
    // these are exact comparisons, and a model this picker does not offer is
    // reported raw by the caller rather than rounded to a neighbour.
    expect(modelNameIn(OFFERED, "gpt-5")).toBeNull()
    expect(modelNameIn(OFFERED, "claude-opus-4-5-20260101")).toBeNull()
    // A multi-word value never plays in the alias tier: `claude-sonnet-4-5` is
    // not what `claude-sonnet-5` says it is, however much of it overlaps.
    expect(modelNameIn(new Map([["claude-sonnet-4-5", "Sonnet 4.5"]]), "claude-sonnet-5"))
      .toBeNull()
    expect(modelNameIn(new Map(), "claude-sonnet-5")).toBeNull()
    expect(modelNameIn(OFFERED, "")).toBeNull()
  })
})
