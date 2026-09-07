/**
 * THE APP'S URL GRAMMAR, as an outline page spells it — held for the activation that
 * declared it.
 *
 * Printing a URL, parsing one, finding the tenant behind one and asking
 * whether a page takes a filter are questions about the MOUNTED ROSTER: a
 * plugin's page is spelled by that plugin, and a route whose tenant has left
 * spells the front page instead. They arrive on `navigation.state`
 * ({@link Routing}), declared on `../browser.tsx`'s `content` component.
 *
 * They used to be bare functions imported from `olai-plugin-navigation/routes`
 * over a module-scope claim table in that row's own door, so this package
 * parsed and printed against another activation's live state with nothing
 * declared anywhere (the audit's §2 and §12).
 *
 * THE PURE HALF IS STILL STATIC and is imported directly: `atFile`, `atNode`,
 * `atElement`, `HOME_ROUTE`, `fileNamed` and `hrefOfPlain` need no roster,
 * because there is no tenant in the arms they spell.
 *
 * With no navigation row mounted the readings below answer the front page and
 * nothing, which is the reading a page drawn outside a router already had.
 */
import { heldService } from "@olai/ui-primitives/held.ts"
import type { Route } from "olai-plugin-navigation/routes"
import {
  addressIn as addressWith,
  type Faced,
  nameOf as nameWith,
  titleFace as titleFaceWith,
} from "olai-plugin-navigation/address/address.ts"
import { HOME_ROUTE, hrefOfPlain, type MountedAppPage, type Routing } from "olai-plugin-navigation/routes"

const provider = heldService<Routing>()

/** Told by `../browser.tsx`'s `content` component, for that activation. */
export const holdRouting = provider.hold

/** The URL a route is at — the front page for a route whose tenant has left,
 *  and for a route asked before this package's navigation dependency landed. */
export const hrefOf = (route: Route): string =>
  provider.read()?.href(route) ?? hrefOfPlain(HOME_ROUTE)

/** The mounted tenant for a plugin route, or `null` after it left. */
export const routeFace = (route: Route): MountedAppPage | null =>
  provider.read()?.face(route) ?? null

/** Whether a page takes a filter at all. */
export const narrowable = (route: Route): boolean =>
  provider.read()?.narrowable(route) ?? false

/** The same page, narrowed — or not, where it takes no filter. */
export const narrowedTo = (route: Route, filter: string): Route =>
  provider.read()?.narrowedTo(route, filter) ?? route

/** What a page is narrowed BY. */
export const filterOf = (route: Route): string =>
  provider.read()?.filterOf(route) ?? ""

/** The same PAGE, whatever it is narrowed by. */
export const samePage = (a: Route, b: Route): boolean =>
  provider.read()?.samePage(a, b) ?? a === b

/** ...and the two address readings that go through it — the door's own pure
 *  helpers, bound to the same grammar (`olai-plugin-navigation/address`). */
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
