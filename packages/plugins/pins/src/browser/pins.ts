import type { Workspace } from "olai-plugin-navigation/workspace"

import { addressWritten } from "@olai/format"
import type { Pinned, Shelf } from "@olai/format"

import { targetIn,targetName,targetFace,type AddressTarget } from "olai-plugin-navigation/address/address.ts"
import type { Route } from "olai-plugin-navigation/routes"
import type { WorkspaceRouting as Routing } from "olai-plugin-navigation/workspace"

export interface Pin {
  readonly id: string
  readonly title: string
  readonly target: AddressTarget
  readonly name: string
  readonly at: string
  readonly bare: string
  readonly written: boolean
}

const pinOf = (routes: Routing, row: Pinned): Pin | undefined => {
  const target = targetIn(routes, row.title)
  if (target === undefined) return undefined
  const shows = (route: Route) => showing(route, row)
  const face = targetFace(routes, row.title, target, shows)
  return {
    id: row.id, title: row.title, target, at: addressWritten(row.title),
    ...face,
    bare: face.written ? targetName(routes, target, shows) : face.name,
  }
}

const showing = (route: Route, row: Pinned): string | undefined => {
  const address = route.kind === "at" ? route.address : null
  if (address === null || row.shows === undefined) return undefined
  return (address.kind === "node" || address.kind === "row") && address.id === row.shows.id
    ? row.shows.name
    : undefined
}

export const pinsOf = (
  routes: Routing,
  shelf: Shelf,
): ReadonlyArray<Pin> =>
  shelf.flatMap((row) => {
    const pin = pinOf(routes, row)
    return pin === undefined ? [] : [pin]
  })

export const pinnedAt = (routes: Routing, shelf: Shelf, route: Route): Pin | undefined => {
  const address = routes.href(route)
  return pinsOf(routes, shelf).find((pin) => pin.target.kind === "page" && routes.href(pin.target.route) === address)
}


export const pinnedLayout = (routes: Routing, shelf: Shelf, workspace: Workspace): Pin | undefined =>
  pinsOf(routes, shelf).find((pin) => pin.target.kind === "layout"
    && routes.layoutHref(pin.target.workspace) === routes.layoutHref(workspace))
