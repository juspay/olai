import { agentReadings } from "./reading.ts"
import { NewChat, NewChatSaid } from "./NewChat.tsx"
import { Key } from "@solid-primitives/keyed"
import { createMemo, createSelector, Show } from "solid-js"
import { CHIP_QUIET } from "olai-plugin-layout/chip"
import { ENTRY_SHAPE, REGION, REGION_HEAD, REGION_LABEL } from "olai-plugin-layout/entry"
import { useShown, useRouter } from "olai-plugin-navigation/routing"
import { isCurrent } from "../../attention.ts"
import { DOT } from "@olai/web/client/readout.ts"
import { agoOf, createNow } from "@olai/web/client/ago.ts"
import { TESTID } from "../../testids.ts"
import { AgentMark } from "../chat/AgentMark.tsx"
import { useAgents } from "./answered.tsx"
import { createFocus } from "./focus.ts"
import { awake, LOOK, type Row } from "./roster.ts"
import { ChatRowMenu } from "./ChatRowMenu.tsx"
import { needing } from "./attention-order.ts"
import { byActivity } from "./activity-order.ts"
import { unfolded } from "./folding.ts"
import { dock } from "../dock.ts"

export function NeedsYou() {
  const shown = useShown()
  const readings = agentReadings()
  const agents = useAgents()
  const focus = createFocus()
  const rows = () => needing(agents.rows())
  return <Show when={rows().length > 0}>
    <section ref={element => readings?.needsSurface(element, shown)} class={REGION} data-testid={TESTID.agentNeedsYou} data-agent-needs-you tabIndex={-1}>
      <div class={REGION_HEAD}><h2 class={REGION_LABEL}>Needs you</h2></div>
      <ul class="m-0 list-none p-0"><Key each={rows()} by="id">{row => <li>
        <a href={focus.href(row())} class={`${ENTRY_SHAPE} w-full gap-2 text-left text-doing`} data-testid={TESTID.agentNeedRow}
          data-agent={row().id} data-standing={row().standing} on:olai-navigated={() => focus.visit(row())}>
          <span class={`${DOT} ${LOOK[row().standing].dot}`} aria-hidden="true" />
          <span class="min-w-0 flex-1 truncate">{row().title}</span>
          <Show when={row().standing === "gone"} fallback={<span class={CHIP_QUIET} data-testid={TESTID.agentWaiting}>{row().waiting}</span>}>
            <span class="shrink-0 text-label text-muted">Not running</span>
          </Show>
        </a>
      </li>}</Key></ul>
    </section>
  </Show>
}

export function Chats() {
  const agents = useAgents()
  const focus = createFocus()
  const router = useRouter()
  const now = createNow()
  /** THE CAP COMES AFTER THE ORDER, which is what makes it safe: the awake
   *  rows are already at the top (`./activity-order.ts`), so ten sleeping
   *  chats can never hide the agent that is waiting on an answer. */
  const rows = () => byActivity(agents.rows()).slice(0, 10)
  /** WHICH ROWS ARE CURRENT, decided once per navigation for the whole list and
   *  handed to each row through a selector: a route read inside every row put
   *  all ten on the router's clock, re-running them all to move one wash. The
   *  set is compared by membership, so a navigation that changes nothing here
   *  wakes nothing here either. */
  const currentIds = createMemo(() => {
    const route = router.route()
    return new Set(agents.rows().filter((row) => isCurrent(route, row, unfolded(row.id))).map((row) => row.id))
  }, new Set<string>(), { equals: (a, b) => a.size === b.size && [...a].every((id) => b.has(id)) })
  const current = createSelector<ReadonlySet<string>, string>(currentIds, (id, ids) => ids.has(id))
  return <section class={REGION} data-testid={TESTID.agentRoster}>
    <div class={REGION_HEAD}>
      <h2 class={REGION_LABEL}>Chats</h2>
      <NewChat />
    </div>
    <NewChatSaid />
    <ul class="m-0 list-none p-0"><Key each={rows()} by="id">{row => <li class="group/chat relative">
      <a href={focus.href(row())} class={`${ENTRY_SHAPE} w-full gap-2 text-left`} data-testid={TESTID.agentRow}
        data-agent={row().id} data-engine={row().engine} data-standing={row().standing} aria-current={current(row().id) ? "page" : undefined}
        data-unread={row().unread ? "true" : undefined}
        title={row().title} on:olai-navigated={() => focus.visit(row())}>
        <AgentMark id={row().engine} /><span class="sr-only">{row().engine}</span>
        {/* THE DOT SAYS WHETHER THIS CHAT IS AWAKE, and nothing finer: the
            four awake standings wear their own colour from the one table
            (`./roster.ts`), and an asleep, unbound or stopped row wears
            nothing — a list of chats is a list of what is there, and only the
            live ones are holding a seat. It is the answer to the question the
            column could not answer before: a ninth agent is refused for want
            of a seat, and WHICH EIGHT have one is now visible from here. Named
            for a reader who cannot see the colour; the exact standing is still
            `data-standing` on the row. */}
        <Show when={awake(row().standing)}>
          <span class={`${DOT} ${LOOK[row().standing].dot}`} role="img" aria-label={LOOK[row().standing].label} />
        </Show>
        <span class="min-w-0 flex-1 truncate" classList={{ "font-semibold": row().unread }}>
          {row().title}<Show when={row().unread}><span class="sr-only"> Unread</span></Show>
        </span>
        <Show when={row().said?.at ?? row().changed}>{at => <span class="shrink-0 tabular-nums text-caption text-muted">{agoOf(at(), now())}</span>}</Show>
      </a>
      {/* THE CONTROLS, beside the row rather than inside it: a control inside
          an anchor is a control whose activation is also a navigation (the
          pins' rule). Revealed on hover or focus, over the row's right edge on
          the column's own ground. The `•••` is always there — every row has
          verbs — and the dock door only where there is a seat to open, which
          the dock component's shell decides. */}
      <div class="absolute right-1 top-1/2 flex -translate-y-1/2 items-center gap-1">
        <Show when={dock()?.desktop()}>
          <button type="button"
            class={`inline-flex size-6 items-center justify-center rounded-control bg-desk text-muted opacity-0 shadow-raised hover:text-ink focus-visible:opacity-100 group-hover/chat:opacity-100`}
            data-testid={TESTID.chatDockOpen} data-agent={row().id}
            aria-label={`Open ${row().title} in the panel`} title="Open in the panel"
            onClick={(event) => { event.stopPropagation(); dock()?.open(row().id) }}>
            <svg viewBox="0 0 16 16" class="size-3.5" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5">
              <rect x="2" y="3" width="12" height="10" rx="1.5" />
              <path d="M9.5 3v10" />
            </svg>
          </button>
        </Show>
        <ChatRowMenu row={row()} />
      </div>
    </li>}</Key></ul>
  </section>
}
