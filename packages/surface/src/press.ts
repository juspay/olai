/** Shared with the seal by source injection: keep both functions self-contained. */
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
/** A link the app never answers: a page-local `#fragment` (its content's), a
 *  download, or one aimed at another browsing context (the browser's). */
export const localLink = (link: Pick<HTMLAnchorElement, "getAttribute" | "hasAttribute" | "target">): boolean =>
  (link.getAttribute("href") ?? "").startsWith("#") || link.hasAttribute("download") || (link.target !== "" && link.target !== "_self")
