import type { Row as TreeRow, Shown } from "@olai/format"

import { navigation } from "../navigation.ts"
import { pageReadings } from "../pages.ts"
import type { Roster } from "./answered.tsx"
import type { Row } from "./roster.ts"

type Trail = ReadonlyArray<{ readonly node: { readonly id: string; readonly parent?: string | undefined } }>

interface Graph {
  readonly parents: Map<string, string | undefined>
  readonly trails: Map<string, ReadonlyArray<string>>
}

const graphs = new WeakMap<Shown, Graph>()

const graphOf = (shows: Shown): Graph => {
  const cached = graphs.get(shows)
  if (cached !== undefined) return cached
  const parents = new Map<string, string | undefined>()
  const trails = new Map<string, ReadonlyArray<string>>()
  const record = (trail: Trail): ReadonlyArray<string> => {
    for (const crumb of trail) parents.set(crumb.node.id, crumb.node.parent)
    return trail.map((crumb) => crumb.node.id)
  }
  const walk = (rows: ReadonlyArray<TreeRow>): void => {
    for (const row of rows) {
      if (row.kind !== "node" && row.kind !== "mirror") continue
      parents.set(row.shows.node.id, row.shows.node.parent)
      walk(row.children)
    }
  }
  const groups = (groups: ReadonlyArray<{ readonly nodes: ReadonlyArray<{ readonly shows: { readonly node: { readonly id: string } }; readonly trail: Trail }> }>): void => {
    for (const group of groups) for (const entry of group.nodes) trails.set(entry.shows.node.id, record(entry.trail))
  }
  switch (shows.kind) {
    case "outline":
      walk(shows.rows)
      break
    case "node":
      if (shows.zoomed.kind === "node") {
        trails.set(shows.zoomed.shows.node.id, record(shows.zoomed.trail))
        walk(shows.zoomed.children)
      }
      break
    case "day":
      groups(shows.groups)
      break
    case "agenda":
      groups(shows.agenda.today)
      for (const day of [...shows.agenda.overdue, ...shows.agenda.upcoming]) groups(day.groups)
      break
  }
  const graph = { parents, trails }
  graphs.set(shows, graph)
  return graph
}

const ancestryOn = (shows: Shown, node: string): ReadonlyArray<string> | undefined => {
  const graph = graphOf(shows)
  const stated = graph.trails.get(node)
  if (stated !== undefined) return stated
  if (!graph.parents.has(node)) return undefined
  const out: Array<string> = []
  const seen = new Set([node])
  let parent = graph.parents.get(node)
  while (parent !== undefined && !seen.has(parent)) {
    const stated = graph.trails.get(parent)
    if (stated !== undefined) {
      out.unshift(...stated, parent)
      break
    }
    out.unshift(parent)
    seen.add(parent)
    parent = graph.parents.get(parent)
  }
  return out
}

const pages = (): ReadonlyArray<Shown> => {
  const nav = navigation()
  const readings = pageReadings()
  if (nav === undefined || readings === undefined) return []
  return nav.panes().flatMap((pane) => {
    const shows = readings.at(pane.id)?.shows
    return shows === undefined ? [] : [shows]
  })
}

export const trailOf = (node: string): ReadonlyArray<string> => {
  for (const shows of pages()) {
    const found = ancestryOn(shows, node)
    if (found !== undefined) return found
  }
  return []
}

export const agentAbove = (trail: ReadonlyArray<string>, roster: Roster): Row | undefined => {
  for (let at = trail.length - 1; at >= 0; at--) {
    const row = roster.at(trail[at]!)
    if (row !== undefined) return row
  }
  return undefined
}

export const agentAboveOf = (node: string, roster: Roster): Row | undefined =>
  agentAbove(trailOf(node), roster)
