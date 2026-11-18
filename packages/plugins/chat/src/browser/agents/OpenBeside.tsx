/**
 * *OPEN <name> BESIDE ›* — the item into the pane on the LEFT, this chat into
 * the pane on its right.
 *
 * A conversation is about something, and reading the two together is the
 * whole point of a chat being a pane: the note on the left, the agent talking
 * about it on the right, in the order a person reads. So the press is two
 * router calls and not one — this pane becomes the ITEM (`goIn`), and the
 * chat is opened to its right (`openRight`) — rather than a new pane that
 * would land the item on the wrong side of the conversation.
 *
 * WHERE A PANE ALREADY SHOWS THE ITEM nothing is opened: the button reads
 * *Shown beside* and focuses that pane. Two panes on one note is a thing a
 * person can ask for by hand, and never a thing a button should do by
 * surprise — the layout is the address, and this one would quietly grow a
 * column every time it was pressed.
 *
 * ## On a phone it is *Open <name> ›*
 *
 * Below `md` the panes are a strip of tabs, one at a time
 * (`olai-plugin-layout`'s `Panes.tsx`), so there is no left and no right to
 * put anything on and *beside* names nothing a reader would see. The verb is
 * the same verb — the way from the conversation to the thing it is about — and
 * it adds the item as another TAB and goes there (`openRight`, which on a
 * strip is "the next one along"). The chat stays a tab away, which is the
 * whole reason the strip is kept in view while the page scrolls.
 */

import { createMemo, Show } from "solid-js"
import type { AgentItem } from "@olai/format"
import { useRouter } from "olai-plugin-navigation/routing"
import { navigateIn, openRight } from "olai-plugin-navigation/workspace"
import { usePane } from "olai-plugin-navigation/pane"

import { TESTID } from "../../testids.ts"
import { desktop } from "../shell.ts"
import { showPane } from "./ChatBeside.tsx"
import { LINE_VERB } from "./verb.ts"
import { routeOfItem } from "./here.ts"
import { chatRouteOf } from "./route.ts"

export function OpenBeside(props: { readonly item: AgentItem; readonly name: string; readonly class?: string }) {
  const router = useRouter()
  const pane = usePane()
  const target = createMemo(() => routeOfItem(props.item))
  /** The pane the item is already in, if any — asked of the router's own
   *  "same page" reading, so a pane narrowed by a filter still counts as
   *  showing it. */
  const shown = createMemo(() => router.panes().find((one) => router.routes.samePage(one.route(), target())))
  const press = () => {
    const already = shown()
    if (already !== undefined) { showPane(router, already.index()); return }
    const here = pane?.index ?? router.focusIndex()
    if (!desktop()) { router.openRight(here, target()); return }
    // ONE PRESS, ONE ENTRY. The two acts — this pane becomes the ITEM, the
    // chat opens to its right — are one gesture, so they are committed as one
    // workspace: pressed as `goIn` and then `openRight` they were two history
    // entries, and Back took two presses to undo a thing one press did. The
    // conversation still MOVES rather than reopening: the pane holding this
    // route keeps its identity when the new list is matched by address
    // (`olai-plugin-navigation`'s `createPaneState`).
    router.open(openRight(navigateIn(router.workspace(), here, target()), here, chatRouteOf(props.item)))
  }
  return (
    <button
      type="button"
      class={props.class ?? LINE_VERB}
      data-testid={TESTID.chatOpenBeside}
      data-beside={String(shown() !== undefined)}
      onClick={press}
    >
      {/* ON A PHONE IT ALWAYS READS *Open <name> ›*: the item is never on
          screen beside the conversation there, so *Shown beside* would be a
          sentence about a column that does not exist — and the press goes to
          its tab, which is the same verb as opening one. */}
      <Show when={desktop() && shown() !== undefined}
        fallback={desktop() ? `Open ${props.name} beside ›` : `Open ${props.name} ›`}>
        Shown beside
      </Show>
    </button>
  )
}
