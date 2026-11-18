/**
 * A CONVERSATION, AS A PAGE — `/chat/<item>`, the one place a chat is drawn
 * whole (`./route.ts` argues the address).
 *
 * ## What is on it, and in what order
 *
 * The ITEM first: its mark, its name as the page's own title, and under that
 * the path of the note or the outline the node is written in, in the small
 * mono a place is written in everywhere else. Then how the chat STANDS, at
 * the right of that line, read-only — the page IS the conversation, so there
 * is nothing here for a press to unfold.
 *
 * Then the agent line the node page draws (`./Page.tsx`'s `PageHead`), with
 * *Open <name> beside ›* on it; for a note, the switch saying where this chat
 * opens (`./Opens.tsx`); then the conversation itself, through the same
 * `PageFoot` a node's page uses, so this page and that one share one per-pane
 * session, one set of testids and one answer to what a transcript does when
 * the pane scrolls.
 *
 * NO BREADCRUMB. A chat is not inside anything — it belongs to one item, the
 * item is the title, and the trail above a note would be a trail to a file
 * this page is not showing. Where the item IS is the page's second line and
 * the button beside it.
 *
 * NO MEMORY AND NO SLEEP ON A NOTE, which is not a thing this page leaves
 * out: a note IS the memory of its chat, so there are no rows to fold and no
 * pass to tidy them (`../chat/sleeping.ts` is the one gate, read wherever
 * that conversation is drawn). A node's sleep line is on it exactly as it is
 * on the node's own page, because it is the same strip.
 *
 * ## An item with no chat yet
 *
 * The page is still the item's: the same head, and the door in place of the
 * conversation — *Ask about <name>…*, with the engine picker, which starts
 * the chat on THIS item and leaves the conversation where the box was
 * (`./Door.tsx`). So an address somebody was handed opens something whatever
 * the vault says, which is the whole reason the page is addressed by the item
 * rather than by a conversation.
 */

import { LAYER } from "@olai/web/client/layer.ts"
import { DOT } from "@olai/web/client/readout.ts"
import { MARK_BOX } from "@olai/ui-primitives/mark.ts"
import { CLEARANCE } from "olai-plugin-layout/clearance"
import { type AgentItem, itemKey } from "@olai/format"
import { createEffect, createMemo, createSignal, Show } from "solid-js"
import { Dynamic } from "solid-js/web"

import { TESTID } from "../../testids.ts"
import { LINKS_ELSEWHERE } from "olai-plugin-navigation/elsewhere"
import { fileMark } from "../kinds.ts"
import { createDeclared, createHome } from "../references.ts"
import { servedDirectory } from "../vault.ts"
import { AgentMark } from "../chat/AgentMark.tsx"
import { useAgents } from "./answered.tsx"
import { nameOfItem, titleOfNode } from "./called.ts"
import { AboutBox } from "./Door.tsx"
import { lostOf, type WasTied } from "./lost.ts"
import { LostNote } from "./Lost.tsx"
import { OpenBeside } from "./OpenBeside.tsx"
import { Opens } from "./Opens.tsx"
import { PageFoot, PageHead } from "./Page.tsx"
import { LOOK, type Row, talking } from "./roster.ts"

/**
 * THE CONVERSATION'S OWN NAME, at the size the screen has room for.
 *
 * `PAGE_TITLE`'s display size on a desktop, where the head is one band above
 * a wide column — and a SECTION heading on a phone, where the page is the
 * conversation and a display title would push the first thing the agent said
 * off the screen. The mockups drew it that way for that reason
 * (`.waterfall/mockup/7-chats-press-split-phone.png`): on a phone the
 * conversation leads and the name labels it.
 *
 * SPELLED WHOLE rather than appended to `PAGE_TITLE`, which is that
 * constant's own rule (`@olai/web/client/look.ts`): a page wanting a smaller
 * heading is a page wanting a different thing, not one hoping its override
 * was emitted later.
 */
const CHAT_TITLE = "m-0 font-sans text-title font-semibold tracking-tight md:text-display"

/**
 * A LINK PRESSED ON THIS PAGE OPENS IN THE OTHER PANE — the pane to the left
 * when there is one, else one opened to the right. Navigation's rule, asked
 * for by the one attribute it reads (`olai-plugin-navigation/elsewhere`,
 * which argues it).
 *
 * A conversation is the one page here a press may not replace: a half-typed
 * message and the place somebody is reading are not written down anywhere,
 * and an agent's answer is MADE of links to the things it is talking about.
 * The pane is the conversation's; what it points at is the pane next to it.
 */
