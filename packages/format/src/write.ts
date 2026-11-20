import { type Custom, type CustomValue, customKeys, emptyValue } from "./custom.ts"
export const nothing = (value: unknown): boolean =>
  value === undefined || value === null || emptyValue(value) ||
  (typeof value === "object" && value !== null && !Array.isArray(value) &&
    Object.keys(value).length === 0)

export const heldCustom = (value: unknown): Custom => {
  if (value === undefined || value === null || typeof value !== "object") return {}
  if (Array.isArray(value)) return {}
  const custom = value as Custom
  const out: Record<string, CustomValue> = {}
  for (const key of customKeys(custom)) {
    const held = custom[key]
    if (held !== undefined && !nothing(held)) out[key] = held
  }
  return out
}
