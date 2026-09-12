/** Empty values have no stored meaning, regardless of the storage codec. */
import { type Custom, type CustomValue, customKeys } from "./custom.ts"
export const nothing = (value: unknown): boolean =>
  value === undefined || value === null ||
  (Array.isArray(value) && value.length === 0) || value === "" ||
  // ...and an EMPTY MAP, which is the same rule one level in: a node whose last
  // custom key was removed carries no `custom` field rather than `{}`, or the
  // `{"after":[]}` conflict-about-nothing would simply have moved.
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
