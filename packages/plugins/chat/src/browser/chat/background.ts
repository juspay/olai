import { type ChatEntry, isTaskOut, type ToolEntry } from "olai-plugin-chat/wire"
import type { Armed } from "@kolu/acp/wire"

const taskRow = (entry: ChatEntry | undefined): ToolEntry | undefined =>
  entry?.kind === "tool" ? entry : undefined

export const armedOf = (entry: ChatEntry | undefined): Armed | null =>
  taskRow(entry)?.armed ?? null

export const watchOf = (entry: ChatEntry | undefined): string | null =>
  armedOf(entry)?.description ?? null

export const stillOf = (entry: ChatEntry | undefined): string | null => {
  const row = taskRow(entry)
  return row !== undefined && isTaskOut(row) ? STILL : null
}

export const endedOf = (entry: ChatEntry | undefined): string | null =>
  armedOf(entry)?.ended ?? null

const STILL = "Still running…"
