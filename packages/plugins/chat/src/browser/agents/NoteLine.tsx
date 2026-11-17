/**
 * THE LINE AT THE TOP OF A NOTE — what chat draws in the place markdown keeps
 * for it (`olai-plugin-markdown/contract`'s `noteLine`), one row under the
 * path and over the properties.
 *
 * ONLY A NOTE HAS ONE, which is the location's own rule: markdown's document
 * page is the only page that places it, and this component asks the claim
 * table whether that file is a note at all (`@olai/format`'s `isNotePath`).
 * An outline, a `.csv`, a picture, a day, the Trash and a plugin's page have
 * no line, because none of them can have a chat.
 *
 * ## It reads the roster and nothing else
 *
 * OPENING A NOTE WAKES NOTHING. The line is drawn out of the chat ROSTER —
 * the engine's mark, how the chat stands, the words *Chat about this page* —
 * and takes no conversation lease, reads no transcript and starts no agent.
 * That was the seat's rule when the seat was a fold under the page, and it is
 * sharper here: the conversation is not drawn on this page at all. It is a
 * PANE, and the line is the way to it.
 *
 * ## The two faces
 *
 *   - WITH A CHAT: the standing, *Chat about this page*, a rule, and *Open
 *     beside ›* at the right (`./ChatBeside.tsx`, which reads *Shown beside*
 *     and focuses the pane once one has the conversation). The line itself is
 *     a button doing exactly what that one does — the whole row is the target,
 *     and the button at its end is the words that say so.
 *   - WITH NO CHAT and an engine this machine can start: the mark, a one-line
 *     box *Ask about <name>…* where Enter sends, and the same *Open beside ›*,
 *     which opens the note's chat page (with its own box) beside. Sending
 *     starts the chat on this note and opens it beside — once, because it
 *     happens on the press and never on a later visit to the page.
 *   - WITH NO ENGINE and no chat: nothing. A door that cannot work is not
 *     offered, and the page is whole.
 *
 * A refusal keeps the words where they were typed, with the sentence under
 * them (`./Door.tsx`'s `sendAbout` is the one press every door shares).
 */
import { batch, createMemo, createSignal, For, Show } from "solid-js"
import { isNotePath, itemKey } from "@olai/format"
import { composing } from "@olai/web/client/composition.ts"
import { useHere, useRouter } from "olai-plugin-navigation/routing"

import { TESTID } from "../../testids.ts"
import { servedDirectory } from "../vault.ts"
import { AgentMark } from "../chat/AgentMark.tsx"
import { useAgents } from "./answered.tsx"
import { ChatBeside, useChatBeside } from "./ChatBeside.tsx"
import { sendAbout } from "./Door.tsx"
import { agentReadings } from "./reading.ts"
import { chatRouteOf } from "./route.ts"
import type { Row } from "./roster.ts"
import { StandingWords } from "./Standing.tsx"

/** The row itself, and the hairline that fills what the words leave. */
const ROW = "flex items-center gap-2 text-label text-muted"
const RULE = "h-px flex-1 bg-rule"

export function NoteLine(props: { readonly path: string; readonly name: string }) {
  const agents = useAgents()
  /** A note is what the DIRECTORY calls one, never a suffix this package
   *  spells — the same question every other face asks (`./here.ts`). */
  const note = createMemo(() => {
    const claims = servedDirectory()?.claims()
    return claims !== undefined && isNotePath(claims, props.path) ? props.path : null
  })
  const chat = createMemo(() => note() === null ? undefined : agents.chatOf({ kind: "note", path: props.path }))
  return (
    <Show when={note()}>{(path) =>
      <Show when={chat() !== undefined || agents.engines().length > 0}>
        <section class="mt-2 mb-3 border-y border-rule py-1.5" data-testid={TESTID.chatLine}
          data-note={path()} data-chat={chat()?.id}>
          <Show when={chat()} fallback={<Ask path={path()} name={props.name} />}>
            {(row) => <Here row={row()} path={path()} />}
          </Show>
        </section>
      </Show>
    }</Show>
  )
}

/** THE LINE WITH A CHAT ON IT. The row is one button and the verb at its end
 *  is another: both open the conversation in the pane to the right, or focus
 *  the pane that already has it. */
