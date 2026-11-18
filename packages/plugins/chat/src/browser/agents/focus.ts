/**
 * WHERE A CHAT OPENS when somebody presses it — its own page, alone, or that
 * page with the note it is about beside it.
 *
 * ## The switch is the address
 *
 * A note carries `chat-opens` (`./Opens.tsx` writes it, the roster reads it as
 * `beside`), and a press obeys it: `beside` opens the WORKSPACE *[note |
 * chat]* — the note on the left, the conversation on the right, focus on the
 * conversation — and everything else opens the chat page alone. A layout IS an
 * address in olai (`olai-plugin-navigation`'s `workspace.ts`), so this is one
 * href either way: the row is a plain link, `Alt`-press still means *to the
 * right*, a reload restores the split, and the address a person copies out of
 * the bar opens what they were looking at.
 *
 * A NODE ALWAYS OPENS ALONE. The switch lives in a note's front matter and a
 * row has nowhere to keep one, so `beside` is always `false` for a node
 * (`@olai/format`'s `NodeAgent`).
 *
 * ## One door for every press
 *
 * The sidebar's **Chats** and **Needs you** rows, the palette's agent rows,
 * the pill above a node and a crumb's mark all spend this, so none of them can
 * come to a different answer about where a conversation lives — and the person
 * who set a note's chat to open beside gets that wherever they press it.
 *
 * NO FACE AND NO HOOK IN HERE, deliberately: the palette's levels are plain
 * values a bun test loads directly (`./new-chat-level.browsertest.ts`), and a
 * module of theirs that reached navigation's `routing.tsx` would drag a
 * renderer in with it. The row that needs a router reads one itself
 * (`./Agents.tsx`).
 */
import { type AgentItem, itemOf } from "@olai/format"
import { focusAt, hrefOfWorkspace, navigateIn, openRight, panesOf, type AddressTarget, type Workspace, type WorkspaceRouting } from "olai-plugin-navigation/workspace"
import type { Route } from "olai-plugin-navigation/routes"
import { drawnIn } from "./beside.ts"
import { talking, type Row } from "./roster.ts"
import { unfold } from "./folding.ts"
import { agentReadings } from "./reading.ts"
import { routeOfItem } from "./here.ts"
import { chatRouteOf } from "./route.ts"
/** Opening a conversation marks it visited and unfolds it — under its row, so
 *  the outline it came from still holds the conversation when the reader goes
 *  back. A chat with no conversation yet has nothing to unfold. */
export const visitAgent = (row: Row): void => {
  agentReadings()?.visit(row.id)
  if (talking(row)) unfold(row.id)
}
/** This chat's page, `/chat/<item>` (`./route.ts`) — the address of the
 *  conversation itself, whatever else opens with it. */
export const chatRoute = (row: Row): Route => chatRouteOf(itemOf(row.id))
/**
 * THE ITEM AND ITS CHAT, SIDE BY SIDE — the pane a press lands in becomes the
 * ITEM, and the conversation opens in a NEW pane to its right.
 *
 * ONE SPELLING for the two gestures that end there: a *beside* row's press
 * ({@link chatTarget}) and *Open <name> beside* on the chat's own page
 * (`./OpenBeside.tsx`), which arrive from opposite halves and must land on
 * the same two columns.
 *
 * COMPOSED AGAINST THE LAYOUT THAT IS OPEN, not out of thin air: a workspace
 * built from `lone(note)` names TWO panes, so pressing it with three open
 * replaced all three. And `forceNew`, rather than `openRight`'s ordinary
 * reuse of the column already there — the column to the right is a page
 * somebody put there, and opening a conversation closes nothing.
 */
export const asideOf = (workspace: Workspace, index: number, item: AgentItem): Workspace =>
  openRight(navigateIn(workspace, index, routeOfItem(item)), index, chatRouteOf(item), true)
/**
 * ...AND THE WHOLE OF WHAT A PRESS OPENS: the page alone, or the item and the
 * chat side by side with the chat focused.
 *
 * COMPOSED AGAINST THE LAYOUT THAT IS OPEN and never overwriting a column to
 * make room — {@link asideOf} is that rule, and this is where a row spends
 * it.
 *
 * UNLESS THE CHAT IS ALREADY DRAWN somewhere in this layout, in which case
 * that pane is the answer and the press only focuses it (`./beside.ts`'s
 * `drawnIn`, the reading every *Shown beside* spends): a second column on one
 * conversation is the drawn-twice bug this change exists to refuse.
 */
export const chatTarget = (row: Row, here: Workspace): AddressTarget => {
  const item = itemOf(row.id)
  const chat = chatRouteOf(item)
  if (!row.beside) return { kind: "page", route: chat }
  const withItem = navigateIn(here, here.focus, routeOfItem(item))
  const already = drawnIn(panesOf(withItem).map((pane) => pane.route), row.id)
  return {
    kind: "layout",
    workspace: already === null
      ? asideOf(here, here.focus, item)
      : focusAt(withItem, already),
  }
}
/** The address of {@link chatTarget}, for a row that is a link. */
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
