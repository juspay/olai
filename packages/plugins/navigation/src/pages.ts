/**
 * THE ROUTES THE MOUNTED PLUGINS CLAIM — this row's own table, and PRIVATE to
 * this package.
 *
 * It is a projection of `Faces`: `./browser.tsx`'s `renderer` component reads
 * `app.route` off the renderer's slot table and settles it into the claim list
 * (`./routes.ts`'s `settleRoutePages`, which decides claim priority and reports
 * an overlap). That component is where the dependency on the renderer is
 * DECLARED, and this module is where its answer is held for that activation.
 *
 * ## What this replaced
 *
 * A module variable in `./routes.ts` — a declared contract door — with a
 * `holdRoutePages` beside it. Five packages parsed and printed URLs against it
 * with no dependency declared anywhere, and `routeFace` handed the mounted
 * CONTRIBUTION of another row straight across the wall. The grammar takes the
 * table as an argument now, and what crosses to another package is the bound
 * {@link Routing} capability on `navigation.state`.
 *
 * ## The empty answer is a real state, and it is this row's
 *
 * With no renderer contributing, no plugin claims a URL — so `/d/2026-09-07`
 * is read by the address grammar rather than by the journal, which is the
 * reading this app has always had before its renderer settled. It is not a
 * reading any OTHER package can now reach by accident: a consumer asks
 * `navigation.state`, and a consumer that has one is a consumer this row is
 * mounted for.
 */
import { heldService } from "@olai/ui-primitives/held.ts"

import { type MountedPages, NO_PAGES, type Routing, routingOver } from "./routes.ts"

const table = heldService<() => MountedPages>()

/** Told by `./browser.tsx`'s `renderer` component, for that activation. */
export const holdRoutePages = table.hold

/** The claim table as it stands — empty while no renderer is contributing. */
export const routePages = (): MountedPages => table.read()?.() ?? NO_PAGES

/**
 * ...and the grammar bound over it — the value `navigation.state` carries and
 * this package's own modules spend.
 *
 * ONE binding rather than one per reader, because it closes over an accessor
 * rather than a snapshot: two would be two objects answering the same question
 * about the same table, which is a distinction with nothing behind it.
 */
export const routing: Routing = routingOver(routePages)