function Here(props: { readonly row: Row; readonly path: string }) {
  const { beside, press } = useChatBeside(() => ({ kind: "note", path: props.path }))
  return (
    <div class={ROW}>
      <button type="button" class="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-control bg-transparent p-0 text-left text-label text-muted hover:text-ink"
        data-testid={TESTID.chatLineOpen} data-beside={String(beside() !== null)} onClick={press}>
        <span class="inline-flex items-center gap-1 whitespace-nowrap text-caption text-muted"
          data-testid={TESTID.chatLineStanding} data-agent={props.row.id} data-standing={props.row.standing}>
          <StandingWords row={props.row} />
        </span>
        <span class="min-w-0 truncate">Chat about this page</span>
        <span class={RULE} aria-hidden="true" />
      </button>
      <ChatBeside item={{ kind: "note", path: props.path }} />
    </div>
  )
}

/** THE LINE WITH NO CHAT: the box that starts one, one row high.
 *
 *  The words are the ACTIVATION's, under this note's own door key, so a
 *  refused start — or leaving the page and coming back — finds them where
 *  they were typed (`./reading.ts`'s `Unsent`). */
function Ask(props: { readonly path: string; readonly name: string }) {
  const agents = useAgents()
  const router = useRouter()
  const here = useHere()
  const owner = () => ({ kind: "door", where: "line", item: itemKey({ kind: "note", path: props.path }) }) as const
  const draft = () => agentReadings()?.unsent(owner()) ?? ""
  const [chosen, choose] = createSignal<string>()
  const [starting, setStarting] = createSignal(false)
  const [failure, setFailure] = createSignal<string | null>(null)
  const engine = () => chosen() ?? agents.engines()[0]?.id
  const send = async () => {
    const text = draft()
    const id = engine()
    const sentFrom = owner()
    if (starting() || id === undefined || text.trim() === "") return
    batch(() => { setStarting(true); setFailure(null) })
    try {
      const sent = await sendAbout({ item: { kind: "note", path: props.path }, engine: id, text })
      if (sent.started === null) { setFailure(sent.said); return }
      agentReadings()?.setUnsent(sentFrom, "")
      // ...AND THE CONVERSATION OPENS BESIDE THE NOTE, once: on the press that
      // started it, never on a later visit — a page that opened a pane because
      // a chat exists would reopen it every time the note was read.
      router.openRight(here(), chatRouteOf({ kind: "note", path: props.path }))
    } finally { setStarting(false) }
  }
  return <div data-testid={TESTID.chatAbout} data-where="line">
    <div class={ROW}>
      <span class="inline-flex items-center gap-1 text-caption text-muted"><AgentMark id={engine() ?? ""} /></span>
      {/* `composing` (`@olai/web/client/composition.ts`) because this box is
          drawn by the chat row inside markdown's page, so the window-wide
          guard that keeps an IME's key out of every handler is not promised
          to it. */}
      <input type="text" class="min-w-0 flex-1 bg-transparent text-label outline-none placeholder:text-muted"
        data-testid={TESTID.agentPlainInput} disabled={starting()}
        aria-label={`Ask about ${props.name}`} placeholder={`Ask about ${props.name}…`}
        value={draft()} onInput={event => agentReadings()?.setUnsent(owner(), event.currentTarget.value)}
        onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); if (composing(event)) return; void send() } }} />
      {/* ONE ENGINE ASKS NOTHING: the picker is drawn exactly where there is a
          choice to make, which is the rule a row's own start keeps
          (`./Standing.tsx`). */}
      <Show when={agents.engines().length > 1}>
        <select aria-label="Agent" class="bg-transparent text-caption text-muted" data-testid={TESTID.agentPlainEngine}
          value={engine()} disabled={starting()} onChange={event => choose(event.currentTarget.value)}>
          <For each={agents.engines()}>{one => <option value={one.id}>{one.name}</option>}</For>
        </select>
      </Show>
      <span class={RULE} aria-hidden="true" />
      <ChatBeside item={{ kind: "note", path: props.path }} />
    </div>
    <Show when={failure()}>
      {message => <p role="alert" class="m-0 pt-1 text-caption text-alarm" data-testid={TESTID.agentPlainRefused}>{message()}</p>}
    </Show>
  </div>
}
