import { type AgentItem, itemOf } from "@olai/format"
import { focusAt, hrefOfWorkspace, navigateIn, openRight, panesOf, type AddressTarget, type Workspace, type WorkspaceRouting } from "olai-plugin-navigation/workspace"
import type { Route } from "olai-plugin-navigation/routes"
import { drawnIn, shownIn } from "./beside.ts"
import { talking, type Row } from "./roster.ts"
import { unfold } from "./folding.ts"
import { agentReadings } from "./reading.ts"
import { routeOfItem } from "./here.ts"
import { chatRouteOf } from "./route.ts"
export const visitAgent = (row: Row): void => {
  agentReadings()?.visit(row.id)
  if (talking(row)) unfold(row.id)
}
export const chatRoute = (row: Row): Route => chatRouteOf(itemOf(row.id))
export const asideOf = (workspace: Workspace, index: number, item: AgentItem): Workspace =>
  openRight(navigateIn(workspace, index, routeOfItem(item)), index, chatRouteOf(item), true)
export const chatTarget = (row: Row, here: Workspace): AddressTarget => {
  const item = itemOf(row.id)
  const chat = chatRouteOf(item)
  if (!row.beside) return { kind: "page", route: chat }
  const routes = panesOf(here).map((pane) => pane.route)
  const shown = shownIn(routes, item)
  const open = shown === null ? navigateIn(here, here.focus, routeOfItem(item)) : here
  const drawn = drawnIn(panesOf(open).map((pane) => pane.route), row.id)
  const workspace = drawn !== null ? focusAt(open, drawn)
    : shown !== null ? openRight(here, shown, chat, true)
      : asideOf(here, here.focus, item)
  return { kind: "layout", workspace }
}
export const chatHref = (routes: WorkspaceRouting, row: Row, here: Workspace): string => {
  const target = chatTarget(row, here)
  return target.kind === "page" ? routes.href(target.route) : hrefOfWorkspace(routes, target.workspace)
}
export const focusAgent = (
  nav: {
    readonly go: (route: Route) => void
    readonly open: (workspace: Workspace) => void
    readonly workspace: () => Workspace
  },
  row: Row,
): void => {
  const target = chatTarget(row, nav.workspace())
  if (target.kind === "page") nav.go(target.route)
  else nav.open(target.workspace)
  visitAgent(row)
}
