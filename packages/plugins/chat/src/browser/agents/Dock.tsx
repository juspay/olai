/**
 * THE DOCK, DRAWN — the seat's face (`../dock.ts` says what the dock is).
 *
 * A bar at the top names the docked agent: its engine mark, its standing dot,
 * its title as a link to the node's own page, a switch to any other
 * conversation and the way to shut the column. Under it, the same
 * `Conversation` a row's fold draws, in its `dock` arrangement: the transcript
 * is the one thing that scrolls, uncapped, and the composer sits at the foot
 * of the column rather than under a 24rem window.
 *
 * WITH NOTHING DOCKED the column is the roster as a picker — every chat, most
 * recently active first — because a reader who opened the panel wants a
 * conversation in it, and a blank column would be a question with no way to
 * answer it. The same rows are the switch's menu while something is docked.
 *
 * KEYED ON THE NODE, deliberately: a different conversation is a different
 * reading, and the fold does the same (`./Fold.tsx`). Switching between two
 * agents remounts the transcript and the composer; the drafts survive it, held
 * per conversation by the activation (`./reading.ts`).
 */
import { createMemo, For, Show } from "solid-js"

import { createInlinePicker } from "@olai/web/client/inlinePicker.ts"
import { WITHIN } from "@olai/web/client/layer.ts"
import { DOT } from "@olai/web/client/readout.ts"
import { ICON_BUTTON } from "@olai/web/client/readout.ts"
import { MENU_ITEM } from "@olai/ui-primitives/menu.ts"
import { Link } from "olai-plugin-navigation/routing"
import { zoomNode } from "olai-plugin-navigation/routes"

import { TESTID } from "../../testids.ts"
import { AgentMark } from "../chat/AgentMark.tsx"
import { ConversationUIProvider } from "../chat/ui.tsx"
import { dock } from "../dock.ts"
import { useAgents } from "./answered.tsx"
import { byActivity } from "./activity-order.ts"
import { createNodeConversation } from "./conversation.ts"
import { Conversation } from "./Fold.tsx"
import { LOOK, type Row } from "./roster.ts"

export function Dock() {
  const agents = useAgents()
  const door = () => dock()
  const node = () => door()?.node()
  /** The docked row, or nothing — a node whose binding left (the agent was
   *  closed, the row trashed) is nothing too, and the picker comes back. */
  const row = createMemo((): Row | undefined => {
    const id = node()
    return id === undefined ? undefined : agents.at(id)
  })
  const rows = () => byActivity(agents.rows())

  return (
    <section
      class="flex min-h-0 min-w-0 flex-1 flex-col"
      data-testid={TESTID.chatDock}
      data-agent={row()?.id}
      data-standing={row()?.standing}
      aria-label="Agent panel"
    >
      <header class="relative flex h-9 shrink-0 items-center gap-2 border-b border-rule px-2">
        <Show
          when={row()}
          fallback={<span class="min-w-0 flex-1 truncate px-1 text-label font-semibold text-muted">Chats</span>}
        >
          {(agent) => (
            <>
              <AgentMark id={agent().engine} />
              <span class={`${DOT} ${LOOK[agent().standing].dot}`} title={LOOK[agent().standing].detail} aria-hidden="true" />
              <Link
                route={zoomNode(agent().id)}
                class="min-w-0 flex-1 truncate text-body font-medium text-ink no-underline hover:text-accent"
                testid={TESTID.chatDockTitle}
                title="Open the agent's page"
              >
                {agent().title}
              </Link>
            </>
          )}
        </Show>
        <Switch rows={rows()} current={row()?.id} />
        <button
          type="button"
          class={`${ICON_BUTTON} !px-0 md:!w-7`}
          data-testid={TESTID.chatDockClose}
          aria-label="Close the agent panel"
          title="Close the agent panel (⌘J)"
          onClick={() => door()?.close()}
        >
          <span aria-hidden="true" class="text-title leading-none">×</span>
        </button>
      </header>
      <Show when={row()?.id} keyed fallback={<Picker rows={rows()} />}>
        {(id) => <Docked node={id} />}
      </Show>
    </section>
  )
}

