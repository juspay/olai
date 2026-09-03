import { describe, expect, test } from "bun:test"

import { CODEX, STEERING_ADVERTISED, steerTaken } from "./leg.ts"

const HANDSHAKE = {
  protocolVersion: 1,
  agentInfo: { name: "@agentclientprotocol/codex-acp", title: "Codex", version: "1.8.0" },
  agentCapabilities: { loadSession: true, mcpCapabilities: { http: true } },
  _meta: { steering: { supported: true } },
}

describe("Codex steering", () => {
  test("is offered only from the adapter's positive advertisement", () => {
    expect(STEERING_ADVERTISED(HANDSHAKE)).toBe(true)
    expect(STEERING_ADVERTISED({ _meta: { steering: {} } })).toBe(false)
    expect(STEERING_ADVERTISED({ agentCapabilities: { steering: { supported: true } } }))
      .toBe(false)
    expect(STEERING_ADVERTISED(null)).toBe(false)
  })

  test("does not duplicate either outcome that consumed the message", () => {
    expect(steerTaken({ outcome: "injected" })).toBe(true)
    expect(steerTaken({ outcome: "startedNewTurn" })).toBe(true)
    expect(steerTaken({ outcome: "failed" })).toBe(false)
    expect(steerTaken({ outcome: "future" })).toBe(false)
  })
})

describe("Codex's conservative wire readings", () => {
  test("never infers a programmatic tool name or auto-approves a call", () => {
    const meta = { is_mcp_tool_call: true, codex: { tool: "olai.read_node" } }
    expect(CODEX.toolNameIn(meta)).toBeNull()
    expect(CODEX.toolNameOf("opaque-call-id")).toBeNull()
    expect(CODEX.allowedWithoutAsking("olai.read_node", ["olai"], [
      { optionId: "yes", name: "Allow", kind: "allow_once" },
    ])).toBeNull()
  })

  test("claims neither guessed subagent lanes nor prompt queueing", () => {
    expect(CODEX.parentToolUse({ codex: { collaboration: { senderThreadId: "one" } } }))
      .toBeNull()
    expect(CODEX.spawned({ codex: { subagent: { threadId: "two" } } }, {})).toBeNull()
    expect(CODEX.queues(HANDSHAKE)).toBe(false)
    expect(CODEX.bypassMode).toBeNull()
  })

  test("reads the model picker by exact model id", () => {
    expect(CODEX.models?.config).toBe("model")
    expect(CODEX.models?.nameIn(new Map([["gpt-5.3-codex", "GPT-5.3 Codex"]]), "gpt-5.3-codex"))
      .toBe("GPT-5.3 Codex")
  })
})
