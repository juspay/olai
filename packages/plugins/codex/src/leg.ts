import { namedExactly, type Leg, type Meta, type Reported } from "@kolu/acp/engine"

import { AIR } from "./activity.ts"

const fieldIn = (value: unknown, key: string): unknown =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)[key]
    : undefined

const steeringAdvertised = (initialized: unknown): boolean =>
  fieldIn(fieldIn(fieldIn(initialized, "_meta"), "steering"), "supported") === true

const steerTaken = (answered: unknown): boolean => {
  const outcome = fieldIn(answered, "outcome")
  return outcome === "injected" || outcome === "startedNewTurn"
}

export const serversInUpdate = (update: unknown): ReadonlyArray<Reported> | null => {
  if (fieldIn(update, "sessionUpdate") !== "tool_call" || fieldIn(update, "status") !== "failed") return null
  const id = fieldIn(update, "toolCallId")
  if (typeof id !== "string" || !id.startsWith("mcp_startup.")) return null
  let name: string
  try { name = decodeURIComponent(id.slice("mcp_startup.".length)) } catch { return null }
  if (name === "" || fieldIn(update, "title") !== `mcp__${name}__startup`) return null
  const content = fieldIn(update, "content")
  const words = Array.isArray(content) ? content.flatMap((block) => {
    const inner = fieldIn(block, "content")
    const text = fieldIn(inner, "text")
    return fieldIn(block, "type") === "content" && fieldIn(inner, "type") === "text" && typeof text === "string"
      ? [text] : []
  }) : []
  return [{ name, attached: false, said: words.join("\n") || "MCP startup failed" }]
}

export const CODEX: Leg = {
  spelling: null,
  mcpCall: (frame, servers) => {
    const server = fieldIn(frame.rawInput, "server")
    const tool = fieldIn(frame.rawInput, "tool")
    return frame._meta?.["is_mcp_tool_call"] === true && typeof server === "string"
      && typeof tool === "string" && tool !== "" && servers.includes(server) ? [{ server, tool }] : []
  },
  replyIn,
  nativeActivity: AIR,
  serversInUpdate,
  toolNameIn: (_meta: Meta) => null,
  toolNameOf: () => null,
  allowedWithoutAsking: () => null,
  parentToolUse: () => null,
  spawned: () => null,
  backgroundTask: () => null,
  taskNotification: () => null,
  listedIn: () => null,
  prologueIn: () => null,
  bypassMode: "agent-full-access",
  bypassModeRequired: true,
  steering: {
    method: "_session/steering",
    meta: { steering: { idleBehavior: "promptRequired" } },
    timeout: "30 seconds",
    taken: steerTaken,
    advertised: steeringAdvertised,
  },
  queues: () => false,
  rawMessages: null,
  terminalOutput: true,
  models: { config: "model", nameIn: namedExactly },
}

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined
}

export function replyIn(rawOutput: unknown): Record<string, unknown> | undefined {
  return record(record(record(rawOutput)?.["result"])?.["structuredContent"])
}
