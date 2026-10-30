/**
 * WHICH ANCESTOR HAS AN AGENT, as a client join over readings this tab already
 * holds.
 *
 * A node's ancestry is a FORMAT/OUTLINES fact — no server map of node → nearest
 * agent exists, and none should: the answer moves whenever any ancestor's
 * binding or conversation moves, and the page readings already carry every fact
 * needed to join it here. A zoomed reading carries `zoomed.trail`; a day or the
 * agenda carries each entry's `trail`; a file's rows carry `shows.node.parent`
 * and nothing else needed for the walk. This module turns whichever page is
 * open into `node → its ancestors, outermost first`, and `./AgentAbove.tsx`
 * turns that into a roster row.
 *
 * ## Where the reading comes from
 *
 * `pageReadings()` is split per pane (`../pages.ts`), so the order is the panes'
 * own: the page the node is on answers, and a second pane's page is asked only
 * when the first did not hold it. That is what lets a row's `•••`, a palette
 * row and a split's two pages all share one answer without any of them naming
 * a pane.
 */
import type { Row as TreeRow, Shown } from "@olai/format"

import { navigation } from "../navigation.ts"
import { pageReadings } from "../pages.ts"
import type { Roster } from "./answered.tsx"
import type { Row } from "./roster.ts"

/** The crumbs a trail-shaped reading carries (`zoomed.trail`, `dated.trail`). */
type Trail = ReadonlyArray<{ readonly node: { readonly id: string; readonly parent?: string | undefined } }>

/**
 * One page as a parent graph plus the trails it states outright.
 *
 * `trails` is the direct answer a page already computed (a zoomed subject's
 * ancestry, a day entry's) and `parents` is every node the page draws with its
 * own `parent`, so a node under a zoomed subject or inside a file's tree is
 * walked rather than looked up. A mirror is keyed by the record it SHOWS, which
 * is the same node its crumbs are about.
 */
interface Graph {
  readonly parents: Map<string, string | undefined>
  readonly trails: Map<string, ReadonlyArray<string>>
}

const graphOf = (shows: Shown): Graph => {
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
    case "trash":
      for (const group of shows.groups) walk(group.rows)
      break
  }
  return { parents, trails }
}

/** One page's answer for a node, or `undefined` when the page does not hold it. */
const ancestryOn = (shows: Shown, node: string): ReadonlyArray<string> | undefined => {
  const graph = graphOf(shows)
  const stated = graph.trails.get(node)
  if (stated !== undefined) return stated
  if (!graph.parents.has(node)) return undefined
  const out: Array<string> = []
  const seen = new Set([node])
  let parent = graph.parents.get(node)
  // A walk and not a recursion: a set the validator would condemn has loops,
  // and a crumb trail that never ends is worse than a short one.
  while (parent !== undefined && !seen.has(parent)) {
    out.unshift(parent)
    seen.add(parent)
    parent = graph.parents.get(parent)
  }
  return out
}

/** Every open pane's page, in the panes' order. */
const pages = (): ReadonlyArray<Shown> => {
  const nav = navigation()
  const readings = pageReadings()
  if (nav === undefined || readings === undefined) return []
  return nav.panes().flatMap((pane) => {
    const shows = readings.at(pane.id)?.shows
    return shows === undefined ? [] : [shows]
  })
}

/** The ancestors of `node`, outermost first, from the first open page that
 *  holds it. Reading this inside a memo tracks the roster AND the pages, so a
 *  moved page or a started/stopped agent retargets it. */
export const trailOf = (node: string): ReadonlyArray<string> => {
  for (const shows of pages()) {
    const found = ancestryOn(shows, node)
    if (found !== undefined) return found
  }
  return []
}

/** The nearest of these ancestors the live roster knows, or `undefined`. */
export const agentAbove = (trail: ReadonlyArray<string>, roster: Roster): Row | undefined => {
  // Reversed: the CLOSEST ancestor is the last crumb, and the pill names only
  // that one even where several ancestors have agents.
  for (let at = trail.length - 1; at >= 0; at--) {
    const row = roster.at(trail[at]!)
    if (row !== undefined) return row
  }
  return undefined
}

/** ...and the same answer for a node, resolved against the pages now open. */
export const agentAboveOf = (node: string, roster: Roster): Row | undefined =>
  agentAbove(trailOf(node), roster)
