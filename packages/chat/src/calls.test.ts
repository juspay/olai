/**
 * What is known about a call, over values.
 *
 * Every rule here is one the panel depends on at a moment nobody can arrange:
 * a permission request arriving after the frame that named its tool, a
 * subagent's question arriving after the frame that said whose it was, a
 * completion arriving after both. Reaching any of them through the real thing
 * means starting a subprocess and talking it into a fan-out — so they are
 * asserted here, the way {@link ./interpret.ts}'s readings and
 * {@link ./questions.ts}'s state machine are.
 */

import { describe, expect, test } from "bun:test"

import { Calls } from "./calls.ts"

/** A frame's `_meta`, as the adapter builds one — either field, both, or an
 *  empty corner. Spelled once, because every test here is about what one of
 *  these does to what is remembered. */
const meta = (claudeCode: Record<string, unknown>) => ({ claudeCode })

describe("what a frame said about its call", () => {
  test("a call nothing said anything about is known by nothing", () => {
    expect(new Calls().about("call-1", undefined)).toEqual({})
  })

  test("an announcement's name is what a later question is answered with", () => {
    // The whole reason this exists: a permission request carries a DISPLAY
    // title and never the programmatic name, and the name is what decides
    // whether a person is asked at all.
    const calls = new Calls()
    calls.heard("call-1", meta({ toolName: "Bash" }))
    expect(calls.about("call-1", undefined).name).toBe("Bash")
  })

  test("an announcement's agent is what a later question is attributed to", () => {
    const calls = new Calls()
    calls.heard("call-1", meta({ toolName: "Bash", parentToolUseId: "agent-1" }))
    expect(calls.about("call-1", undefined)).toEqual({
      name: "Bash",
      parent: "agent-1",
    })
  })

  test("a frame that says half of it does not take the other half back", () => {
    // The shapes the adapter actually has: a subagent's terminal output
    // arrives with only the parent, a plan exit's with only the name.
    const calls = new Calls()
    calls.heard("call-1", meta({ toolName: "Bash" }))
    calls.heard("call-1", meta({ parentToolUseId: "agent-1" }))
    expect(calls.about("call-1", undefined)).toEqual({
      name: "Bash",
      parent: "agent-1",
    })
  })

  test("a completion that says nothing leaves everything where it was", () => {
    // The shape that catches a reader treating silence as an answer: a row
    // that read this as "no agent now" would step out of its lane at the
    // moment the call finished, which is the moment somebody looks.
    const calls = new Calls()
    calls.heard("call-1", meta({ toolName: "Bash", parentToolUseId: "agent-1" }))
    calls.heard("call-1", undefined)
    calls.heard("call-1", meta({}))
    expect(calls.about("call-1", undefined)).toEqual({
      name: "Bash",
      parent: "agent-1",
    })
  })
})

describe("what the request itself said", () => {
  test("the request's own words win over the remembered ones", () => {
    // A permission request for a subagent's tool is stamped with both, and
    // that is the most direct thing anybody said about it.
    const calls = new Calls()
    calls.heard("call-1", meta({ toolName: "Bash", parentToolUseId: "agent-1" }))
    expect(calls.about("call-1", meta({ toolName: "Edit", parentToolUseId: "agent-2" })))
      .toEqual({ name: "Edit", parent: "agent-2" })
  })

  test("a request that says nothing falls through to the frame that did", () => {
    // The elicitation's whole path: `elicitation/create` carries no
    // attribution at all, only the call it was asked from.
    const calls = new Calls()
    calls.heard("call-1", meta({ toolName: "AskUserQuestion", parentToolUseId: "agent-1" }))
    expect(calls.about("call-1", meta({})).parent).toBe("agent-1")
  })

  test("a question that names no call is answered rather than refused", () => {
    // A form elicitation may be scoped to a request rather than a session. A
    // question that named nothing is an ordinary question the main agent
    // asked, which is what an empty answer says.
    const calls = new Calls()
    calls.heard("call-1", meta({ parentToolUseId: "agent-1" }))
    expect(calls.about(null, undefined)).toEqual({})
    expect(calls.about(null, meta({ parentToolUseId: "agent-2" })).parent).toBe("agent-2")
  })
})

describe("the conversation ending", () => {
  test("what was said about a call goes with the session that minted it", () => {
    // A call id is only meaningful inside its own session, and this map would
    // otherwise be every call the process had ever seen — held for the life of
    // a server meant to run for weeks.
    const calls = new Calls()
    calls.heard("call-1", meta({ toolName: "Bash" }))
    calls.forget()
    expect(calls.about("call-1", undefined)).toEqual({})
  })
})

describe("what nothing here reads", () => {
  test("a `_meta` with no adapter corner in it says nothing", () => {
    // The losing direction, and the safe one: an agent that is not that
    // adapter has no subagents here, and every call is one a person is asked
    // about by name rather than approved by accident.
    const calls = new Calls()
    calls.heard("call-1", { toolName: "Bash", parentToolUseId: "agent-1" })
    expect(calls.about("call-1", { toolName: "Bash" })).toEqual({})
  })
})
