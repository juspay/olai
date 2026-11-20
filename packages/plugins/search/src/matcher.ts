import {
  ancestorsOf,
  bodiedIn,
  declarationsOf,
  DEFAULT_SEARCH_LIMIT,
  type Filter,
  heldCustom,
  type KindVocabulary,
  matching,
  matchingDocuments,
  matchingOutlines,
  documentLineOf,
  NodeId,
  nothing,
  parseFilter,
  rankedTogether,
  type Reading,
  type SearchAnswer,
  type SearchHit,
  type SearchRequest,
} from "@olai/format"
import { Query } from "@olai/ops"

import type { Index } from "./table.ts"

export const search = (
  at: Reading,
  query: SearchRequest,
  now: string,
  kinds: KindVocabulary,
  index?: Index | undefined,
): SearchAnswer => {
  const filter = parseFilter(query.text, now, declarationsOf(at.derived, kinds))
  if (filter.kind === "refused") {
    return { hits: [], total: 0, refusals: filter.refusals }
  }
  if (filter.kind === "nothing") return { hits: [], total: 0 }

  const scope = { file: query.file, under: query.under }
  const narrowed = index?.narrow(at, filter) ?? undefined
  const nodes = query.kind !== undefined && query.kind !== "node"
    ? []
    : matching(at.derived, filter, scope, narrowed?.nodes)
  const documents = query.kind === "node" || query.kind === "outline"
    ? []
    : matchingDocuments(bodiedIn(at.set), filter, scope, narrowed?.documents)
  const outlines = query.kind === "node" || query.kind === "document" ? [] : matchingOutlines(
    at.set.documents.filter(d => d.holds === "nodes"), filter, scope,
  )
  const limit = query.limit ?? DEFAULT_SEARCH_LIMIT
  const wantsNotes = query.withDesc === true
  const hits = rankedTogether(at.derived, nodes, documents, outlines)
    .slice(0, limit)
    .map((selected): SearchHit => {
      if (selected.kind === "outline") return {
        at: { kind: "document", path: selected.at.path },
        title: selected.at.title,
        ...(selected.match.field === null ? {} : { matched: selected.match.field }),
      }
      if (selected.kind === "document") {
        const props = heldCustom(selected.at.props)
        const line = documentLineOf(selected.at, filter, selected.match.field)
        return {
          at: { kind: "document", path: selected.at.path },
          ...(line === undefined ? {} : { line }),
          title: selected.at.title,
          ...(selected.match.field === null ? {} : { matched: selected.match.field }),
          ...(nothing(props) ? {} : { props }),
          ...(selected.match.props.length === 0 ? {} : { matchedProps: selected.match.props }),
        }
      }
      const { at: located, match } = selected
      const found = Query.foundOf(at.derived, located)
      const note = wantsNotes ? located.node.desc : undefined
      return {
        at: { kind: "node", id: NodeId.make(located.node.id) },
        ...found,
        pathIds: ancestorsOf(at.derived, located.node.id).map((crumb) => crumb.node.id),
        ...(match.field === null ? {} : { matched: match.field }),
        ...(match.props.length === 0 ? {} : { matchedProps: match.props }),
        ...(note === undefined ? {} : { desc: note }),
      }
    })

  return { hits, total: nodes.length + documents.length + outlines.length,
    ...(query.kind === undefined ? { totals: { node: nodes.length, file: documents.length + outlines.length } } : {}),
  }
}
