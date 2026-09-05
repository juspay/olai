import { describe, expect, test } from "bun:test"

import { CODEX } from "./leg.ts"

const HANDSHAKE = {
  protocolVersion: 1,
  agentInfo: { name: "@agentclientprotocol/codex-acp", title: "Codex", version: "1.8.0" },
  agentCapabilities: { loadSession: true, mcpCapabilities: { http: true } },
  _meta: { steering: { supported: true } },
}

describe("Codex steering", () => {
  const steering = CODEX.steering

  test("is offered only from the adapter's positive advertisement", () => {
    expect(steering?.advertised(HANDSHAKE)).toBe(true)
    expect(steering?.advertised({ _meta: { steering: {} } })).toBe(false)
    expect(steering?.advertised({ agentCapabilities: { steering: { supported: true } } }))
      .toBe(false)
    expect(steering?.advertised(null)).toBe(false)
  })

  test("does not duplicate either outcome that consumed the message", () => {
    expect(steering?.taken({ outcome: "injected" })).toBe(true)
    expect(steering?.taken({ outcome: "startedNewTurn" })).toBe(true)
    expect(steering?.taken({ outcome: "failed" })).toBe(false)
    expect(steering?.taken({ outcome: "future" })).toBe(false)
    expect(steering).toMatchObject({ method: "_session/steering", timeout: "30 seconds" })
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

describe("Codex MCP startup reports", () => {
  const failed = {
    sessionUpdate: "tool_call", toolCallId: "mcp_startup.my%20server",
    title: "mcp__my server__startup", kind: "other", status: "failed",
    content: [{ type: "content", content: { type: "text", text: "connection refused" } }],
  }
  test("preserves the server and actual startup error", () => {
    expect(CODEX.serversInUpdate?.(failed)).toEqual([
      { name: "my server", attached: false, said: "connection refused" },
    ])
  })
  test("does not interpret ordinary failed tools, malformed ids, or silence as connection failure", () => {
    for (const update of [null, {}, { ...failed, toolCallId: "ordinary" },
      { ...failed, title: "mcp__my server__read" }, { ...failed, status: "completed" },
      { ...failed, toolCallId: "mcp_startup.%" }]) {
      expect(CODEX.serversInUpdate?.(update)).toBeNull()
    }
  })
})
