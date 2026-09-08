import {
  type AtDocument,
  type AtNode,
  type GraphPageRequest,
  Hops,
  HOPS,
  HOPS_DEFAULT,
  parseAddress,
  printAddress,
  writtenAddress,
} from "@olai/format"
import { defineAppRoute, type Route } from "olai-plugin-navigation/routes"

import { graphWire } from "./wire.ts"

/** What one graph URL means: the whole reading, or one vertex's
 *  neighbourhood at one horizon. */
export type GraphPage = { readonly around: AtNode | AtDocument | null; readonly hops: Hops }

const hopsIn = (query: URLSearchParams | undefined): Hops => {
  const hops = query?.get("hops")
  return hops === "2" ? 2 : HOPS_DEFAULT
}

/**
 * THE GRAMMAR, in the one place both directions live.
 *
 * An address is spelled the way {@link parseAddress} reads it — the path in
 * the URL's path half, the element in its fragment — because that is the one
 * reader and it must not learn a second dialect (`navigation/src/routes.ts`'s
 * widening of `parse` with `rest` exists for exactly this: an address's two
 * halves are a pathname AND a fragment, and a route whose value is an address
 * was not spellable until `rest` arrived).
 *
 * FORGIVING in the direction a person reads, never in the diretion this
 * module writes: `/graph` and `/graph/` are the whole reading; a tail with no
 * readable address behind it claims nothing (a miss, not a guess); and
 * `hops` that is not one of {@link HOPS} is the default horizon rather than a
 * broken page, the way a missing one is.
 */
export const graph = defineAppRoute<GraphPage, GraphPageRequest>({
  claims: [
    { kind: "exact", path: "/graph" },
    { kind: "prefix", path: "/graph/" },
  ],
  parse: (pathname, rest) => {
    if (pathname === "/graph") return { around: null, hops: hopsIn(rest?.query) }
    if (!pathname.startsWith("/graph/")) return null
    let tail: string
    try {
      tail = decodeURIComponent(pathname.slice("/graph/".length))
    } catch {
      return null
    }
    const fragment = rest?.fragment
    if (tail === "" && (fragment === undefined || fragment === "")) {
      return { around: null, hops: hopsIn(rest?.query) }
    }
    const text = fragment === undefined || fragment === "" ? tail : `${tail}#${fragment}`
    const address = parseAddress(text)
    if (address === null) return tail === "" ? { around: null, hops: hopsIn(rest?.query) } : null
    const around: AtNode | AtDocument = address.kind === "node"
      ? address
      : address.kind === "document"
      ? address
      : address.kind === "row"
      ? { kind: "node", id: address.id }
      : { kind: "document", path: address.path }
    return { around, hops: hopsIn(rest?.query) }
  },
  href: (page) => {
    if (page.around === null) return page.hops === HOPS_DEFAULT ? "/graph" : "/graph?hops=2"
    const { path, element } = writtenAddress(page.around)
    const query = page.hops === HOPS_DEFAULT ? "" : "?hops=2"
    return element === undefined
      ? `/graph/${path}${query}`
      : `/graph/${path}${query}#${element}`
  },
  breadcrumb: (page) => page.around === null ? "Graph" : `Graph · ${printAddress(page.around)}`,
  narrowable: true,
  request: (page) => ({ kind: "graph", around: page.around, hops: page.hops }),
  stream: {
    use: (input) => graphWire().streams.graph.use(input),
  },
})

export const wholeGraph = (): Route => graph.to({ around: null, hops: HOPS_DEFAULT })

export const graphAround = (address: AtNode | AtDocument, hops: Hops = HOPS_DEFAULT): Route =>
  graph.to({ around: address, hops })
