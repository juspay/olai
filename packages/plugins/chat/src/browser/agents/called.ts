/**
 * WHAT AN ITEM IS CALLED — one name for the chat page's address, its head and
 * everything that draws either.
 *
 * A note is its file's NAME (`plan` for `notes/plan.md`, the sidebar's own
 * word for that file) — or its FOLDER's, where the file is a `README` — and a
 * node is its row's LIVE TITLE. Both move: rename the file or retitle the row
 * and the pane's header, the tab and the page's heading say the new thing on
 * the frame the store publishes, because neither is copied anywhere.
 *
 * ## Why the node's title is read off the ROSTER
 *
 * Because of who asks. A route's label is asked by the pane header, a tab, the
 * phone's strip and the rail — outside any component, with no owner to declare
 * an outline reading in, and often before anything has drawn the page. The
 * chat roster is the one live naming this plugin holds for its whole
 * activation (`./reading.ts`), and an item's chat page has a roster row
 * exactly when it has a chat, which is every page reached by pressing one.
 *
 * A NODE WITH NO CHAT YET IS LABELLED BY ITS ID, and that is not a gap this
 * leaves open: it is what core already does for that node's own page
 * (`labelIn` answers `order` for `/zoom/#order`), so the two panes agree. The
 * PAGE does better, because it has an owner to ask the outline with
 * (`./ChatPage.tsx`).
 *
 * PURE, with both readings handed in, so the rules are a table test rather
 * than something only a running tab can answer.
 */

import { type AgentItem, noteTitle, type Claims } from "@olai/format"

import { agentReadings } from "./reading.ts"

/** WHAT A NOTE'S CHAT IS CALLED: the directory's own word for the file
 *  (`plan` for `notes/plan.md`), except a `README`, which is called after its
 *  folder — `swatch` for `plugins/swatch/README.md`, so every plugin's
 *  builder chat is not the same word (`@olai/format`'s `noteTitle`, which the
 *  server titles the roster row with, so a chat with a row and a note without
 *  one are named by one rule).
 *
 *  WITH NO CLAIM TABLE YET the suffix is kept, which is the honest answer
 *  rather than a guess: which suffix a kind claimed is the directory's to
 *  say, and `plan.md` for a frame is a name a person recognises where `plan`
 *  would be this package deciding what `.md` means. */
export const nameOfNote = (claims: Claims | undefined, path: string): string =>
  claims === undefined ? path.slice(path.lastIndexOf("/") + 1) : noteTitle(claims, path)

/** The item's name: a note's file name, a node's title. */
export const nameOfItem = (
  item: AgentItem,
  claims: Claims | undefined,
  titled: (id: string) => string | null,
): string => item.kind === "node" ? titled(item.id) ?? item.id : nameOfNote(claims, item.path)

/** WHAT THE CHAT PAGE'S COLUMN IS CALLED — the item's name and the word
 *  `chat`. A note and its chat side by side are two panes about one thing,
 *  and a strip reading `plan | plan` tells a person nothing about which tab
 *  is which; `plan · chat` does. The PAGE's own title stays the bare name —
 *  the page is obviously a conversation once it is drawn, and it is the
 *  label, read where there is room for a word and no room for a page, that
 *  has to say so. */
export const labelOfChat = (
  item: AgentItem,
  claims: Claims | undefined,
  titled: (id: string) => string | null,
): string => `${nameOfItem(item, claims, titled)} · chat`

/** The live title of a node that has a chat, off this activation's roster. */
export const titleOfNode = (id: string): string | null => agentReadings()?.agents.at(id)?.title ?? null
