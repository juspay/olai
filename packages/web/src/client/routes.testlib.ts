/**
 * THE ROUTE VOCABULARY, shared — every address the app can SPELL, as the
 * routes they read back to, the day either reader asks.
 *
 * Two tests read it, and each asks the other half of the same promise:
 *
 *   - `./routes.test.ts`'s bijection: a link the app WRITES that it cannot
 *     READ BACK is a page that loads as something else on a reload;
 *   - `./address/address.test.ts`'s delegation: `addressIn` adds nothing of
 *     its own, so a title and a written link come to ONE answer.
 *
 * THE TABLE IS THE MECHANISM: a new claim must be a row here the day it is
 * the grammar's (`./routes.ts`'s `NAMED` table is deliberately module-private,
 * so this file is the vocabulary's one shared spelling) — and the file-kind
 * block below is not even a hand list: it enumerates `@olai/format`'s
 * `FILE_KINDS`, so a suffix the registry claims the day it is claimed is a row
 * here the same day.
 */

import { FILE_KINDS } from "@olai/format"

import { atElement, atFile, atNode, HOME_ROUTE, type Route } from "./routes.ts"

export const ROUTES: ReadonlyArray<Route> = [
  HOME_ROUTE,
  atFile("house.org"),
  atFile("wing/kitchen.org"),
  atFile("a file with spaces.org"),
  atFile("finishes.md"),
  atFile("notes/deep/plan.md"),
  atNode("kitchen"),
  atNode("a-minted_id9"),
  { kind: "day", date: "2026-08-10" },
  { kind: "today" },
  { kind: "agenda" },
  { kind: "trash" },
  // ...and the same pages, narrowed. The filter is part of the address, so it
  // is part of the round trip: a query the app writes into the bar and cannot
  // read back is a page that loses its filter on reload.
  { ...atFile("house.org"), filter: "is:done" },
  // The four that grew one under `search-everywhere`. A day and the agenda are
  // date questions and the trash is read-only, and neither of those is a reason
  // not to be able to look through what they are showing.
  { kind: "day", date: "2026-08-10", filter: "is:todo" },
  { kind: "today", filter: "#home" },
  { kind: "agenda", filter: "is:blocked" },
  { kind: "trash", filter: "hinges" },
  { ...HOME_ROUTE, filter: "#home -is:done" },
  // A narrowed NODE page is the case the query's position is decided by: the
  // address is a fragment, and a URL puts its query in front of one.
  { ...atNode("kitchen"), filter: "date:2026-08-01..2026-08-14" },
  { ...atNode("kitchen"), filter: "a query with  spaces & an ampersand" },
  // A quoted phrase is the query that puts a `"` — and the spaces it exists to
  // keep — into the address. A narrowed page is a link somebody sends, so the
  // quotes have to survive the trip both ways.
  { ...atFile("house.org"), filter: `"pick the hinges" OR knobs` },
  // …and a document at a place INSIDE it, which is the other thing an address
  // here carries. A `#` that could not be read back is a link into a section
  // that lands at the top of the page the moment it is reloaded or shared.
  atElement("garden.md", "beds"),
  atElement("notes/report.html", "Q3 revenue"),
  // …and an OUTLINE at one, the row arm: the qualified spelling of a node,
  // kept rather than normalised, since the outline gained its landing.
  atElement("house.org", "kitchen"),
  { ...atElement("house.org", "install"), filter: "#home" },
  // One page per suffix the registry claims, and one at a place inside it:
  // the registry is the grammar's own census of what a path can mean, so a
  // kind it learns is a row here the day it is learned, not when somebody
  // remembers.
  ...Object.values(FILE_KINDS).flatMap((claim) =>
    claim.exts.flatMap((ext) => [
      atFile(`drawer/tool${ext}`),
      atElement(`drawer/tool${ext}`, "the inner bit"),
    ])
  ),
]
