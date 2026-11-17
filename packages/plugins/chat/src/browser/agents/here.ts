/**
 * WHICH CHAT IS HERE — the one question every face asks before it draws a
 * conversation on a page, as a pure function of the route and the directory's
 * claim table.
 *
 * Only two things can have a chat: an olai NODE and a NOTE. So a page answers
 * at most one item, and most pages answer none:
 *
 *   - a document page whose file is a note is that note (`notes/plan.md`,
 *     and a heading inside it is still the note);
 *   - a node's own page (`/zoom/#order`, the `/#order` reveal) is that node;
 *   - everything else — a whole outline, a row landing inside one, a picture,
 *     a `.csv`, the Trash, a day, a plugin's page — has no chat at all.
 *
 * WHICH FILES ARE NOTES IS THE DIRECTORY'S ANSWER and not a suffix this
 * package spells (`@olai/format`'s `isNotePath`, read off the claim table the
 * serve published). A page read before that table has arrived is no item:
 * nothing can be said about a file whose kind nobody has said yet.
 *
 * PURE, so the rules are a table test (`./here.test.ts`) rather than something
 * a component decides, and so the seat, the sidebar's lit row and a tab's dot
 * cannot come to three answers about one page.
 */
import { type AgentItem, type Claims, isNotePath, itemKey, itemOf } from "@olai/format"
import { atFile, fileNamed, type Route, zoomNode } from "olai-plugin-navigation/routes"
import { chatPage } from "./route.ts"

/** The item a page is about, or `null` for a page nothing can be said to. */
export const itemHere = (claims: Claims | undefined, route: Route): AgentItem | null => {
  if (route.kind !== "at" || route.address === null) return null
  const address = route.address
  // A ROW ADDRESS IS NOT ITS ROW'S PAGE: `house.olai#install` is the outline,
  // landed at that row, and an outline has no chat. The row's own page is an
  // `AtNode`, which is the arm above.
  if (address.kind === "row") return null
  if (address.kind === "node") return { kind: "node", id: address.id }
  if (claims === undefined) return null
  return isNotePath(claims, address.path) ? { kind: "note", path: address.path } : null
}

/** ...and the same answer for the faces that only ever take a note: the page's
 *  seat, the palette's door, the side panel's **This page**. */
export const noteHere = (claims: Claims | undefined, route: Route): string | null => {
  const item = itemHere(claims, route)
  return item === null || item.kind !== "note" ? null : item.path
}

/** WHERE AN ITEM ITSELF OPENS: a note's page, or a node's own page —
 *  `/zoom/#id`, not the `/#id` reveal. What *Open <name> beside* puts in the
 *  pane next to a chat, and the page a conversation is ABOUT. Where the chat
 *  itself opens is its own address (`./route.ts`). */
export const routeOfItem = (item: AgentItem): Route =>
  item.kind === "note" ? atFile(item.path) : zoomNode(item.id)

/**
 * IS `route` THIS CHAT? Its OWN PAGE (`/chat/<item>`), the page its item is —
 * a note's note, a node's own page — or, for a node, its outline in front
 * with the conversation unfolded on its row, which is the rule a node's chat
 * has always had. What the sidebar lights a **Chats** row by, and what a
 * tab's dot follows (offered to the tabs row as `chat.state`'s `isCurrent`).
 */
export const isCurrent = (
  claims: Claims | undefined,
  route: Route,
  row: { readonly id: string; readonly file: string },
  unfolded: boolean,
): boolean => {
  const chat = chatPage.value(route)
  if (chat !== null) return itemKey(chat) === row.id
  const here = itemHere(claims, route)
  if (here !== null && itemKey(here) === row.id) return true
  return itemOf(row.id).kind === "node" && unfolded && fileNamed(route) === row.file
}
