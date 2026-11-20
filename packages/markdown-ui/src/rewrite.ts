import {
  deadLinkTarget,
  type Claims,
  addressOf,
  printAddress,
  bodyKind,
  pictureOf,
} from "@olai/format"

import { TESTID } from "@olai/markdown-ui/testids.ts"
import { mediaHref } from "@olai/surface"
import type { Element, Root } from "hast"

import { idIn } from "./ids.ts"
import { type Heading, headingOf } from "./outline.ts"

export interface Rewrite {
  readonly claims: Claims | undefined
  readonly from: string
  readonly ids: string
}

export const rewrite = (tree: Root, options: Rewrite): readonly Heading[] => {
  const headings: Heading[] = []
  walk(tree, options, headings, headingRoute(options.claims, options.from), { pictures: 0 })
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
  drawn: { pictures: number },
): void => {
  for (const child of parent.children) {
    if (child.type !== "element") continue
    if (child.tagName === "img") {
      const eager = drawn.pictures === 0
      if (resolvePicture(child, options.claims, options.from, eager)) drawn.pictures++
    }
    if (child.tagName === "a") {
      resolveDocument(child, options.claims, options.from)
      openExternal(child)
    }
    const slug = child.properties?.["id"]
    mint(child, options.ids, route)
    walk(child, options, headings, route, drawn)
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
  eager: boolean,
): boolean => {
  const written = element.properties?.["src"]
  const src = typeof written === "string" ? written : ""
  const picture = src === "" || claims === undefined ? null : pictureOf(claims, from, src)
  if (picture !== null) {
    element.properties = { ...element.properties,
      src: mediaHref(picture), loading: eager ? "eager" : "lazy", decoding: "async" }
    return true
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
  return false
}

const resolveDocument = (element: Element, claims: Claims | undefined, from: string): void => {
  const written = element.properties?.["href"]
  if (typeof written !== "string") return
  const cut = /[?#]/.exec(written)?.index ?? written.length
  const resolved = deadLinkTarget(from, written)
  if (resolved !== null) {
    element.properties = { ...element.properties,
      "data-link-path": resolved, "data-link-written": written }
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
  if (typeof id === "string") properties["id"] = idIn(ids, id)

  const href = properties["href"]
  if (typeof href === "string" && href.startsWith("#")) {
    const at = href.length > 1 ? route?.(authored(href.slice(1))) : undefined
    properties["href"] = at ?? `#${idIn(ids, href.slice(1))}`
  }
}

const authored = (fragment: string): string => {
  try { return decodeURIComponent(fragment) } catch { return fragment }
}
