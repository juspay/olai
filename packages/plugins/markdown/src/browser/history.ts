/** Markdown's history belongs to its activation, independently of outlines. */
import type { Undo } from "@olai/edit-history/undoing.ts"
let active: Undo | undefined
export const holdHistory = (value: Undo): (() => void) => {
  active = value
  return () => { if (active === value) active = undefined }
}
export const useHistory = (): Undo => {
  if (active === undefined) throw new Error("Markdown history is unavailable")
  return active
}
