/**
 * `/chat/<item>` — ONE CONVERSATION'S OWN PAGE, as an address.
 *
 * ## Why a chat has an address at all
 *
 * Because it is one of the two things a person opens here, and until now it
 * had nowhere to be opened TO: a conversation was drawn under the row it
 * belonged to, or in a seat at the foot of a note, or in a panel beside the
 * page — three places, none of them linkable, none of them a pane. A chat
 * with an address is a chat that can be a pane of its own beside the thing it
 * is about, pinned, reopened by a reload, and sent to somebody.
 *
 * ## The item IS the address
 *
 * `/chat/notes/plan.md` and `/chat/order`: the whole value is the item, in
 * the two namespaces `@olai/format`'s `itemKey` already keeps apart — an id
 * olai writes is `[A-Za-z0-9_-]+` (`ID_SHAPE`), so nothing a node is called
 * can be read as a path and nothing a path can be read as a node. The path is
 * escaped per SEGMENT (`spellPath`/`readPath`), so a chat page's URL escapes a
 * filename exactly as every other link to that file does, and a `/` in the
 * address is a folder rather than a `%2F`.
 *
 * WHETHER THE PATH IS A NOTE IS THE DIRECTORY'S ANSWER (`isNotePath`, over the
 * claim table the serve published), and this grammar asks it: `.csv`, a
 * picture and a saved page have no chat, so `/chat/data/costs.csv` is not this
 * page and navigation falls through to whatever else claims it. BEFORE THAT
 * TABLE ARRIVES a path is admitted, which is the same bargain core's own
 * grammar strikes one function over (`routes.ts`'s unclaimed-file arm): the
 * first paint of a reloaded tab has no claims yet, and a grammar that refused
 * its own address until the wire answered would lose the address rather than
 * draw it a frame late.
 *
 * NOT NARROWABLE. `?q=` means *show me less of this page*, and the page is one
 * conversation: there is nothing here to select.
 */

import { type AgentItem, type Claims, ID_SHAPE, isNotePath, readPath, spellPath } from "@olai/format"
import { defineSelfDrawnRoute } from "olai-plugin-navigation/routes"

import { servedDirectory } from "../vault.ts"
import { labelOfChat, titleOfNode } from "./called.ts"

/** The prefix this page claims. Trailing slash, so `/chat` itself is not ours:
 *  a list of chats is the sidebar's job, and claiming the bare word would take
 *  an address away from a page that might want it. */
export const CHAT_PATH = "/chat/"

/** The item an address names, or `null` for an address that is not this page —
 *  the whole grammar, as a pure function of the claim table and the path, so
 *  the rules are a table test rather than something only a running tab can
 *  answer. */
export const itemAt = (claims: Claims | undefined, pathname: string): AgentItem | null => {
  if (!pathname.startsWith(CHAT_PATH)) return null
  const rest = pathname.slice(CHAT_PATH.length)
  if (rest === "") return null
  if (ID_SHAPE.test(rest)) return { kind: "node", id: rest }
  const path = readPath(rest)
  if (path === null || path === "" || path.startsWith("/") || path.endsWith("/")) return null
  if (path.split("/").some((segment) => segment === "" || segment === "." || segment === "..")) return null
  if (claims === undefined) return { kind: "note", path }
  return isNotePath(claims, path) ? { kind: "note", path } : null
}

/** ...and the same rule read backwards: what this page is written as. A
 *  node's id is spelled BARE — `ID_SHAPE` is the alphabet the parse arm tests
 *  against the raw segment, so an escape could only ever produce a spelling
 *  that arm then refuses. */
export const chatSpelling = (item: AgentItem): string =>
  item.kind === "node" ? item.id : spellPath(item.path)

export const chatPage = defineSelfDrawnRoute<AgentItem>({
  claims: [{ kind: "prefix", path: CHAT_PATH }],
  // THE CLAIM TABLE IS READ HERE, off the held directory this row already
  // holds for its faces (`../vault.ts`): the grammar is spelled by a plugin
  // whose whole activation has that reading, and a parse is asked inside the
  // same memos the claims move through, so a table that arrives re-reads the
  // address rather than leaving it half-read.
  parse: (pathname) => itemAt(servedDirectory()?.claims(), pathname),
  href: (item) => `${CHAT_PATH}${chatSpelling(item)}`,
  // THE CRUMB IS THE ITEM'S NAME AND THE WORD `chat`, and the page itself
  // draws no breadcrumb at all: this is what the pane's header, a tab, the
  // phone's tab strip and a folded pane's rail read, and a column headed
  // `/notes/plan.md` or a uuid is a column nobody can tell from the one
  // beside it — while a bare `plan` beside the note's own `plan` is a column
  // nobody can tell from its neighbour either (`./called.ts` is the whole of
  // the naming, and says where each half comes from).
  breadcrumb: (item) => labelOfChat(item, servedDirectory()?.claims(), titleOfNode),
  narrowable: false,
})

/** WHERE AN ITEM'S CHAT IS: its own page, which is the only place a
 *  conversation is drawn as a page. Every door that opens a chat — the
 *  sidebar's **Chats** and **Needs you** rows, the palette's agent rows, the
 *  pill above a node — goes through `./focus.ts`, which
 *  spends this. */
export const chatRouteOf = (item: AgentItem) => chatPage.to(item)
