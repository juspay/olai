/**
 * The adapter's bets, over values.
 *
 * The payloads here are what the pinned Claude Code adapter (0.66.0) actually
 * sends: the plan-mode permission request whose first allow-flavoured option
 * switches the session to `auto`, an ops call announced with its programmatic
 * name in `_meta`, the CLI `init` message a `/model` produces. Why any of that
 * is worth a unit test rather than a scenario is {@link ./claude.ts}'s own
 * argument; what this file adds is the near misses, which are cheap as values
 * and expensive to stage — a server we were not given, a name one character off
 * the prefix, a `_meta` from some other agent.
 *
 * The e2e suite drives the same two permission requests through a real agent
 * (`packages/tests/agent/fake-acp-agent.ts`, the `plan` and `permit` verbs) and
 * stays the regression net for the wiring.
 */

import type { PermissionOption } from "@agentclientprotocol/sdk"
import { describe, expect, test } from "bun:test"

import {
  allowedWithoutAsking,
  CLAUDE,
  liveModelIn,
  liveServersIn,
  OPEN_SESSION_META,
  parentToolUseIn,
  spawnedIn,
  STEER_METHOD,
  STEER_WHEN_IDLE,
  steerTaken,
  toolNameIn,
} from "./claude.ts"

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

describe("which call started an agent", () => {
  /** The spawn's own frame, as the adapter builds one: the flag beside the
   *  tool name (`claudeCodeMetaFromToolUse`), and the `Agent` tool's own
   *  arguments as `rawInput`. */
  const SPAWN = { claudeCode: { toolName: "Agent", subagent: true } }
  const ASKED = {
    description: "explore the outline",
    prompt: "read every note and report back",
    subagent_type: "Explore",
  }
  test("the spawn's own frame says an agent was sent out, and which kind", () => {
    // The whole point of reading this rather than waiting for the parent
    // stamp: it is on the frame that ANNOUNCES the spawn, so it is known
    // before the agent has done anything anybody could draw.
    expect(spawnedIn(SPAWN, ASKED)).toEqual({ kind: "Explore" })
    // ... and what says so is the FLAG rather than the tool name, which the
    // adapter maps two of its own words onto.
    expect(spawnedIn({ claudeCode: { toolName: "Task", subagent: true } }, {}))
      .toEqual({})
  })

  test("a call nobody flagged is no spawn, whatever its ARGUMENTS are called", () => {
    // The tools on a session are not a closed set: `subagent_type` is a name
    // the `Agent` tool gives one of ITS arguments, and an MCP server olai
    // never handed this conversation is free to take one by the same name. A
    // reader that trusted any `rawInput` would put a kind of agent, and a live
    // rail, on that server's call.
    expect(spawnedIn({ claudeCode: { toolName: "mcp__other__dispatch" } }, ASKED))
      .toBeNull()
    expect(spawnedIn(undefined, ASKED)).toBeNull()
  })

  test("... nor whatever its RESPONSE is shaped like", () => {
    // The same hole on the other side, and the sharper one, because this
    // payload is not the adapter's at all: `_meta.claudeCode.toolResponse` is
    // built by the adapter on the `tool_progress` path and FORWARDED VERBATIM
    // from the tool's own response on the PostToolUse path
    // (`onPostToolUseHook`, for any tool). So a server answering with a
    // `subagentType` in its structured output is one string away from being
    // drawn as an agent somebody spawned, with a live rail under it — and
    // nothing about a `mcp__other__*` call ever passed through this panel's
    // hands.
    const answered = {
      claudeCode: {
        toolName: "mcp__other__dispatch",
        toolResponse: { ok: true, subagentType: "Explore" },
      },
    }
    expect(spawnedIn(answered, { query: "anything" })).toBeNull()
    // ... including when it is shaped like the beat it is imitating.
    expect(
      spawnedIn({
        claudeCode: {
          toolName: "mcp__other__dispatch",
          toolResponse: { elapsedTimeSeconds: 12, subagentType: "Explore" },
        },
      }, undefined),
    ).toBeNull()
  })

  test("a real beat is not a source either, and does not need to be", () => {
    // The adapter's own `tool_progress` forwarding for an Agent call carries
    // no flag, so it is answered `null` like anything else unflagged. Nothing
    // is lost: the kind rode the flagged frames that announced and refined the
    // spawn, and the transcript holds it from there.
    expect(
      spawnedIn({
        claudeCode: {
          toolName: "Agent",
          toolResponse: { elapsedTimeSeconds: 12, subagentType: "Explore" },
        },
      }, undefined),
    ).toBeNull()
  })

  test("nothing else is a spawn", () => {
    expect(spawnedIn({ claudeCode: { toolName: "Grep" } }, { pattern: "x" })).toBeNull()
    // The frames a subagent's own calls arrive on say who they came from and
    // never that they started anybody.
    expect(spawnedIn({ claudeCode: { parentToolUseId: "toolu_01AGENT" } }, {}))
      .toBeNull()
    expect(spawnedIn(undefined, undefined)).toBeNull()
    expect(spawnedIn(null, null)).toBeNull()
    expect(spawnedIn({}, {})).toBeNull()
    expect(spawnedIn({ claudeCode: null }, null)).toBeNull()
    expect(spawnedIn({ someOtherAgent: { subagent: true } }, {})).toBeNull()
    // Truthy is not the word, for `steerTaken`'s reason: an agent that answers
    // something else here has not said this.
    expect(spawnedIn({ claudeCode: { subagent: "yes" } }, {})).toBeNull()
    expect(spawnedIn({ claudeCode: { subagent: 1 } }, {})).toBeNull()
  })

  test("a spawn that named no kind of agent says so, rather than guessing", () => {
    // `subagent_type` is optional on the tool that spawns one, and the
    // arguments arrive incrementally besides. The frame is still a spawn; the
    // kind is still unsaid, and an absent field is how this says that.
    const { subagent_type: _named, ...anonymous } = ASKED
    expect(spawnedIn(SPAWN, anonymous)).toEqual({})
    expect(spawnedIn(SPAWN, undefined)).toEqual({})
    expect(spawnedIn(SPAWN, { subagent_type: "" })).toEqual({})
    expect(spawnedIn(SPAWN, { subagent_type: 7 })).toEqual({})
  })

  test("a spawn's own response cannot name the agent either", () => {
    // The flag opens the door and the ARGUMENTS are what is read through it.
    // A flagged frame carrying a `subagentType` and no `subagent_type` is a
    // spawn whose kind nobody stated — not a spawn named by its response,
    // which is the reading that let any tool's output through.
    expect(
      spawnedIn(
        { claudeCode: { subagent: true, toolResponse: { subagentType: "Explore" } } },
        undefined,
      ),
    ).toEqual({})
    // ... and where they disagree, what was asked for is what a person reading
    // the row is owed.
    expect(
      spawnedIn(
        {
          claudeCode: {
            subagent: true,
            toolResponse: { subagentType: "general-purpose" },
          },
        },
        ASKED,
      ),
    ).toEqual({ kind: "Explore" })
  })
})

