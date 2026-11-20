import { atNode, type Route } from "olai-plugin-navigation/routes"

export const nodeNamedBy = (

  text: string | null,
  inFence: boolean,
  resolve: (id: string) => string | null,
): Span => {
  const asked = askedOf(text, inFence)
  return { asked, id: asked === null ? null : resolve(asked) }
}

interface Span {
    readonly asked: string | null
    readonly id: string | null
}

const askedOf = (text: string | null, inFence: boolean): string | null => {
  if (inFence) return null
  const id = (text ?? "").trim()
  return id === "" ? null : id
}

const inFenceAt = (span: Element): boolean => span.parentElement?.tagName === "PRE"

export const markNodeRefs = (
  root: HTMLElement,
  resolve: (id: string) => string | null,
  href: (route: Route) => string,
): ReadonlyArray<string> => {
  const asked = new Set<string>()
  for (const span of root.querySelectorAll("code")) {
    const { asked: says, id } = nodeNamedBy(span.textContent, inFenceAt(span), resolve)
    if (says !== null) asked.add(says)
    const anchor = span.parentElement?.matches("a[data-node-chip]") ? span.parentElement as HTMLAnchorElement : undefined
    if (id === null) { if (anchor) anchor.replaceWith(span); continue }
    if (!anchor && span.closest("a")) continue
    const link = anchor ?? document.createElement("a")
    link.dataset.nodeChip = ""
    link.title = "Show this row"
    link.setAttribute("href", href(atNode(id)))
    if (!anchor) { span.replaceWith(link); link.append(span) }

  }
  return [...asked]
}

