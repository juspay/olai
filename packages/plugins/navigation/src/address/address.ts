import { basenameOf, linkedTitle, titleAddress } from "@olai/format"

import { panesOf, type Workspace, type WorkspaceRouting } from "../workspace.ts"
import type { Names } from "olai-plugin-outlines/names"
import type { Route, Routing } from "olai-plugin-navigation/routes"

export type { AddressTarget } from "../workspace.ts"
import type { AddressTarget } from "../workspace.ts"

export const addressIn = (
  routes: Routing,
  title: string,
): Route | undefined => {
  const address = written(title)
  return address === undefined ? undefined : routes.routeIn(address) ?? undefined
}

const written = titleAddress

export const labelIn = (title: string): string | undefined => {
  const label = linkedTitle(title)?.label.trim()
  return label === undefined || label === "" ? undefined : label
}

export interface Faced {
  readonly name: string
  readonly written: boolean
}

export const titleFace = (
  routes: Routing,
  title: string,
  route: Route,
  shows: string | undefined,
): Faced => {
  const written = labelIn(title)
  return { name: written ?? nameOf(routes, route, shows), written: written !== undefined }
}

export const nameOf = (
  routes: Routing,
  route: Route,
  shows: string | undefined,
): string => {
  switch (route.kind) {
    case "at": {
      const address = route.address
      if (address === null) return "Home"
      if (address.kind === "node") return shows ?? routes.href(route)
      if (address.kind === "row") return shows ?? basenameOf(address.path)
      return basenameOf(address.path)
    }
    case "trash":
      return "Trash"
    case "plugin":
      return routes.face(route)?.route.breadcrumb(route.value) ?? routes.href(route)
  }
}

export const shownIn = (
  names: Names,
  route: Route,
): string | undefined => {
  const address = route.kind === "at" ? route.address : null
  if (address === null || (address.kind !== "node" && address.kind !== "row")) return undefined
  return names(address.id)?.title
}


export const targetIn = (routes: WorkspaceRouting, title: string): AddressTarget | undefined => {
  const address = written(title)
  return address === undefined ? undefined : routes.destinationIn(address) ?? undefined
}

export const layoutName = (routes: Routing, workspace: Workspace,
  shows: (route: Route, index: number) => string | undefined = () => undefined): string =>
  panesOf(workspace).map(({ route }, index) => nameOf(routes, route, shows(route, index))).join(" · ")

export const targetName = (routes: Routing, target: AddressTarget,
  shows: (route: Route) => string | undefined): string => target.kind === "page"
    ? nameOf(routes, target.route, shows(target.route))
    : layoutName(routes, target.workspace, shows)

export const targetFace = (routes: Routing, title: string, target: AddressTarget,
  shows: (route: Route) => string | undefined): Faced => {
  const written = labelIn(title)
  return { name: written ?? targetName(routes, target, shows), written: written !== undefined }
}
