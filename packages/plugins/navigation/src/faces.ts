/**
 * WHAT OTHER PLUGINS HUNG, as navigation reads it — the routes a plugin claims
 * a URL grammar with, and the palette's rows and the verbs behind its prefixes.
 *
 * Private to this package, for `olai-plugin-layout`'s `faces.ts` reason. Both
 * readings are held by COMPONENTS rather than by the row: history and focus
 * activate without a renderer (`./browser.tsx`'s header), and a row that named
 * {@link Faces} would start waiting for one.
 *
 * ## TWO HOLDERS, because there are two CONSUMERS with two lifetimes
 *
 * There was one, and both components held into it. That is not a tidiness
 * point: the two components stop at different moments — the palette
 * additionally names `layout.shell` and the clock, so switching the layout row
 * off stops the palette and leaves the renderer standing — and a holder cleared
 * by the departing one is a holder the survivor was still reading through.
 *
 * The observed consequence was the route table going empty under a live
 * renderer: `hung("app.route")` answered `[]`, the claims settled to
 * `NO_PAGES`, and `/d/2026-09-07` stopped being the journal's page and became
 * a vault path. `./faces.browsertest.ts` pins exactly that.
 *
 * ## Why a shared holder could not be rescued by a better token
 *
 * The old release compared the SERVICE VALUE, and both components hold the
 * same `Faces` object — the renderer's slot table is one thing the provider
 * hands to everybody — so the palette's release matched the renderer's hold and
 * cleared it. Minting a token per hold ({@link heldFaces} does that now, and
 * should) fixes the mistaken identity and not the shape: with two holds into
 * one slot, the second still displaces the first, and releasing the second
 * still leaves the first consumer reading an absence.
 *
 * So each consumer holds its OWN, and each reading below belongs to exactly one
 * of them — which is what the code already did with the readings themselves:
 * the renderer settles `app.route`, the palette draws `app.command` and
 * `app.palette`, and neither has ever read the other's.
 */
import { heldFaces } from "@olai/plugin-api"

/** THE RENDERER'S, and the only reader is `./browser.tsx`'s settling of
 *  `app.route` into `./pages.ts`. */
export const { hold: holdRouteFaces, hung: routeFaces } = heldFaces()

/** ...and THE PALETTE'S: the commands behind its prefixes and the rows other
 *  rows hang in it (`./palette/Palette.tsx`). */
export const { hold: holdPaletteFaces, hung: paletteFaces, only: paletteOnly } = heldFaces()
