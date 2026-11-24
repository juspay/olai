/**
 * A CONVERSATION, AS A PAGE — `/chat/<item>`, the one place a chat is drawn
 * whole (`./route.ts` argues the address).
 *
 * ## What is on it, and in what order
 *
 * The ITEM first, on one line: its mark, its name as the page's own title,
 * on a desktop the path of the note or the outline the node is written in
 * (in the small mono a place is written in everywhere else), how the chat
 * STANDS at the right of it (read-only — the page IS the conversation, so
 * there is nothing here for a press to unfold), and the door back to the
 * item, *Open <name> beside ›* (`./OpenBeside.tsx`). That line is the one
 * thing pinned at the top, at every size.
 *
 * UNDER IT, for a note, the switch saying where this chat opens
 * (`./Opens.tsx`). Then the conversation itself, through the same `PageFoot`
 * a node's page uses, so this page and that one share one per-pane session,
 * one set of testids and one answer to what a transcript does when the pane
 * scrolls.
 *
 * THE AGENT LINE IS THE CONVERSATION'S STATUS BAR, on a desktop: pinned on
 * the composer at the bottom, with the tool row, what is still running, the
 * sleep line and the plan as chips on it (`./AgentLine.tsx`'s `foot`). The
 * whole head pinned at the top took a third of a desktop screen from a long
 * conversation; the bar is one line, in the place the *Working…* strip
 * already was, beside the box a person is looking at. ON A PHONE (`roomy`
 * below) the agent line and its strips stay under the item's line as the node
 * page draws them (`./Page.tsx`'s `PageHead`) and scroll away with the chat:
 * a phone's foot is the box and its keyboard, with no room for a bar.
 *
 * NO BREADCRUMB. A chat is not inside anything — it belongs to one item, the
 * item is the title, and the trail above a note would be a trail to a file
 * this page is not showing. Where the item IS, is the path and the button on
 * the item's line.
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
import { CLEARANCE, PAGE_INSET_TOP } from "olai-plugin-layout/clearance"
import { type AgentItem, itemKey } from "@olai/format"
import { type Accessor, createEffect, createMemo, createSignal, onCleanup, Show } from "solid-js"
import { Dynamic } from "solid-js/web"

import { TESTID } from "../../testids.ts"
import { LINKS_ELSEWHERE } from "olai-plugin-navigation/elsewhere"
import { fileMark } from "../kinds.ts"
import { createDeclared, createHome } from "../references.ts"
import { servedDirectory } from "../vault.ts"
import { desktop } from "../shell.ts"
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

/**
 * THE CONVERSATION'S OWN NAME, as a section heading at every size.
 *
 * It was `PAGE_TITLE`'s display size on a desktop, and that was one band of
 * 72 pixels pinned over the conversation for a name the pane's own header
 * already says. The page leads with the conversation and the name labels it,
 * which is what a phone always did.
 *
 * SPELLED WHOLE rather than appended to `PAGE_TITLE`, which is that
 * constant's own rule (`@olai/web/client/look.ts`): a page wanting a smaller
 * heading is a page wanting a different thing, not one hoping its override
 * was emitted later.
 */
const CHAT_TITLE = "m-0 font-sans text-title font-semibold tracking-tight"

/**
 * A SCREEN WITH NO HEIGHT TO SPARE — the `short` variant of `../all.css`,
 * which argues the number, asked of the window here because what it decides
 * is what is DRAWN, not how it looks.
 */
const SHORT_MQ = "(max-height: 540px)"

/**
 * WHETHER THIS SCREEN WEARS THE STATUS BAR: a desktop, and not a phone on its
 * side — 844×390 is past `md`, and a bar pinned on its composer would take a
 * twelfth of that screen from the conversation. Everywhere else the agent line
 * stays in the head and scrolls away, as it does on a phone.
 */
