/**
 * WHERE A LINK LANDS — the one answer both kinds give: the place it found, or
 * that it found nothing and what it looked for. A standard link looks for a
 * path beside the file that wrote it (`./standard.ts`); a wikilink looks for a
 * name across the directory (`./wikilink.ts`). The dead-link reading and the
 * page ask this, so a link is dead for an agent exactly when it is drawn dead.
 */
import type { Cut } from "@olai/prose/cut.ts"
import type { WikilinkName } from "@olai/prose/wikilink.ts"

import type { Address } from "../address.ts"
import type { Claims } from "../kinds.ts"
import type { Names } from "./names.ts"
import { addressOfPlace, placeOf } from "./standard.ts"
import { wikilinkAddress } from "./wikilink.ts"

/** The address a link found, or the path or name it looked for and did not. */
export type Landing =
  | { readonly found: Address }
  | { readonly lookedFor: string }

/** Where a standard link lands among `served`, or `null` for one this app
 *  does not resolve (`./standard.ts`'s `placeOf`) or one the address grammar
 *  has no address for. */
export const standardLanding = (
  claims: Claims,
  served: ReadonlySet<string>,
  from: string,
  link: Cut,
): Landing | null => {
  const place = placeOf(from, link)
  if (place === null) return null
  if (place.kind === "file" && !served.has(place.path)) return { lookedFor: place.path }
  const found = addressOfPlace(claims, place)
  return found === null ? null : { found }
}

/** Where a wikilink lands from `from`, or `null` for one that names no file
 *  to look for — a heading of the writer, written somewhere with none. */
export const wikilinkLanding = (
  names: Names,
  claims: Claims,
  from: string,
  link: WikilinkName,
): Landing | null => {
  const found = wikilinkAddress(names, claims, from, link)
  if (found !== null) return { found }
  return link.target === "" ? null : { lookedFor: link.target }
}
