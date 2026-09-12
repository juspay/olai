import { WriteResult } from "@olai/format"
import { Schema } from "effect"

export const fileOf = (reply: unknown): string | null => {
  const file = typeof reply === "object" && reply !== null ? (reply as { file?: unknown }).file : undefined
  return typeof file === "string" && file !== "" ? file : null
}

/** Decode the format's write contract once; reads and refusals have no story. */
export const writeIn = (reply: unknown) => {
  const decoded = Schema.decodeUnknownOption(WriteResult)(reply)
  if (decoded._tag === "None") return undefined
  const value = decoded.value
  return { id: value.id || null, title: value.title, file: value.file || null,
    sort: value.sort ?? null, nudge: value.nudge || null }
}
