/**
 * It runs LAST, after the sanitiser, and that order is what makes it safe to
 * write attributes here: what the sanitiser passed is a URL we then narrow, and
 * what it rejected never reaches this walk at all.
 */

import {
  deadLinkTarget,
  deadLinkSaid,
  type Claims,
  addressOf,
  printAddress,
  bodyKind,
  pictureOf,
} from "@olai/format"

import { TESTID } from "@olai/markdown-ui/testids.ts"
import { mediaHref } from "@olai/surface"
import type { Element, Root } from "hast"

import { type Heading, headingOf } from "./outline.ts"


export interface Rewrite {
  readonly claims: Claims | undefined
  readonly from: string
  readonly members?: ReadonlySet<string>
  readonly ids: string
}

export const rewrite = (tree: Root, options: Rewrite): readonly Heading[] => {
  const headings: Heading[] = []
  walk(tree, options, headings, headingRoute(options.claims, options.from), { drawn: 0 })
  return headings
}

type HeadingRoute = (slug: string) => string | undefined

const headingRoute = (claims: Claims | undefined, from: string): HeadingRoute | null => {
  if (claims === undefined || bodyKind(claims, from) === null) return null
  return (slug) => {
    const address = addressOf(claims, from, slug)
    return address?.kind === "heading" ? "/" + printAddress(address) : undefined
  }
}

const walk = (
  parent: Root | Element,
  options: Rewrite,
  headings: Heading[],
  route: HeadingRoute | null,
  pictures: { drawn: number },
): void => {
  for (const child of parent.children) {
    if (child.type !== "element") continue
    if (child.tagName === "img") resolvePicture(child, options.claims, options.from, pictures)
    if (child.tagName === "a") {
      // Document first: a relative `.md` becomes a page address and must not then
      // be treated as something that leaves the app.
      resolveDocument(child, options.claims, options.from, options.members)
      openExternal(child)
    }
    const slug = child.properties?.["id"]
    mint(child, options.ids, route)
    walk(child, options, headings, route, pictures)
    // AFTER the subtree, so what a heading reads as is what is left of it.
    const heading = headingOf(child)
    if (heading === null) continue
    const at = typeof slug === "string" ? route?.(slug) : undefined
    headings.push(at === undefined ? heading : { ...heading, route: at })
  }
}

const resolvePicture = (
  element: Element,
  claims: Claims | undefined,
  from: string,
  pictures: { drawn: number },
): void => {
  const written = element.properties?.["src"]
  const src = typeof written === "string" ? written : ""
  const picture = src === "" || claims === undefined ? null : pictureOf(claims, from, src)
  if (picture !== null) {
    const first = pictures.drawn++ === 0
    element.properties = { ...element.properties,
      src: mediaHref(picture), loading: first ? "eager" : "lazy", decoding: "async" }
    return
  }

  element.tagName = "span"
  element.properties = {
    className: [UNDRAWN],
    "data-testid": TESTID.undrawnPicture,
    ...(src === "" ? {} : { "data-src": src }),
  }
  element.children = [{
    type: "text",
    value: src === ""
      ? "this picture could not be drawn: its address was empty, or not one this page may fetch"
      : `this picture could not be drawn: ${src}`,
  }]
}

const textIn = (node: { readonly type: string; readonly value?: unknown; readonly children?: ReadonlyArray<unknown> }): string => {
  if (node.type === "text") return typeof node.value === "string" ? node.value : ""
  const children = node.children
  if (children === undefined) return ""
  return children.map((child) => textIn(child as Parameters<typeof textIn>[0])).join("")
}

const resolveDocument = (element: Element, claims: Claims | undefined, from: string, members?: ReadonlySet<string>): void => {
  const written = element.properties?.["href"]
  if (typeof written !== "string") return
  const cut = /[?#]/.exec(written)?.index ?? written.length
  const resolved = deadLinkTarget(from, written)
  if (resolved !== null) {
    element.properties = { ...element.properties,
      "data-link-path": resolved, "data-link-written": written,
      "data-link-title": typeof element.properties["title"] === "string" ? element.properties["title"] : "" }
  }
  if (resolved !== null && members !== undefined && !members.has(resolved)) {
    const warning = deadLinkSaid({ written, resolved, suggest: [] })
    const authored = element.properties["title"]
    const classes = element.properties["className"]
    const words = textIn(element).trim()
    element.properties = { ...element.properties, "data-dead": true,
      "aria-label": [words, typeof authored === "string" ? authored : "", warning]
        .filter((part) => part !== "")
        .join(" — "),
      className: [...(Array.isArray(classes) ? classes : []), "olai-dead-link"] }
  }
  if (claims === undefined) return
  const document = resolved !== null && bodyKind(claims, resolved) !== null ? resolved : null
  if (document === null) return
  const address = addressOf(claims, document, null)
  if (address === null) return
  element.properties = {
    ...element.properties,
    href: "/" + printAddress(address) + written.slice(cut),
  }
}

/**
 * Written here, after the sanitiser, so a note cannot carry a `target` of its
 * own choosing and so a relative `.md` that {@link resolveDocument} has just
 * pointed at its own page is not stamped.
 */
const openExternal = (element: Element): void => {
  const href = element.properties?.["href"]
  if (typeof href !== "string" || !isHttp(href)) return
  element.properties = {
    ...element.properties,
    target: "_blank",
    rel: ["noopener", "noreferrer"],
  }
}

const isHttp = (href: string): boolean => /^https?:\/\//i.test(href)

const UNDRAWN = "inline-block rounded border border-rule px-1.5 py-0.5 " +
  "font-mono text-xs text-muted"

const mint = (element: Element, ids: string, route: HeadingRoute | null): void => {
  const properties = element.properties
  if (properties === undefined) return

  const id = properties["id"]
  if (typeof id === "string") properties["id"] = `${ids}-${id}`

  const href = properties["href"]
  if (typeof href === "string" && href.startsWith("#")) {
    const at = href.length > 1 ? route?.(authored(href.slice(1))) : undefined
    properties["href"] = at ?? `#${ids}-${href.slice(1)}`
  }
}

const authored = (fragment: string): string => {
  try { return decodeURIComponent(fragment) } catch { return fragment }
}
