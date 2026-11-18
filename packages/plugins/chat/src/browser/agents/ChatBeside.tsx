/**
 * *OPEN BESIDE ›* — THIS CONVERSATION, in the pane to the right of the one it
 * is being offered in.
 *
 * The sibling of `./OpenBeside.tsx` and its opposite. That button is on the
 * chat's own page and moves the ITEM next to the conversation; this one is on
 * every face drawn where the item already IS — a row's fold, a node's page,
 * the line at the top of a note — and moves the CONVERSATION next to the
 * item. Both end at the same two panes, and which one a person presses is
 * only which half they were looking at.
 *
 * It opens to the RIGHT and touches NO pane that is already open: not the one
 * it was pressed in — the person is reading that outline or that note, and a
 * verb about a conversation may not take the page under it away — and not the
 * one next to it either, which is a page somebody else put there. The chat is
 * a new column (`Router.openRight`'s `forceNew`). Pressing twice does not
 * grow one, because the second press finds the pane that has the chat and
 * goes there instead of opening anything.
 *
 * ONCE A PANE HAS THE CHAT the same button reads *Shown beside* and focuses
 * that pane — and the face around it draws this line INSTEAD of the
 * conversation, which is the drawn-once rule (`./beside.ts`). The press looks
 * for that pane INCLUDING THE ONE IT IS IN: pressed from the chat page
 * itself, the answer is "you are already there" rather than a second pane
 * with the same route.
 */

import { type Accessor, createMemo, Show } from "solid-js"
import { type AgentItem, itemKey } from "@olai/format"
import { useHere, useRouter, type Router } from "olai-plugin-navigation/routing"

import { TESTID } from "../../testids.ts"
import { besideIn, drawnIn } from "./beside.ts"
import { chatRouteOf } from "./route.ts"
import { LINE_VERB } from "./verb.ts"

/**
 * GO TO THE PANE THAT HAS IT — expand, then focus.
 *
 * A pane dragged shut is still a pane: it keeps its page and its width is
 * zero (`olai-plugin-navigation`'s `collapseAt`), and a rail with its name on
 * it is what a person sees. *Shown beside* pointed at exactly such a pane and
 * only moved the caret into it, so the press was a dead one — the sentence
 * said the conversation was beside you and the column it named stayed shut.
 *
 * BOTH VERBS, in this order, and neither is a history entry (each `replace`s
 * the address): a reader who shut that column is not going Back through an
 * expand to find the fold again.
 *
 * ONE SPELLING for the two buttons that end at a pane — this one and
 * *Open <name> beside* (`./OpenBeside.tsx`) — so they cannot disagree about
 * what "go there" means.
 */
export const showPane = (router: Router, index: number): void => {
  if (router.panes()[index]?.width() === 0) router.expand(index)
  router.focus(index)
}

/** WHICH PANE IS ALREADY DRAWING THIS CHAT, read for the pane the component
 *  asking is drawn in (`./beside.ts` is the rule and the argument). `key` is
 *  the item's — a node's id, or `/` and a note's path, which is also the id
 *  of the chat row about it. */
export const useBeside = (key: Accessor<string>): Accessor<number | null> => {
  const router = useRouter()
  const here = useHere()
  return createMemo(() => besideIn(router.panes().map((pane) => pane.route()), key(), here()))
}

/**
 * THE GESTURE BEHIND THE BUTTON, for a face that draws its own: which pane
 * has this chat, and the press that either goes there or opens it to the
 * right. The line at the top of a note is one button whose whole width does
 * this (`./NoteLine.tsx`), with this button at its end — two controls, one
 * verb, and the verb is written once.
 */
export const useChatBeside = (item: Accessor<AgentItem>): {
  readonly beside: Accessor<number | null>
  readonly press: () => void
} => {
  const router = useRouter()
  const here = useHere()
  const beside = useBeside(() => itemKey(item()))
  return {
    beside,
    press: () => {
      const at = drawnIn(router.panes().map((pane) => pane.route()), itemKey(item()))
      if (at !== null) showPane(router, at)
      // A NEW PANE TO THE RIGHT, never the one already there: the column
      // beside this one is a page somebody put there, and opening a
      // conversation is not a gesture that closes anything (`./focus.ts`).
      else router.openRight(here(), chatRouteOf(item()), true)
    },
  }
}

export function ChatBeside(props: { readonly item: AgentItem; readonly class?: string }) {
  const { beside, press } = useChatBeside(() => props.item)
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
