/**
 * WHICH NODES ARE ON THE MAP — answered for the whole tab, once.
 *
 * A row door is mounted per ROW and may answer something on nearly none of
 * them; what it may cost is a map read against a table somebody subscribes
 * to once (chat's `agents/answered.tsx` argues that cost for the roster,
 * and journal's `dates.ts` is the walk this file follows). The door's one
 * fact — this node's name is on the map because something in the reading
 * refers to it or it refers to something — is exactly the whole reading's
 * vertex set, so the table IS the standing `graph` stream, and the map is
 * a memo over the frame the server last valued.
 *
 * A dead or unanswered stream is the empty set: a row whose door would be
 * a lie is a row whose door does not draw, which is the arm the pill says
 * the tab is in anyway.
 */

import { type Accessor, createMemo } from "solid-js"

import { HOPS_DEFAULT } from "@olai/format"

import { graphWire } from "./wire.ts"

export const createGraphed = (): Accessor<ReadonlySet<string>> => {
  const answer = graphWire().streams.graph.use(() => ({
    kind: "graph" as const,
    around: null,
    hops: HOPS_DEFAULT,
  }))
  return createMemo<ReadonlySet<string>>(() => {
    const shows = answer()?.shows
    if (shows === undefined || shows.kind !== "graph") return NOBODY
    const ids = new Set<string>()
    for (const vertex of shows.vertices) {
      if (vertex.address.kind === "node") ids.add(vertex.address.id)
    }
    return ids
  })
}

const NOBODY: ReadonlySet<string> = new Set()
