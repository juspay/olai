/** One spawned agent’s calls, using the transcript’s row renderer.
 * Questions stay in the main transcript; the shelf links to their sole form.
 * Page shelves grow in the pane scroll. Fold shelves bound their own scroll.
 */

import { For, Show } from "solid-js"

import type { ChatEntry } from "olai-plugin-chat/wire"
import { TESTID } from "../../testids.ts"
import type { Lane } from "./lanes.ts"
import { useConversationUI } from "./ui.tsx"
import { railOf } from "./rail.ts"
import { Row } from "./Row.tsx"
import { sentOf, whoOf } from "./spawn.ts"
import type { Chat } from "./state.ts"

export function Preview(props: { readonly chat: Chat; readonly unbounded?: boolean }) {
  const { previewing } = useConversationUI().previewing
  /** WHICH agent, and whether it is one this conversation still has. A key that
   *  named a row of the last conversation — or of a turn that has been cleared
   *  — reads as nothing here rather than as an empty shelf, which is the same
   *  answer as "not open" and needs no second rule to say so. */
  const of = () => {
    const row = previewing()
    if (row === null) return null
    const entry = props.chat.entry(row)()
    return entry === undefined || whoOf(entry) === null ? null : { row, entry }
  }
  return (
    <Show when={of()}>{(open) => <Shelf chat={props.chat} open={open()} unbounded={props.unbounded} />}</Show>
  )
}

function Shelf(props: {
  readonly chat: Chat
  readonly unbounded?: boolean
  readonly open: { readonly row: string; readonly entry: ChatEntry }
}) {
  const { closePreview, previewing, togglePreview } = useConversationUI().previewing
  const calls = () => props.chat.lanes().get(props.open.row) ?? EMPTY
  /** The lane every row in here is in — MINTED ONCE for the whole shelf rather
   *  than asked of {@link ./lanes.ts} per row, and with no label at all.
   *
   *  That rule answers a question this list does not have. It decides whether
   *  the row ABOVE has already put the reader in this lane, which is what keeps
   *  two interleaved agents apart in one column — and there is one agent here,
   *  named at the top, so every answer it could give is either wrong (the first
   *  row would repeat the head) or the one already known. What the lane is still
   *  FOR is the rail, which is the same rail, from the same module, so a
   *  subagent's calls look the way they have always looked. */
  const lane = (): Lane => ({ parent: props.open.row, label: null })
  /** Whether the turn is blocked on a question — the SERVER's count off the
   *  rows (`ChatState.asking`), which is the same number the composer, the
   *  header and the badge are drawn from. Never this shelf's own reading of the
   *  transcript: a second answer to "is somebody being waited on" is a second
   *  thing free to disagree with the row a person has to press. */
  const asked = () => props.chat.state().asking > 0
  const parent = () => {
    const row = props.open.entry
    if (row.kind !== "tool" || row.parent === undefined) return null
    const name = sentOf(props.chat.entry(row.parent)())
    return name === null ? null : { row: row.parent, name }
  }
  return (
    <section
      class="flex min-h-0 flex-col border-b border-rule/70 bg-panel"
      classList={{ "max-h-96 shrink": !props.unbounded }}
      data-testid={TESTID.chatPreview}
      data-row={props.open.row}
      aria-label="what one agent is doing"
    >
      {/* ABOVE EVERYTHING THIS BOX HAS TO SAY, because it is the one thing in
          it that is not about the agent: the turn is stopped, and it is stopped
          on the reader. It is drawn in the panel's alarm tone rather than its
          quiet one — the rest of this shelf is *something is happening*, and
          this is *nothing will happen until you look*. */}
      <Show when={asked()}>
        <button
          type="button"
          class="flex w-full shrink-0 items-center gap-1.5 border-b border-rule/70 bg-alarm/10 px-3 py-1.5 text-left font-mono text-[0.6875rem] leading-snug text-alarm hover:bg-alarm/20 focus-visible:outline focus-visible:outline-1 focus-visible:-outline-offset-2 focus-visible:outline-accent"
          data-testid={TESTID.chatPreviewAsked}
          onClick={() => {
            // BOTH, and in this order: the shelf is what is in the way, and the
            // ask is what the banner's own press raises — so the form is
            // scrolled into the middle of a pane that has already got its room
            // back. Pressing through to the same ask rather than scrolling from
            // here is what keeps one answer to "show me what is waiting".
            closePreview()
            props.chat.ui.reveal[1](true)
          }}
        >
          <span aria-hidden="true">◆</span>
          <span class="min-w-0 flex-1 truncate">a question is waiting on you</span>
          <span class="shrink-0 opacity-70">show me</span>
        </button>
      </Show>
      {/* Navigation between agents keeps one shelf open. These buttons only
          choose whose work to view; they never stop or dismiss an agent. */}
      <Show when={parent()}>{(above) => (
        <button type="button" class="px-3 pt-1 text-left text-xs text-muted hover:text-ink"
          aria-label={`Back to ${above().name}`} onClick={() => togglePreview(above().row)}>
          ← {above().name}
        </button>
      )}</Show>
      <p
        class="flex min-w-0 shrink-0 items-baseline gap-1 px-3 py-1.5 font-mono text-[0.6875rem] leading-snug text-ink"
        data-testid={TESTID.chatPreviewOf}
        data-spawn-kind={whoOf(props.open.entry) ?? undefined}
      >
        {/* The lane's own glyph, so that the head of the shelf and the label
            a lane draws in the column are visibly the same fact: somebody
            else is doing this. */}
        <span aria-hidden="true">↳</span>
        <span class="sr-only">the work of&#32;</span>
        {/* WHAT IT WAS SENT TO DO ({@link ./spawn.ts}'s `sentOf`), which is
            not the row's title: the title is the tool's name, so four agents
            of one fan-out would give four shelves with one heading. */}
        <span class="min-w-0 truncate">{sentOf(props.open.entry)}</span>
      </p>
      <div class="min-h-0 px-3 pb-2 text-ink"
        classList={{ "olai-scroll flex-1 overflow-x-hidden overflow-y-auto": !props.unbounded }}>
        <Show
          when={calls().length > 0}
          fallback={
            // AN AGENT THAT HAS NOT CALLED ANYTHING YET is the whole of the
            // stretch a fan-out is watched through — its first act is to read
            // its instructions, which produces nothing to draw. An empty box
            // would read as a shelf that had failed to load; this is the true
            // sentence, and the row's own rail in the transcript is already
            // saying the other half.
            <p class="py-1 font-mono text-[0.6875rem] text-muted" data-testid={TESTID.chatPreviewNothing}>
              nothing yet
            </p>
          }
        >
          <For each={calls()}>
            {(key) => {
              const entry = props.chat.entry(key)
              return (
                <Show when={entry()}>
                  {(row) => (
                    <Row
                      entry={row()}
                      chat={props.chat}
                      lane={lane()}
                      rail={railOf(entry())}
                      // AND NO FACE EITHER, for the reason the lane above it
                      // carries no label: every row in this shelf is the one
                      // agent's, and that agent is named once in the shelf's
                      // own head. A face per run in here would repeat it down
                      // the shelf's whole length — which is the same repetition
                      // the lane already declines, one drawing over.
                      speaker={null}
                    />
                  )}
                </Show>
              )
            }}
          </For>
        </Show>
      </div>
    </section>
  )
}

/** No calls, minted once, so the `<Show>` above settles rather than seeing a
 *  fresh empty array every frame of the turn running underneath it. */
const EMPTY: ReadonlyArray<string> = []
