import { NewChat } from "./NewChat.tsx"
import { Key } from "@solid-primitives/keyed"
import { Show } from "solid-js"
import { CHIP_QUIET } from "olai-plugin-layout/chip"
import { ENTRY_SHAPE, REGION, REGION_LABEL } from "olai-plugin-layout/entry"
import { useRouter } from "olai-plugin-navigation/routing"
import { fileNamed } from "olai-plugin-navigation/routes"
import { DOT } from "@olai/web/client/readout.ts"
import { agoOf, createNow } from "@olai/web/client/ago.ts"
import { TESTID } from "../../testids.ts"
import { AgentMark } from "../chat/AgentMark.tsx"
import { useAgents } from "./answered.tsx"
import { createFocus } from "./focus.ts"
import { LOOK, type Row } from "./roster.ts"
import { needing } from "./attention-order.ts"
import { byActivity } from "./activity-order.ts"
import { unfolded } from "./folding.ts"

export function NeedsYou() {
  const agents = useAgents()
  const focus = createFocus()
  const rows = () => needing(agents.rows())
  return <Show when={rows().length > 0}>
    <section class={REGION} data-testid={TESTID.agentNeedsYou} data-agent-needs-you tabIndex={-1}>
      <h2 class={REGION_LABEL}>Needs you</h2>
      <ul class="m-0 list-none p-0"><Key each={rows()} by="id">{row => <li>
        <button type="button" class={`${ENTRY_SHAPE} w-full gap-2 text-left text-doing`} data-testid={TESTID.agentNeedRow}
          data-agent={row().id} data-standing={row().standing} onClick={() => focus.press(row())}>
          <span class={`${DOT} ${LOOK[row().standing].dot}`} aria-hidden="true" />
          <span class="min-w-0 flex-1 truncate">{row().title}</span>
          <Show when={row().standing === "gone"} fallback={<span class={CHIP_QUIET} data-testid={TESTID.agentWaiting}>{row().waiting}</span>}>
            <span class="shrink-0 font-mono text-xs text-paper/55">not running</span>
          </Show>
        </button>
      </li>}</Key></ul>
    </section>
  </Show>
}

export function Chats() {
  const agents = useAgents()
  const focus = createFocus()
  const router = useRouter()
  const now = createNow()
  const rows = () => byActivity(agents.rows()).slice(0, 10)
  const current = (row: Row) => {
    const route = router.route()
    return (fileNamed(route) === row.file && unfolded(row.id))
      || (route.kind === "at" && route.address?.kind === "node" && route.address.id === row.id)
  }
  return <section class={REGION} data-testid={TESTID.agentRoster}>
    <h2 class={REGION_LABEL}>Chats</h2>
    <ul class="m-0 list-none p-0"><NewChat /><Key each={rows()} by="id">{row => <li>
      <button type="button" class={`${ENTRY_SHAPE} w-full gap-2 text-left`} data-testid={TESTID.agentRow}
        data-agent={row().id} data-engine={row().engine} data-standing={row().standing} aria-current={current(row()) ? "page" : undefined}
        title={row().title} onClick={() => focus.press(row())}>
        <AgentMark id={row().engine} /><span class="sr-only">{row().engine}</span><span class="min-w-0 flex-1 truncate">{row().title}</span>
        <span class="inline-flex shrink-0 items-center gap-2">
          <span class={`${DOT} ${LOOK[row().standing].dot}`} role="img" aria-label={LOOK[row().standing].label} title={LOOK[row().standing].detail} />
          <Show when={row().said?.at ?? row().changed}>{at => <span class="font-mono text-xs text-paper/55">{agoOf(at(), now())}</span>}</Show>
        </span>
      </button>
    </li>}</Key></ul>
  </section>
}