function createRoomy(): Accessor<boolean> {
  const query = window.matchMedia(SHORT_MQ)
  const [short, setShort] = createSignal(query.matches)
  const apply = () => setShort(query.matches)
  query.addEventListener("change", apply)
  onCleanup(() => query.removeEventListener("change", apply))
  return () => desktop() && !short()
}

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
  // (`../references.ts`) — and LENT BACK to `./called.ts` while the page is
  // drawn, so the pane's header, the phone's tab and the rail say the same
  // word this heading does instead of falling back to the id.
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
  /** A door is offered until there is a conversation, not until there is a
   *  tie: a start the agent refused leaves the item its own door. */
  const open = () => talking(row())
  /**
   * WHAT THIS PANE IS READING, REMEMBERED from the frame this page opens on
   * and forgotten by a close this reader made — the rule, with the item and
   * the roster's answer about it handed in (`./remembering.ts`). It is what
   * the *tie it again* press hands back (`./Lost.tsx`), so it is kept where
   * that press is drawn and nowhere else.
   */
  const was = createRemembered({
    key,
    tied: () => {
      const held = row()
      return held?.session != null ? { agent: held.engine, session: held.session } : null
    },
  })
  /** The directory's own two answers about this page's note (`./lost.ts`). */
  const lost = createMemo(() => lostOf({
    item: props.item,
    standing: servedDirectory()?.standing(),
    held: props.item.kind !== "note" || servedDirectory()?.members().has(props.item.path) === true,
    tied: row() !== undefined,
    was: was(),
  }))
  const roomy = createRoomy()
  /** Where the item is, written once: on the item's line where the screen has
   *  room for it, on a line of its own under it on a phone. */
  const At = (at: { readonly path: string; readonly class: string }) =>
    <p class={`font-mono text-caption text-muted ${at.class}`} data-testid={TESTID.chatPageWhere}>{at.path}</p>
  return (
    <main
      class={`mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 ${PAGE_INSET_TOP} pb-6 ${CLEARANCE}`}
      data-testid={TESTID.chatPage}
      data-item={key()}
      data-kind={props.item.kind}
      {...LINKS_ASIDE}
    >
      {/* THE ITEM'S LINE IS PINNED, AND NOTHING ELSE AT THE TOP IS — at every
          size, as the way back to the item. The page is the scroll, and the
          conversation's controls are pinned at its other end, on the composer
          (`PageFoot`'s `bar`), so a head that scrolls away takes nothing
          somebody reading the newest line needs. `--height-chrome` is the bar,
          with the desktop strip added while there is one, and zero inside a
          desktop column, which is its own scrollport (`olai-plugin-layout`'s
          `Panes.tsx`).

          THE DOOR IS ON THE ITEM'S LINE WHETHER OR NOT THERE IS A
          CONVERSATION. Not for a note that is GONE: there is no page to put
          beside this one. */}
      <div
        class={`sticky top-[var(--height-chrome)] ${LAYER.page} flex flex-wrap items-baseline gap-x-3 gap-y-1 bg-paper pb-1.5 pt-3`}
        data-testid={TESTID.chatPageHead}
      >
        <Show when={mark()}>
          {(drawn) => <span class={`${MARK_BOX} self-center text-muted`} data-testid={TESTID.chatFileMark}><Dynamic component={drawn()} /></span>}
        </Show>
        <h1 class={`min-w-0 ${CHAT_TITLE}`} data-testid={TESTID.chatPageTitle}>{name()}</h1>
        <Show when={roomy() && where()}>{(at) => <At path={at()} class="min-w-0 truncate" />}</Show>
        <span class="flex-1" />
        <Show when={row()}>{(held) => <Standing row={held()} />}</Show>
        <Show when={lost()?.kind !== "gone"}><OpenBeside item={props.item} name={name()} /></Show>
      </div>
      <header>
        <Show when={!roomy() && where()}>{(at) => <At path={at()} class="mb-2 mt-1" />}</Show>
        <Show when={open()}>
          <PageHead node={key()} own bar={roomy()} />
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
          <PageFoot node={key()} bar={roomy()} />
        </Show>
      }>{(what) => <LostNote lost={what()} name={name()} />}</Show>
    </main>
  )
}
