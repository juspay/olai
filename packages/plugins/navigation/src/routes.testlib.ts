import { TEST_CLAIMS } from "@olai/format/testlib"
/**
 * THE ROUTE VOCABULARY, shared — every address the app can SPELL, as the
 * routes they read back to, the day either reader asks.
 *
 * Two tests read it, and each asks the other half of the same promise:
 *
 *   - `./routes.test.ts`'s bijection: a link the app WRITES that it cannot
 *     READ BACK is a page that loads as something else on a reload;
 *   - `olai-plugin-outlines`'s `browser/address.test.ts` delegation: `addressIn`
 *     adds nothing of its own, so a title and a written link come to ONE answer.
 *
 * THE TABLE IS THE MECHANISM: a new claim must be a row here the day it is
 * the grammar's (`./routes.ts`'s `NAMED` table is deliberately module-private,
 * so this file is the vocabulary's one shared spelling) — and the file-kind
 * block below is not even a hand list: it enumerates `@olai/format`'s
 * `FILE_KINDS`, so a suffix the registry claims the day it is claimed is a row
 * here the same day.
 *
 * IT IS A DECLARED DOOR (`./routes.testlib.ts` in this manifest's `exports` and
 * `olai.contracts`), and that is the second reader's doing rather than a
 * decoration. The table used to live in `@olai/web` as `client/routes.testlib.ts`
 * — a general package spelling `olai-plugin-navigation` to build it, which is
 * the equality `@olai/bundle`'s `fence.test.ts` holds — and the outlines bench
 * that reads it is another plugin, which may reach this package only through a
 * STATIC door. Undeclared, the same import would be red in that file's
 * "plugins consume other plugins only through static contract doors".
 */



import {
  atElement,
  atFile,
  atNode,
  HOME_ROUTE,
  type MountedPages,
  type Route,
  type Routing,
  routingOver,
} from "./routes.ts"

/**
 * THE GRAMMAR BOUND OVER A GIVEN ROSTER — what a bench spends where the app
 * spends `Router.routes`.
 *
 * The roster-dependent half of the grammar takes the mounted claim table as an
 * argument now (`./routes.ts`'s header), so a bench that used to call
 * `hrefOf(route)` names the roster it is asking about. `routingIn([])` is *no
 * plugin claims a URL*, which is what nearly every bench means and what the
 * app itself answers before a renderer has contributed anything.
 */
export const routingIn = (pages: MountedPages = []): Routing => routingOver(() => TEST_CLAIMS, () => pages)

export const ROUTES: ReadonlyArray<Route> = [
  HOME_ROUTE,
  atFile("house.olai"),
  atFile("wing/kitchen.olai"),
  atFile("a file with spaces.olai"),
  atFile("finishes.md"),
  atFile("notes/deep/plan.md"),
  atNode("kitchen"),
  atNode("a-minted_id9"),
  { kind: "trash" },
  // ...and the same pages, narrowed. The filter is part of the address, so it
  // is part of the round trip: a query the app writes into the bar and cannot
  // read back is a page that loses its filter on reload.
  { ...atFile("house.olai"), filter: "is:done" },
  // The computed page remains narrowable even though it is read-only.
  { kind: "trash", filter: "hinges" },
  { ...HOME_ROUTE, filter: "#home -is:done" },
  // A narrowed NODE page is the case the query's position is decided by: the
  // address is a fragment, and a URL puts its query in front of one.
  { ...atNode("kitchen"), filter: "date:2026-08-01..2026-08-14" },
  { ...atNode("kitchen"), filter: "a query with  spaces & an ampersand" },
  // A quoted phrase is the query that puts a `"` — and the spaces it exists to
  // keep — into the address. A narrowed page is a link somebody sends, so the
  // quotes have to survive the trip both ways.
  { ...atFile("house.olai"), filter: `"pick the hinges" OR knobs` },
  // …and a document at a place INSIDE it, which is the other thing an address
  // here carries. A `#` that could not be read back is a link into a section
  // that lands at the top of the page the moment it is reloaded or shared.
  atElement(TEST_CLAIMS, "garden.md", "beds"),
  atElement(TEST_CLAIMS, "notes/report.html", "Q3 revenue"),
  // …and an OUTLINE at one, the row arm: the qualified spelling of a node,
  // kept rather than normalised, since the outline gained its landing.
  atElement(TEST_CLAIMS, "house.olai", "kitchen"),
  { ...atElement(TEST_CLAIMS, "house.olai", "install"), filter: "#home" },
  // One page per suffix the registry claims, and one at a place inside it:
  // the registry is the grammar's own census of what a path can mean, so a
  // kind it learns is a row here the day it is learned, not when somebody
  // remembers.
  ...[...TEST_CLAIMS.byKind.values()].flatMap((claim) =>
    claim.exts.flatMap((ext) => [
      atFile(`drawer/tool${ext}`),
      atElement(TEST_CLAIMS, `drawer/tool${ext}`, "the inner bit"),
    ])
  ),
]
