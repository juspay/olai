import { type Accessor, createMemo, Show } from "solid-js"
import { type AgentItem, itemKey } from "@olai/format"
import { useHere, useRouter, type Router } from "olai-plugin-navigation/routing"

import { TESTID } from "../../testids.ts"
import { besideIn, drawnIn } from "./beside.ts"
import { chatRouteOf } from "./route.ts"
import { LINE_VERB } from "./verb.ts"

export const showPane = (router: Router, index: number): void => {
  if (router.panes()[index]?.width() === 0) router.expand(index)
  router.focus(index)
}

export const useBeside = (key: Accessor<string>): Accessor<number | null> => {
  const router = useRouter()
  const here = useHere()
  return createMemo(() => besideIn(router.panes().map((pane) => pane.route()), key(), here()))
}

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