describe("which model a turn is running on", () => {
  /** What the adapter forwards under `_claude/sdkMessage`, having been asked to
   *  by {@link OPEN_SESSION_META}: the CLI's own `init`, verbatim, with the
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
    const [subscribed] = OPEN_SESSION_META.claudeCode.emitRawSDKMessages
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

/**
 * The other field of that same message (`mcp-roster-visible`).
 *
 * It is worth its own block for the reason the model's is: it is a bet on ONE
 * agent's private channel, and the near misses are the interesting half — a
 * status word nobody here has seen, a row with no name, a message of some other
 * kind. Every one of them is cheap as a value and expensive to stage against a
 * real CLI, which would have to be talked into failing to connect to something.
 *
 * What is being locked is that the STATUS SURVIVES VERBATIM. The one word that
 * means yes is matched one layer up (`../servers.ts`); this file's job is to
 * hand that layer the CLI's own spelling and to drop anything it cannot read,
 * rather than to translate a set that grows on somebody else's release
 * schedule.
 */
describe("which of this conversation's servers the agent attached", () => {
  /** The `init` message again, with the servers half of it. */
  const init = (servers: unknown) => ({
    sessionId: "s1",
    message: {
      type: "system",
      subtype: "init",
      model: "claude-opus-4-5",
      mcp_servers: servers,
    },
  })

  test("the `init` message says which servers connected, in the CLI's own words", () => {
    expect(
      liveServersIn(init([
        { name: "olai", status: "connected" },
        { name: "kolu", status: "connected" },
      ])),
    ).toEqual([
      { name: "olai", status: "connected" },
      { name: "kolu", status: "connected" },
    ])
  })

  test("a status that is not `connected` is carried through, never flattened", () => {
    // The CLI's binary carries `connected`, `failed`, `needs-auth`, `pending`
    // and `disabled` today, and the SDK types the field as a bare `string` —
    // an open set. A reader that mapped them onto a vocabulary of ours would
    // have to be edited on somebody else's release for a person to find out
    // that their server wants signing in rather than that it broke.
    expect(
      liveServersIn(init([
        { name: "kolu", status: "needs-auth" },
        { name: "deepwiki", status: "failed" },
        { name: "later", status: "a word no version has sent yet" },
      ])),
    ).toEqual([
      { name: "kolu", status: "needs-auth" },
      { name: "deepwiki", status: "failed" },
      { name: "later", status: "a word no version has sent yet" },
    ])
  })

  test("what we asked to be forwarded is what is read", () => {
    // The ask and the read are one bet, exactly as they are for the model.
    const [subscribed] = OPEN_SESSION_META.claudeCode.emitRawSDKMessages
    expect(
      liveServersIn({
        message: { ...subscribed, mcp_servers: [{ name: "olai", status: "connected" }] },
      }),
    ).toEqual([{ name: "olai", status: "connected" }])
  })

  test("another message of the CLI's says nothing about servers", () => {
    expect(
      liveServersIn({
        message: {
          type: "system",
          subtype: "compact",
          mcp_servers: [{ name: "olai", status: "connected" }],
        },
      }),
    ).toBeNull()
    expect(
      liveServersIn({
        message: { type: "result", mcp_servers: [{ name: "olai", status: "connected" }] },
      }),
    ).toBeNull()
  })

  test("an init that names no servers is a message that says nothing, not an empty roster", () => {
    // `null` and `[]` are two different instructions to the layer above: one
    // leaves every row where the client put it, and the other would be the
    // agent reporting on a list with nothing in it. An absent field is the
    // first.
    expect(liveServersIn(init(undefined))).toBeNull()
    expect(liveServersIn(init("olai, kolu"))).toBeNull()
    expect(liveServersIn({ sessionId: "s1" })).toBeNull()
    expect(liveServersIn(null)).toBeNull()
    expect(liveServersIn(undefined)).toBeNull()
    // ... and an init that carried an EMPTY list really did say so.
    expect(liveServersIn(init([]))).toEqual([])
  })

  test("a row that cannot be read is dropped, never repaired", () => {
    // A row with no name is about nothing and a row with no status has nothing
    // to say. Defaulting either would be this file inventing the fact it is
    // here to report; dropped, the roster row stays where the client put it,
    // which is what it already says.
    expect(
      liveServersIn(init([
        { name: "olai", status: "connected" },
        { status: "connected" },
        { name: "", status: "connected" },
        { name: "kolu" },
        { name: "kolu", status: "" },
        { name: "kolu", status: 7 },
        null,
        "kolu",
      ])),
    ).toEqual([{ name: "olai", status: "connected" }])
  })
})


describe("the leg", () => {
  test("reads a tool's name out of the meta, never out of the call id", () => {
    // A Claude call id is an opaque `toolu_…` and says nothing about the tool.
    // Reading it as a name — which the OTHER leg does, on a wire where it IS
    // one — would answer for a call nothing has named, which is the one
    // direction this file may not fail in.
    expect(CLAUDE.toolNameIn({ claudeCode: { toolName: "Bash" } })).toBe("Bash")
    expect(CLAUDE.toolNameOf("Bash:0")).toBeNull()
  })

  test("has a bypass mode to ask for, and a way to steer a running turn", () => {
    expect(CLAUDE.bypassMode).toBe("bypassPermissions")
    expect(CLAUDE.steering?.method).toBe(STEER_METHOD)
    expect(CLAUDE.steering?.taken({ outcome: "injected" })).toBe(true)
  })

  test("subscribes to the CLI's own messages when a session is opened", () => {
    expect(CLAUDE.rawMessages?.openMeta).toEqual(OPEN_SESSION_META)
    expect(
      CLAUDE.rawMessages?.modelIn({
        message: { type: "system", subtype: "init", model: "claude-sonnet-5" },
      }),
    ).toBe("claude-sonnet-5")
  })
})
