import { type ChatEntry, isAgentOut, sentToDo } from "olai-plugin-chat/wire"

export const whoOf = (entry: ChatEntry | undefined): string | null => {
  if (entry?.kind !== "tool") return null
  const spawned = entry.spawned
  return spawned === undefined ? null : spawned.kind ?? SOMEBODY
}

export const doingOf = (entry: ChatEntry | undefined): string | null => {
  return entry?.kind === "tool" && isAgentOut(entry) ? WORKING : null
}

export const sentOf = (entry: ChatEntry | undefined): string | null => {
  if (entry?.kind !== "tool" || entry.spawned === undefined) return null
  return sentToDo(entry.spawned, entry.text)
}

const SOMEBODY = "Agent"

const WORKING = "Working…"
