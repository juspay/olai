/**
 * *OPEN BESIDE ›* — THIS CONVERSATION, in the pane to the right of the one it
 * is being offered in.
 *
 * The sibling of `./OpenBeside.tsx` and its opposite. That button is on the
 * chat's own page and moves the ITEM next to the conversation; this one is on
 * every face drawn where the item already IS — a row's fold, a node's page,
 * the seat under a note — and moves the CONVERSATION next to the item. Both
 * end at the same two panes, and which one a person presses is only which
 * half they were looking at.
 *
 * It opens to the RIGHT and does not touch the pane it was pressed in: the
 * person is reading that outline or that note, and a verb about a
 * conversation may not take the page under it away. `openRight` reuses the
 * pane already there, so pressing it twice does not grow a column
 * (`Router.openRight`).
 *
 * ONCE A PANE HAS THE CHAT the same button reads *Shown beside* and focuses
 * that pane — and the face around it draws this line INSTEAD of the
 * conversation, which is the drawn-once rule (`./beside.ts`).
 */

import { type Accessor, createMemo, Show } from "solid-js"
import { type AgentItem, itemKey } from "@olai/format"
import { useHere, useRouter } from "olai-plugin-navigation/routing"

import { TESTID } from "../../testids.ts"
import { besideIn } from "./beside.ts"
import { chatRouteOf } from "./route.ts"
import { LINE_VERB } from "./verb.ts"

/** WHICH PANE IS ALREADY DRAWING THIS CHAT, read for the pane the component
 *  asking is drawn in (`./beside.ts` is the rule and the argument). `key` is
 *  the item's — a node's id, or `/` and a note's path, which is also the id
 *  of the chat row about it. */
export const useBeside = (key: Accessor<string>): Accessor<number | null> => {
  const router = useRouter()
  const here = useHere()
  return createMemo(() => besideIn(router.panes().map((pane) => pane.route()), key(), here()))
}

export function ChatBeside(props: { readonly item: AgentItem; readonly class?: string }) {
  const router = useRouter()
  const here = useHere()
  const beside = useBeside(() => itemKey(props.item))
  const press = () => {
    const at = beside()
    if (at !== null) router.focus(at)
    else router.openRight(here(), chatRouteOf(props.item))
  }
  return (
    <button
      type="button"
      class={props.class ?? LINE_VERB}
      data-testid={TESTID.chatBeside}
      data-beside={String(beside() !== null)}
      data-item={itemKey(props.item)}
      onClick={press}
    >
      <Show when={beside() === null} fallback={<>Shown beside</>}>Open beside ›</Show>
    </button>
  )
}