/** The docked conversation: the fold's reading, in the dock's arrangement. */
function Docked(props: { readonly node: string }) {
  const { chat } = createNodeConversation(() => props.node)
  return (
    <Show when={chat()} keyed fallback={<p class="m-0 px-3 py-4 text-label text-muted">Opening…</p>}>
      {(current) => (
        <ConversationUIProvider value={current.ui}>
          <Conversation chat={current} node={props.node} dock />
        </ConversationUIProvider>
      )}
    </Show>
  )
}

/** One chat as a row of the picker and of the switch's menu. */
function ChatRow(props: { readonly row: Row; readonly current: boolean; readonly onPick: () => void; readonly testid: string }) {
  return (
    <button
      type="button"
      class={`${MENU_ITEM} flex w-full items-center gap-2 text-body`}
      classList={{ "bg-ink/8": props.current }}
      data-testid={props.testid}
      data-agent={props.row.id}
      data-standing={props.row.standing}
      aria-current={props.current ? "true" : undefined}
      onClick={props.onPick}
    >
      <AgentMark id={props.row.engine} />
      <span class={`${DOT} ${LOOK[props.row.standing].dot}`} aria-hidden="true" />
      <span class="min-w-0 flex-1 truncate" classList={{ "font-semibold": props.row.unread }}>{props.row.title}</span>
      <span class="shrink-0 text-caption text-muted">{LOOK[props.row.standing].label}</span>
    </button>
  )
}

/** The column with nothing docked: every chat, newest activity first. */
function Picker(props: { readonly rows: ReadonlyArray<Row> }) {
  return (
    <div class="olai-scroll min-h-0 flex-1 overflow-y-auto p-1" data-testid={TESTID.chatDockPicker}>
      <Show when={props.rows.length > 0} fallback={
        <p class="m-0 px-3 py-6 text-label text-muted">No chats yet. Start an agent on any row, or press + beside Chats.</p>
      }>
        <p class="m-0 px-2 pb-1 pt-2 text-caption font-semibold uppercase tracking-[0.08em] text-muted">Open a conversation</p>
        <For each={props.rows}>
          {(row) => <ChatRow row={row} current={false} testid={TESTID.chatDockPick} onPick={() => dock()?.open(row.id)} />}
        </For>
      </Show>
    </div>
  )
}

/** The switch: the same rows as the picker, hung off a button in the bar. */
function Switch(props: { readonly rows: ReadonlyArray<Row>; readonly current: string | undefined }) {
  const picker = createInlinePicker<true>({ opening: () => true })
  return (
    <Show when={props.rows.length > 1 || (props.rows.length === 1 && props.current === undefined)}>
      <button
        type="button"
        ref={picker.setTrigger}
        class={`${ICON_BUTTON} !px-0 md:!w-7`}
        data-testid={TESTID.chatDockSwitch}
        aria-label="Switch conversation"
        title="Switch conversation"
        aria-expanded={picker.open()}
        onClick={picker.toggle}
      >
        <svg viewBox="0 0 16 16" class="size-3.5" aria-hidden="true" fill="currentColor">
          <path d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06z" />
        </svg>
      </button>
      <Show when={picker.open()}>
        {/* Its own class list rather than `MENU_PANEL`, which spells `relative`:
            two position utilities on one box are settled by emission order,
            and this one has to be ABSOLUTE under the bar. */}
        <ul ref={picker.setList} class={`absolute inset-x-2 top-full ${WITHIN.pop} mt-1 max-h-80 list-none overflow-y-auto rounded-surface border border-rule bg-panel p-1 text-body text-ink shadow-raised`} data-testid={TESTID.chatDockMenu}>
          <For each={props.rows}>
            {(row) => (
              <li>
                <ChatRow row={row} current={row.id === props.current} testid={TESTID.chatDockPick}
                  onPick={() => { picker.shut(); dock()?.open(row.id) }} />
              </li>
            )}
          </For>
        </ul>
      </Show>
    </Show>
  )
}