const LINKS_ASIDE = { [LINKS_ELSEWHERE]: "" }

/** How the chat stands, said once at the right of the head — the same table
 *  every other face reads it off (`./roster.ts`'s `LOOK`), with no press on
 *  it. */
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
      {/* What the standing MEANS, for a reader who never hovers — the same
          sentence the pressable standing carries. */}
      <span class="sr-only"> — {look().detail}</span>
    </span>
  )
}

export function ChatPage(props: { readonly item: AgentItem }) {
  const agents = useAgents()
  const key = createMemo(() => itemKey(props.item))
  const row = () => agents.chatOf(props.item)
  // THE OUTLINE'S OWN NAMING, for the one case the roster cannot answer: a
  // node with no chat yet has no row, and this page is where its name is the
  // heading. Asked here because this is where there is an owner to ask with
  // (`../references.ts`); the route's label falls back to the id, exactly as
  // the node's own page does.
  const declared = createDeclared()
  createEffect(() => {
    const item = props.item
    if (item.kind === "node") declared.want([item.id])
  })
  const name = () =>
    nameOfItem(props.item, servedDirectory()?.claims(), (id) => titleOfNode(id) ?? declared.title(id))
  const home = createHome(() => props.item.kind === "node" ? props.item.id : null)
  const where = () => props.item.kind === "note" ? props.item.path : row()?.file ?? home()
  const mark = () => props.item.kind === "note" ? fileMark(props.item.path) : undefined
  /** A door is offered until there is a conversation, not until there is a
   *  tie: a start the agent refused leaves the item its own door. */
  const open = () => talking(row())
  /**
   * WHAT THIS PANE WAS READING, kept for as long as the page is drawn — the
   * one thing the roster cannot answer once a note has stopped naming its
   * chat. It is what the *tie it again* press hands back
   * (`./Lost.tsx`), so it is remembered where that press is drawn and
   * nowhere else: a page opened fresh on an untied note knows of no
   * conversation and offers none.
   */
  const [was, setWas] = createSignal<WasTied | null>(null)
  createEffect(() => {
    const held = row()
    if (held?.session != null) setWas({ agent: held.engine, session: held.session })
  })
  /** The directory's own two answers about this page's note (`./lost.ts`). */
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
      {...LINKS_ASIDE}
    >
      {/* PINNED, as the node page's head is and for its reason: the page is
          the scroll, so a head that scrolled away would take the name of the
          thing being talked about — and the way back to it — with it. On a
          PHONE too, where it is the only way back when the chat is the one
          pane: `--height-chrome` is the bar there, with the tab strip added
          while the lane has one, and zero inside a desktop column, which is
          its own scrollport (`olai-plugin-layout`'s `Panes.tsx`). */}
      <header class={`sticky top-[var(--height-chrome)] ${LAYER.page} bg-paper pt-6`} data-testid={TESTID.chatPageHead}>
        <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <Show when={mark()}>
            {(drawn) => <span class={`${MARK_BOX} self-center text-muted`} data-testid={TESTID.chatFileMark}><Dynamic component={drawn()} /></span>}
          </Show>
          <h1 class={`min-w-0 ${CHAT_TITLE}`} data-testid={TESTID.chatPageTitle}>{name()}</h1>
          <span class="flex-1" />
          <Show when={row()}>{(held) => <Standing row={held()} />}</Show>
          {/* WITH NO CONVERSATION there is no agent line to carry the verb,
              and the head is the only line this page has. Not for a note that
              is GONE: there is no page to put beside this one. */}
          <Show when={!open() && lost()?.kind !== "gone"}><OpenBeside item={props.item} name={name()} /></Show>
        </div>
        <Show when={where()}>
          {(at) => <p class="mb-2 mt-1 font-mono text-caption text-muted" data-testid={TESTID.chatPageWhere}>{at()}</p>}
        </Show>
        <Show when={open()}>
          <PageHead node={key()} beside={props.item} />
          <Show when={props.item.kind === "note" ? props.item.path : undefined}>
            {(path) => <Opens path={path()} name={name()} beside={row()?.beside === true} />}
          </Show>
        </Show>
      </header>
      {/* THE NOTE'S OWN TWO LOSSES COME FIRST, before the door: a page whose
          note is gone, or whose note has stopped naming the conversation
          being read, is not a page to start a chat on (`./lost.ts`). */}
      <Show when={lost()} fallback={
        <Show when={open()} fallback={<AboutBox where="page" item={() => props.item} name={name} />}>
          <PageFoot node={key()} />
        </Show>
      }>{(what) => <LostNote lost={what()} name={name()} />}</Show>
    </main>
  )
}
