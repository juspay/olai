import { workspaceRoutingOver, type WorkspaceRouting } from "./workspace.ts"
import { TEST_CLAIMS } from "@olai/format/testlib"
import {
  atElement,
  atFile,
  atNode,
  HOME_ROUTE,
  type MountedPages,
  type Route,
  routingOver,
} from "./routes.ts"

export const routingIn = (pages: MountedPages = []): WorkspaceRouting => workspaceRoutingOver(routingOver(() => TEST_CLAIMS, () => pages))

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
  { ...atFile("house.olai"), filter: "is:done" },
  { kind: "trash", filter: "hinges" },
  { ...HOME_ROUTE, filter: "#home -is:done" },
  { ...atNode("kitchen"), filter: "date:2026-08-01..2026-08-14" },
  { ...atNode("kitchen"), filter: "a query with  spaces & an ampersand" },
  { ...atFile("house.olai"), filter: `"pick the hinges" OR knobs` },
  atElement(TEST_CLAIMS, "garden.md", "beds"),
  atElement(TEST_CLAIMS, "notes/report.html", "Q3 revenue"),
  atElement(TEST_CLAIMS, "house.olai", "kitchen"),
  { ...atElement(TEST_CLAIMS, "house.olai", "install"), filter: "#home" },
  ...[...TEST_CLAIMS.byKind.values()].flatMap((claim) =>
    claim.exts.flatMap((ext) => [
      atFile(`drawer/tool${ext}`),
      atElement(TEST_CLAIMS, `drawer/tool${ext}`, "the inner bit"),
    ])
  ),
]
