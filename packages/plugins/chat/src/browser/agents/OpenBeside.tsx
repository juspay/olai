import { createMemo, Show } from "solid-js"
import type { AgentItem } from "@olai/format"
import { useRouter } from "olai-plugin-navigation/routing"
import { usePane } from "olai-plugin-navigation/pane"

import { TESTID } from "../../testids.ts"
import { desktop } from "../shell.ts"
import { showPane } from "./ChatBeside.tsx"
import { LINE_VERB } from "./verb.ts"
import { routeOfItem } from "./here.ts"
import { asideOf } from "./focus.ts"

export function OpenBeside(props: { readonly item: AgentItem; readonly name: string; readonly class?: string }) {
  const router = useRouter()
  const pane = usePane()
  const target = createMemo(() => routeOfItem(props.item))
  const shown = createMemo(() => router.panes().find((one) => router.routes.samePage(one.route(), target())))
  const press = () => {
    const already = shown()
    if (already !== undefined) { showPane(router, already.index()); return }
    const here = pane?.index ?? router.focusIndex()
    if (!desktop()) { router.openRight(here, target(), true); return }
    router.open(asideOf(router.workspace(), here, props.item))
  }
  return (
    <button
      type="button"
      class={props.class ?? LINE_VERB}
      data-testid={TESTID.chatOpenBeside}
      data-beside={String(shown() !== undefined)}
      onClick={press}
    >
      <Show when={desktop() && shown() !== undefined}
        fallback={desktop() ? `Open ${props.name} beside ›` : `Open ${props.name} ›`}>
        Shown beside
      </Show>
    </button>
  )
}
