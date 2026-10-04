/** Shared with the seal by source injection: keep intentOf self-contained. */
export interface Press {
  readonly defaultPrevented: boolean
  readonly button: number
  readonly metaKey: boolean
  readonly ctrlKey: boolean
  readonly shiftKey: boolean
  readonly altKey: boolean
}
export type Intent = "go" | "right" | "new-pane"
export const intentOf = (press: Press): Intent | null => {
  if (press.defaultPrevented || press.button !== 0 || press.metaKey || press.ctrlKey) return null
  if (press.altKey) return press.shiftKey ? "new-pane" : "right"
  return press.shiftKey ? null : "go"
}
