import { Sort } from "@olai/format"
import { Schema } from "effect"

const sortIn = Schema.decodeUnknownOption(Sort)
const textIn = (value: unknown): string | null => typeof value === "string" && value !== "" ? value : null

export const fileOf = (reply: unknown): string | null =>
  typeof reply === "object" && reply !== null ? textIn((reply as { file?: unknown }).file) : null

export const writeIn = (reply: unknown) => {
  if (typeof reply !== "object" || reply === null) return undefined
  const value = reply as Record<string, unknown>
  if (typeof value.did !== "string" || typeof value.title !== "string") return undefined
  const sort = sortIn(value.sort)
  return { id: textIn(value.id), title: value.title, file: fileOf(value),
    sort: sort._tag === "Some" ? sort.value : null, nudge: textIn(value.nudge) }
}
