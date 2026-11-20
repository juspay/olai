import type { WorkspaceRouting } from "olai-plugin-navigation/workspace"
import { heldService } from "@olai/ui-primitives/held.ts"
import type { Route } from "olai-plugin-navigation/routes"
import {
  addressIn as addressWith,
  targetIn as targetWith,
  targetFace as targetFaceWith,
  type AddressTarget,
  type Faced,
  nameOf as nameWith,
  titleFace as titleFaceWith,
} from "olai-plugin-navigation/address/address.ts"
import { HOME_ROUTE, hrefOfPlain, type MountedNodePage } from "olai-plugin-navigation/routes"

const provider = heldService<WorkspaceRouting>()

export const holdRouting = provider.hold

export const hrefOf = (route: Route): string =>
  provider.read()?.href(route) ?? hrefOfPlain(HOME_ROUTE)

export const routeFace = (route: Route): MountedNodePage | null => {
  const face = provider.read()?.face(route)
  return face?.kind === "node" ? face : null
}

export const narrowable = (route: Route): boolean =>
  provider.read()?.narrowable(route) ?? false

export const narrowedTo = (route: Route, filter: string): Route =>
  provider.read()?.narrowedTo(route, filter) ?? route

export const filterOf = (route: Route): string =>
  provider.read()?.filterOf(route) ?? ""

export const samePage = (a: Route, b: Route): boolean =>
  provider.read()?.samePage(a, b) ?? a === b

export const addressIn = (title: string): Route | undefined => {
  const routes = provider.read()
  return routes === undefined ? undefined : addressWith(routes, title)
}

export const titleFace = (title: string, route: Route, shows: string | undefined): Faced => {
  const routes = provider.read()
  return routes === undefined
    ? { name: title, written: false }
    : titleFaceWith(routes, title, route, shows)
}

export const nameOf = (route: Route, shows: string | undefined): string => {
  const routes = provider.read()
  return routes === undefined ? hrefOfPlain(HOME_ROUTE) : nameWith(routes, route, shows)
}


export const targetIn = (title: string): AddressTarget | undefined => {
  const routes = provider.read()
  return routes === undefined ? undefined : targetWith(routes, title)
}

export const targetFace = (title: string, target: AddressTarget,
  shows: (route: Route) => string | undefined): Faced => {
  const routes = provider.read()
  return routes === undefined ? { name: title, written: false }
    : targetFaceWith(routes, title, target, shows)
}
