import { heldService } from "@olai/ui-primitives/held.ts"
import type { Route } from "olai-plugin-navigation/routes"
import {
  addressIn as addressWith,
  type Faced,
  nameOf as nameWith,
  titleFace as titleFaceWith,
} from "olai-plugin-navigation/address/address.ts"
import { HOME_ROUTE, hrefOfPlain, type Routing } from "olai-plugin-navigation/routes"

const provider = heldService<Routing>()

export const holdRouting = provider.hold

export const hrefOf = (route: Route): string =>
  provider.read()?.href(route) ?? hrefOfPlain(HOME_ROUTE)

export const routeIn = (href: string): Route | null =>
  provider.read()?.routeIn(href) ?? null

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
