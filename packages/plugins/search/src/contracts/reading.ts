import { serviceTag } from "@olai/plugin-api/contracts"
import { createKeyedRoot } from "@kolu/surface/solid"
import type { Accessor } from "solid-js"
import type { NodeHit, Refusal, SearchHit, SearchRequest, SearchAnswer } from "@olai/format"
import type { Taking } from "@olai/web/client/settled.ts"
export const LIMIT = 8
export interface Search<H extends SearchHit = SearchHit> {
  readonly hits: Accessor<ReadonlyArray<H>>
  readonly total: Accessor<number>
  readonly totals: Accessor<SearchAnswer["totals"]>
  readonly failure: Accessor<string | null>
  readonly refusals: Accessor<ReadonlyArray<Refusal>>
  readonly answering: Accessor<string | null>
  readonly taking: Taking
}

export type SearchKind = SearchRequest["kind"]
export type SearchProvider = (text: Accessor<string | null>, kind?: Accessor<SearchKind>) => Search
export const readings = serviceTag<SearchProvider>("search.readings")

export interface NodeSearch {
  (text: Accessor<string | null>, kind: "node"): Search<NodeHit>
  (text: Accessor<string | null>): Search
  (text: Accessor<string | null>, kind: Accessor<SearchKind>): Search
}

export function followReading(
  provider: Accessor<SearchProvider | undefined>,
  text: Accessor<string | null>,
  kind?: "node" | Accessor<SearchKind>,
): Search {
  const reading = createKeyedRoot(provider, value => value?.(text, typeof kind === "function" ? kind : () => kind))
  const absent = () => reading() === undefined && (text()?.trim().length ?? 0) >= 3
  const unavailable = "Search is unavailable right now."
  return {
    hits: () => reading()?.hits() ?? [],
    total: () => reading()?.total() ?? 0,
    totals: () => reading()?.totals(),
    failure: () => reading()?.failure() ?? (absent() ? unavailable : null),
    refusals: () => reading()?.refusals() ?? (absent() ? [{ token: text()!.trim(), reason: unavailable }] : []),
    answering: () => reading()?.answering() ?? null,
    taking: act => reading()?.taking(act),
  }
}
