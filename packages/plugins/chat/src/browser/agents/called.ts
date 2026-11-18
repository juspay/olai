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
 * than something only a running tab can answer — except the one live thing at
 * the foot of the file, which is a drawn page lending its own reading of the
 * outline to the label ({@link namesNode}).
 */

import { type AgentItem, nodeChatTitle, noteTitle, type Claims } from "@olai/format"
import { type Accessor, createEffect, createSignal, onCleanup } from "solid-js"
import { heldService } from "@olai/ui-primitives/held.ts"

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

/** The item's name: a note's file name, a node's title — and a node's title
 *  is its LINK'S LABEL where the row is written as one markdown link
 *  (`[plan](/notes/plan.md)`), which is `@olai/format`'s `nodeChatTitle`, the
 *  rule the roster already titles a row with. Applied HERE as well as there,
 *  because the title handed in is the roster's for a row that has a chat and
 *  the OUTLINE'S OWN for a row that has none — the row the one-time move
 *  leaves behind is exactly such a row, and `[plan](/notes/plan.md)` is not a
 *  name anybody wrote to be read. */
export const nameOfItem = (
  item: AgentItem,
  claims: Claims | undefined,
  titled: (id: string) => string | null,
): string => item.kind === "node"
  ? nodeChatTitle(titled(item.id) ?? item.id)
  : nameOfNote(claims, item.path)

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

/**
 * THE LIVE TITLE OF A NODE — the roster's for a row that has a chat, and, for
 * a row that has none, whatever the chat page drawn about that row learnt
 * from the outline ({@link namesNode}).
 *
 * The second half is what a TAB needs. A label is asked by the pane header,
 * the phone's strip and the rail — outside any component, with no owner to
 * declare an outline reading in — so a node with no chat used to be labelled
 * by its id, and a row written as one link (`[plan](/notes/plan.md)`, what the
 * one-time move leaves behind) by that raw text wherever the page's own
 * reading reached. The page HAS an owner and is already asking; this is that
 * answer, lent to the label for exactly as long as the page is drawn.
 */
export const titleOfNode = (id: string): string | null =>
  agentReadings()?.agents.at(id)?.title ?? titles.read()?.at(id) ?? null

/**
 * THE TITLES THE DRAWN PAGES OF THIS TAB HAVE — node id → the title a chat
 * page is reading for it, rebuilt from the pages themselves rather than
 * written key by key, so two panes on one node cannot clear each other's
 * entry when one of them closes.
 *
 * HELD FOR THE ACTIVATION, like the fold and the closes beside it
 * (`./closing.ts`, `./folding.ts`): what a drawn page lends the label is this
 * chat plugin's, and a plugin that goes away takes it with it — a withdrawn
 * chat used to leave this map populated and go on answering out of it. A
 * label asked with nothing held falls back to the id, which is the honest
 * answer when there is no chat plugin to have drawn anything.
 */
export const createDrawnTitles = () => {
  const [drawn, setDrawn] = createSignal<ReadonlyMap<string, string>>(new Map())
  const pages = new Map<object, readonly [string, string]>()
  const republish = (): void => {
    const next = new Map<string, string>()
    for (const [id, title] of pages.values()) next.set(id, title)
    setDrawn(next)
  }
  return {
    at: (id: string): string | null => drawn().get(id) ?? null,
    /** One page's answer, by its own token — `null` takes its entry away. */
    says: (token: object, said: readonly [string, string] | null): void => {
      if (said === null) pages.delete(token)
      else pages.set(token, said)
      republish()
    },
  }
}
const titles = heldService<ReturnType<typeof createDrawnTitles>>()
export const holdDrawnTitles = titles.hold

/** A page saying what the node it is about is called, for as long as it is
 *  drawn. The token is this page's own identity, so the entry goes when the
 *  page does and not when another page about another node is disposed. A page
 *  about a NOTE, and one whose outline has not answered yet, publish nothing
 *  — an absent entry is what leaves the label its own fallback. */
export const namesNode = (id: Accessor<string | null>, title: Accessor<string | null>): void => {
  const token = {}
  createEffect(() => {
    const node = id()
    const said = node === null ? null : title()
    titles.read()?.says(token, node === null || said === null ? null : [node, said])
  })
  onCleanup(() => titles.read()?.says(token, null))
}
