import { type ChatEntry, isTaskOut } from "olai-plugin-chat/wire"
import type { Armed } from "@kolu/acp/wire"

export const armedOf = (entry: ChatEntry | undefined): Armed | null =>
  entry?.kind === "tool" ? entry.armed ?? null : null

export const watchOf = (entry: ChatEntry | undefined): string | null =>
  armedOf(entry)?.description ?? null

export const stillOf = (entry: ChatEntry | undefined): string | null =>
  entry?.kind === "tool" && isTaskOut(entry) ? STILL : null

export const endedOf = (entry: ChatEntry | undefined): string | null =>
  armedOf(entry)?.ended ?? null

const STILL = "Still running…"
