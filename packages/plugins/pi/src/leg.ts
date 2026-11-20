import { mcpCallBy, type Leg, namedExactly } from "@kolu/acp/engine"

export const toolNameOf = (toolCallId: string): string | null => {
  const at = toolCallId.indexOf(":")
  if (at <= 0) return null
  return toolCallId.slice(0, at)
}

export const spelling = (server: string) => `${server}_`
// Display spelling is not evidence for approval. Keep a bare null: an allow
// keyed on a guessed prefix is the failure this leg must prevent. Pi owns
// its permissions; do not replace this with allowingOurs(spelling).
export const allowedWithoutAsking: Leg["allowedWithoutAsking"] = () => null

const piAcpIn = (opened: unknown): { readonly [key: string]: unknown } | undefined => {
  if (typeof opened !== "object" || opened === null) return undefined
  const meta = (opened as { readonly _meta?: unknown })._meta
  if (typeof meta !== "object" || meta === null) return undefined
  const corner = (meta as { readonly piAcp?: unknown }).piAcp
  return typeof corner === "object" && corner !== null
    ? corner as { readonly [key: string]: unknown }
    : undefined
}

export const prologueIn = (opened: unknown): string | null => {
  const said = piAcpIn(opened)?.["startupInfo"]
  return typeof said === "string" && said !== "" ? said : null
}

export const PI: Leg = {
  spelling,
  mcpCall: mcpCallBy(spelling),
  replyIn,
  toolNameIn: () => null,
  toolNameOf,
  allowedWithoutAsking,
  parentToolUse: () => null,
  spawned: () => null,
  backgroundTask: () => null,
  taskNotification: () => null,
  listedIn: () => null,
  prologueIn,
  bypassMode: null,
  steering: null,
  queues: () => true,
  rawMessages: null,
  terminalOutput: true,
  models: { config: "model", nameIn: namedExactly },
}

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined
}

export function replyIn(rawOutput: unknown): Record<string, unknown> | undefined {
  const outer = record(rawOutput)
  return record(outer?.["details"]) ?? record(outer?.["structuredContent"])
}
