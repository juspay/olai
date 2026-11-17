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
 */

import { createMemo, Show } from "solid-js"
import type { AgentItem } from "@olai/format"
import { useRouter } from "olai-plugin-navigation/routing"
import { usePane } from "olai-plugin-navigation/pane"

import { TESTID } from "../../testids.ts"
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
    if (already !== undefined) { router.focus(already.index()); return }
    const here = pane?.index ?? router.focusIndex()
    router.goIn(here, target())
    router.openRight(here, chatRouteOf(props.item))
  }
  return (
    <button
      type="button"
      class={props.class ?? LINE_VERB}
      data-testid={TESTID.chatOpenBeside}
      data-beside={String(shown() !== undefined)}
      onClick={press}
    >
      <Show when={shown() === undefined} fallback={<>Shown beside</>}>{`Open ${props.name} beside ›`}</Show>
    </button>
  )
}
