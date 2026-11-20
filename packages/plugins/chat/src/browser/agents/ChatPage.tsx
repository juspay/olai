import { LAYER } from "@olai/web/client/layer.ts"
import { DOT } from "@olai/web/client/readout.ts"
import { MARK_BOX } from "@olai/ui-primitives/mark.ts"
import { CLEARANCE } from "olai-plugin-layout/clearance"
import { type AgentItem, itemKey } from "@olai/format"
import { createEffect, createMemo, Show } from "solid-js"
import { Dynamic } from "solid-js/web"

import { TESTID } from "../../testids.ts"
import { LINKS_ELSEWHERE } from "olai-plugin-navigation/elsewhere"
import { fileMark } from "../kinds.ts"
import { createDeclared, createHome } from "../references.ts"
import { servedDirectory } from "../vault.ts"
import { AgentMark } from "../chat/AgentMark.tsx"
import { useAgents } from "./answered.tsx"
import { nameOfItem, namesNode, titleOfNode } from "./called.ts"
import { AboutBox } from "./Door.tsx"
import { lostOf } from "./lost.ts"
import { LostNote } from "./Lost.tsx"
import { OpenBeside } from "./OpenBeside.tsx"
import { Opens } from "./Opens.tsx"
import { PageFoot, PageHead } from "./Page.tsx"
import { createRemembered } from "./remembering.ts"
import { LOOK, type Row, talking } from "./roster.ts"

const CHAT_TITLE = "m-0 font-sans text-title font-semibold tracking-tight md:text-display short:md:text-title"

const OPENS_LINKS_IN_THE_OTHER_PANE = { [LINKS_ELSEWHERE]: "" }

function Standing(props: { readonly row: Row }) {
  const look = () => LOOK[props.row.standing]
  return (
    <span
      class="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-caption text-muted"
      data-testid={TESTID.chatPageStanding}
      data-agent={props.row.id}
      data-standing={props.row.standing}
    >
      <AgentMark id={props.row.engine} />
      <span class={`${DOT} ${look().dot}`} aria-hidden="true" />
      <span class="sr-only"> — {look().detail}</span>
    </span>
  )
}

export function ChatPage(props: { readonly item: AgentItem }) {
  const agents = useAgents()
  const key = createMemo(() => itemKey(props.item))
  const row = () => agents.chatOf(props.item)
  const declared = createDeclared()
  createEffect(() => {
    const item = props.item
    if (item.kind === "node") declared.want([item.id])
  })
  const node = () => props.item.kind === "node" ? props.item.id : null
  namesNode(node, () => { const id = node(); return id === null ? null : declared.title(id) })
  const name = () => nameOfItem(props.item, servedDirectory()?.claims(), titleOfNode)
  const home = createHome(() => props.item.kind === "node" ? props.item.id : null)
  const where = () => props.item.kind === "note" ? props.item.path : row()?.file ?? home()
  const mark = () => props.item.kind === "note" ? fileMark(props.item.path) : undefined
  const open = () => talking(row())
  const was = createRemembered({
    key,
    tied: () => {
      const held = row()
      return held?.session != null ? { agent: held.engine, session: held.session } : null
    },
  })
  const lost = createMemo(() => lostOf({
    item: props.item,
    standing: servedDirectory()?.standing(),
    held: props.item.kind !== "note" || servedDirectory()?.members().has(props.item.path) === true,
    tied: row() !== undefined,
    was: was(),
  }))
  return (
    <main
      class={`mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pb-6 ${CLEARANCE}`}
      data-testid={TESTID.chatPage}
      data-item={key()}
      data-kind={props.item.kind}
      {...OPENS_LINKS_IN_THE_OTHER_PANE}
    >
      <div
        class={`sticky top-[var(--height-chrome)] ${LAYER.page} flex flex-wrap items-baseline gap-x-3 gap-y-1 bg-paper pb-1 pt-6 short:pt-2`}
        data-testid={TESTID.chatPageHead}
      >
        <Show when={mark()}>
          {(drawn) => <span class={`${MARK_BOX} self-center text-muted`} data-testid={TESTID.chatFileMark}><Dynamic component={drawn()} /></span>}
        </Show>
        <h1 class={`min-w-0 ${CHAT_TITLE}`} data-testid={TESTID.chatPageTitle}>{name()}</h1>
        <span class="flex-1" />
        <Show when={row()}>{(held) => <Standing row={held()} />}</Show>
        <Show when={lost()?.kind !== "gone"}><OpenBeside item={props.item} name={name()} /></Show>
      </div>
      <header>
        <Show when={where()}>
          {(at) => <p class="mb-2 mt-1 font-mono text-caption text-muted" data-testid={TESTID.chatPageWhere}>{at()}</p>}
        </Show>
        <Show when={open()}>
          <PageHead node={key()} own />
          <Show when={props.item.kind === "note" ? props.item.path : undefined}>
            {(path) => <Opens path={path()} name={name()} beside={row()?.beside === true} />}
          </Show>
        </Show>
      </header>
      <Show when={lost()} fallback={
        <Show when={open()} fallback={<AboutBox where="page" item={() => props.item} name={name} />}>
          <PageFoot node={key()} />
        </Show>
      }>{(what) => <LostNote lost={what()} name={name()} />}</Show>
    </main>
  )
}
