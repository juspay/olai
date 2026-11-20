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
export const localLink = (link: Pick<HTMLAnchorElement, "getAttribute" | "hasAttribute" | "target">): boolean =>
  (link.getAttribute("href") ?? "").startsWith("#") || link.hasAttribute("download") || (link.target !== "" && link.target !== "_self")
