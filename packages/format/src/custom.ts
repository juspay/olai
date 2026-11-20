import { Schema } from "effect"

export const CustomValue = Schema.Union([Schema.String, Schema.Array(Schema.String)])
export type CustomValue = typeof CustomValue.Type

export const Custom = Schema.Record(Schema.String, CustomValue)
export type Custom = typeof Custom.Type

export interface HasCustom {
  readonly custom?: Custom | undefined
}

export const customOf = (node: HasCustom): Custom => node.custom ?? {}

export const customText = (node: HasCustom, key: string): string | undefined => {
  const value = node.custom?.[key]
  return typeof value === "string" ? value : undefined
}

export const customKeys = (custom: Custom): ReadonlyArray<string> =>
  Object.keys(custom).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))

export const customOrder = (custom: Custom): ReadonlyArray<string> => Object.keys(custom)

/**
 * A key holding `""` and a key that is gone are one file on disk, and they must
 * be one map in hand too, or the diff a commit message is built from would
 * report a change nobody made.
 */
export const withCustom = (
  custom: Custom | undefined,
  key: string,
  value: CustomValue | undefined,
): Custom => {
  const next: Record<string, CustomValue> = { ...custom }
  if (value === undefined || value === "" || (Array.isArray(value) && value.length === 0)) {
    delete next[key]
  } else {
    next[key] = value
  }
  return next
}
