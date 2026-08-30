/**
 * EVERY PLUGIN'S TEST IDS, in one table — the fourth door, and the narrowest.
 *
 * ## Why the suite cannot reach a plugin directly
 *
 * `./fence.test.ts` holds ONE claim as an equality per package: no package
 * outside this one imports a plugin, or declares one in its manifest. That
 * includes `@olai/tests`, which is exactly where a `data-testid` is spent. So
 * the ids route through the registry, which is the package a plugin's name is
 * allowed to be written in — the same shape `./all.css` takes for the
 * stylesheets and for the same reason.
 *
 * ## NAMES ONLY, and that is a graph claim rather than a style one
 *
 * The modules behind this door import nothing at all. That is load-bearing:
 * `@olai/tests` runs under a cucumber process with no browser in it, and a
 * testid door that pulled a COMPONENT would put SolidJS — and, behind kolu's, a
 * terminal emulator — on the graph of a suite that only wanted a string. It
 * would also pull `@olai/web`'s own `wire.ts`, which dials at module scope and
 * throws without a `location`; that is not hypothetical, it is the boot death
 * `@olai/tests`' own import fence was written after.
 *
 * ## Why a `data-testid` is worth a door at all
 *
 * It is a contract between two packages that never import each other, and the
 * way that contract normally breaks is silent: someone renames an attribute, the
 * selector still compiles, and a scenario fails thirty seconds later with a
 * timeout that says nothing about why. Declaring them once and importing them on
 * both sides makes a rename a type error — which is `@olai/web`'s own testid
 * table's argument, held across one more wall.
 *
 * ## One flat record, and what would make that wrong
 *
 * The ids are merged rather than keyed by plugin, because a scenario asks "what
 * is the padi feed called", not "what does the kolu plugin call its feed". A
 * COLLISION would be the thing that breaks it — two plugins claiming one key —
 * and it would resolve silently in favour of whichever was spread last. That is
 * not left to luck: {@link PLUGIN_TESTID} is asserted disjoint in
 * `./testids.test.ts`, which is the same move `fuseGroups` makes about wire tags
 * one module over and for the identical reason.
 */

import { TESTID as kolu } from "@olai/plugin-kolu/testids"
import { TESTID as odu } from "@olai/plugin-odu/testids"

/** Every plugin's ids, flat. See the header on the merge and what proves it
 *  safe. */
export const PLUGIN_TESTID = { ...kolu, ...odu } as const

/** One of them, as a closed union — so `@olai/web`'s `selector` takes an id
 *  from either table and a typo is still a type error rather than a selector
 *  that matches nothing. */
export type PluginTestId = (typeof PLUGIN_TESTID)[keyof typeof PLUGIN_TESTID]
