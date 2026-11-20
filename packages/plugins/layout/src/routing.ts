import { heldService } from "@olai/ui-primitives/held.ts"
import type { Route } from "olai-plugin-navigation/routes"
import { HOME_ROUTE, hrefOfPlain, labelIn, NO_PAGES, type Routing } from "olai-plugin-navigation/routes"

const provider = heldService<Routing>()

export const holdRouting = provider.hold

export const hrefOf = (route: Route): string =>
  provider.read()?.href(route) ?? hrefOfPlain(HOME_ROUTE)

export const labelOf = (route: Route): string =>
  provider.read()?.label(route) ?? labelIn(NO_PAGES, route)

export const nameOf = (route: Route): string =>
  provider.read()?.name(route) ?? labelOf(route)
