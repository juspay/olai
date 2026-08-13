/**
 * The input row: type, send, cancel.
 *
 * Three behaviours, and each of them is here because the panel is unusable
 * without it:
 *
 *   - **Enter sends, Shift+Enter is a newline.** A prompt is usually one line
 *     and occasionally several, and the common case should not need a button.
 *   - **Cancel appears BESIDE send while a turn is running**, rather than
 *     replacing it. Replacing it was right while a mid-turn send was refused:
 *     there was one action available and one place to look for it. Now that a
 *     message queues, sending and stopping are two things a person can
 *     genuinely want at the same moment, and hiding the send button would
 *     leave the queue reachable only from the keyboard.
 *   - **a question the agent asked is said HERE too**, not only where the form
 *     is. Nothing times out a blocked turn, so a form that has scrolled out of
 *     sight looks exactly like an agent that is thinking — and this row is
 *     where a person's attention already is, because it is where they were
 *     about to type.
 *   - **a file can be pasted, dropped, or picked.** Three events, one path:
 *     `attach` sends the bytes to the conversation's tmp directory and answers
 *     with a path, which rides the next `send`. All three ship together
 *     because they are the same function behind different listeners — paste is
 *     the desktop gesture, drop is the one for a file already on screen, and
 *     the picker is the only one a phone has, since a phone has no Ctrl+V.
 *     Attaching does NOT send: the file sits in a strip above the box, where
 *     it can be removed or typed at, because "what is wrong here" needs the
 *     file and the question together. Two of those three listen HERE; the drop
 *     is caught by the panel around this row ({@link ./DropTarget.tsx}),
 *     because a file dragged at a conversation is aimed at the conversation.
 *     What all three land in is one owner above both ({@link ./holding.ts}).
 *
 *     All three take the same kinds, and the picker's `accept` is spelled from
 *     the gate's own list to keep that true: a dialog that greys out a PDF the
 *     drop would have taken is the one half-truth a person meets without any
 *     refusal to explain it.
 *   - **a message can be ABOUT a node.** "Ask agent" on a row arms this box
 *     with that node ({@link ./armed.ts}), and it sits in a chip above the
 *     input until it is sent or taken off — the attachment strip's arrangement,
 *     because it is the attachment strip's claim: this went with the message.
 *     What is armed is an ID; what the chip reads is the title, out of the live
 *     set; what rides the send is the id again, and the SERVER says what the
 *     node is. So a row armed, renamed and then sent reaches the agent under
 *     the name it has now, and a row armed and then archived refuses the send
 *     rather than sending a question with no subject.
 *   - **`/` opens the agent's own commands**, and so does the button beside
 *     the input, which shows the WHOLE list. Typing filters; the button is for
 *     when you do not know what to type, which is most of the time you want a
 *     command list at all. It is drawn only when there are commands — a button
 *     that opens nothing is a button that lies. The list comes from the agent
 *     (the `commands` frame), so it is whatever that agent actually offers
 *     rather than a list olai maintains. Accepting one only writes `/name ` —
 *     sending is what invokes it, exactly as typing it would.
 *
 * The draft is local to this tab and is deliberately NOT a surface member: it
 * is an editor, not committed state, and two tabs typing at once should not
 * fight over one box.
 */

import { nodeNamed } from "@olai/format"
import { ATTACHMENT_EXTENSIONS } from "@olai/surface"
import { createEffect, createMemo, createSignal, on, Show } from "solid-js"

import { useDerived } from "../derived.tsx"
import { TESTID } from "../testids.ts"
import { armedNodes, disarmNode, releaseArmed, restoreArmed } from "./armed.ts"
import { Attachments } from "./Attachments.tsx"
import { type Chip, ContextChips } from "./ContextChips.tsx"
import type { Holding } from "./holding.ts"
import { SlashMenu } from "./SlashMenu.tsx"
import type { Chat } from "./state.ts"

/** Every control on the toolbar, the same height and the same corners. Written
 *  once because "these line up" is the property, and three copies of a class
 *  list line up only until somebody edits one. */
const CONTROL =
  "flex h-8 shrink-0 items-center justify-center rounded border text-xs"

export function Composer(props: {
  readonly chat: Chat
  /** The files attached and not yet sent. Made by the panel, because the
   *  panel is where a drop is caught and this row is where the chips go. */
  readonly holding: Holding
}) {
  const [draft, setDraft] = createSignal("")
  const [showing, setShowing] = createSignal(false)
  /** Opened by the BUTTON rather than by typing a slash — the difference is
   *  only which prefix the list is filtered by. */
  const [asked, setAsked] = createSignal(false)
  let input: HTMLTextAreaElement | undefined
  let picker: HTMLInputElement | undefined

  const working = () => props.chat.state().status === "thinking"

  const derived = useDerived()
  /** The armed nodes as chips: the id is what was armed and what will be sent,
   *  and the TITLE is read out of the live set here — through the format's own
   *  rule for what an id names, the one `see` links resolve with. So a row
   *  armed and then retitled by anybody says the new title, and nothing about
   *  the chip is a copy. An id the set does not declare reads as the id, which
   *  is what a dangling `see` does and for the same reason: the strip says what
   *  is armed rather than going blank about it. */
  const armed = createMemo<ReadonlyArray<Chip>>(() =>
    armedNodes().map((id) => {
      const indexes = derived()
      const named = indexes === undefined ? undefined : nodeNamed(indexes, id)
      return { id, title: named?.node.title ?? id }
    })
  )

  /** The word being completed: everything after a `/` that starts the draft.
   *  Only at the start — a slash mid-sentence is a slash. `null` is "this is
   *  not a command line", which is what closes the popover as you type past
   *  one. */
  const typed = () => {
    const text = draft()
    if (!text.startsWith("/")) return null
    const upto = text.indexOf(" ")
    return upto === -1 ? text.slice(1) : null
  }

  /** What the list is filtered by. The BUTTON asks with an empty prefix, which
   *  is the whole list; typing asks with what has been typed. */
  const prefix = () => (asked() ? typed() ?? "" : typed())

  const matches = () => {
    const wanted = prefix()
    if (wanted === null) return []
    return props.chat
      .state()
      .commands.filter((command) => command.name.startsWith(wanted))
  }

  const open = () => showing() && matches().length > 0

  // SOMETHING LANDED IN THE STRIP, so the caret comes here — a file let go of
  // anywhere on the panel, or a node armed from a row somewhere in the tree.
  // Both are the same gesture from this row's point of view: it never hears
  // about the drop or the menu, only about what they left behind, and the next
  // thing to do with either is ask about it. One effect over the whole strip,
  // because "the caret goes to the box" is one rule and two of them would be
  // two chances to focus twice on a drop that also armed something.
  createEffect(
    on(
      () => props.holding.pending().length + armedNodes().length,
      (now, before) => {
        if (before !== undefined && now > before) input?.focus()
      },
    ),
  )

  /**
   * Send, and PUT IT BACK if the server would not take it.
   *
   * The box is cleared immediately, because it has to be: a send that waited
   * for a round trip before emptying the box would send twice for two quick
   * presses of Enter. But the clear was also the end of the story, and a
   * refusal — a file whose conversation was left while it uploaded, most of
   * all — left the message and the chips gone and only a red line to say why.
   * Chips are worse than words that way: they stand for round trips somebody
   * already waited through.
   *
   * Only put back into a box that is still empty. If the answer comes back
   * while a person is already typing the next thing, what they are typing wins.
   */
  const send = async () => {
    const text = draft()
    if (
      text.trim() === "" &&
      props.holding.pending().length === 0 &&
      armedNodes().length === 0
    ) return
    const attachments = props.holding.release()
    // Released with the attachments and put back with them: an armed node is
    // part of the message in exactly the way a picture is, and a refusal that
    // restored one and not the other would leave a message that is not the one
    // that was refused.
    const context = releaseArmed()
    setDraft("")
    dismiss()
    // Where the caret already is, unless something took it — a person sending
    // two messages in a row should not have to aim at the box for the second.
    input?.focus()

    const taken = await props.chat.send(
      text,
      attachments.map((attachment) => attachment.path),
      context,
    )
    if (taken) return
    setDraft((typing) => (typing === "" ? text : typing))
    props.holding.restore(attachments)
    restoreArmed(context)
  }

  const accept = (name: string) => {
    setDraft(`/${name} `)
    dismiss()
    input?.focus()
  }

  const dismiss = () => {
    setShowing(false)
    setAsked(false)
  }

  /** The button: the whole list, or put it away if it is already up. */
  const askForAll = () => {
    if (open()) {
      dismiss()
      return
    }
    setAsked(true)
    setShowing(true)
    input?.focus()
  }

  const onKey = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      dismiss()
      return
    }
    // Enter sends. It does NOT need a "unless the menu is open" guard: the menu
    // takes the key in the capture phase and stops it propagating, so this
    // handler does not run while it is up (see ./SlashMenu.tsx). One mechanism
    // for one rule — a second one here would be a guard nobody could test.
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      void send()
    }
  }

  return (
    <div class="relative shrink-0 p-2">
      <Show when={open()}>
        <SlashMenu commands={matches()} onAccept={accept} onDismiss={dismiss} />
      </Show>

      {/* Above the box, where what is being typed is: what this message is
          ABOUT is part of it until it is sent, and removable until then. Over
          the attachments rather than under them because it is the subject of
          the sentence and they are what came with it. */}
      <ContextChips nodes={armed()} onRemove={disarmNode} />

      {/* Above the box, where what is being typed is: an attachment is part of
          the message until it is sent. */}
      <Attachments
        names={props.holding.pending().map((attachment) => attachment.name)}
        onRemove={props.holding.remove}
      />

      {/* The box takes the whole width and the controls sit UNDER it, rather
          than three things of three different shapes sharing a row. A textarea
          two lines tall beside a pair of one-line buttons has no alignment that
          is right: bottom-aligned they hang off its corner, centred they float
          in the middle of it. A row of its own gives them one edge to line up
          on, and gives the box the width it is actually for. */}
      {/* NEVER disabled. It was, on the reasoning that the server refuses a
          send mid-turn — but the refusal was the thing to fix, not the box.
          Turning it off cost the caret, so coming back meant reaching for the
          mouse, and it cost the thought: a person watching an agent work has
          the next message ready long before it is finished, and holding it in
          their head until a box comes back is work the panel invented. */}
      <textarea
        ref={input}
        class="w-full resize-none rounded-xl border border-rule/80 bg-paper px-3 py-2 text-sm outline-none focus:border-accent"
        data-testid={TESTID.chatInput}
        rows={2}
        placeholder={working() ? "…or say the next thing" : "ask the agent…"}
        value={draft()}
        onInput={(event) => {
          setDraft(event.currentTarget.value)
          // Typing takes the popover back off the button: what is on screen
          // should be what the line says, not what a click said a moment ago.
          setAsked(false)
          setShowing(event.currentTarget.value.startsWith("/"))
        }}
        onKeyDown={onKey}
        // The clipboard's FILES, not its items: a screenshot pastes as one,
        // and text pasted alongside goes on being pasted — nothing is
        // prevented unless there is a file to take.
        onPaste={(event) => {
          const files = [...(event.clipboardData?.files ?? [])]
          if (files.length === 0) return
          event.preventDefault()
          void props.holding.take(files)
        }}
      />

      <div class="mt-2 flex items-center gap-2">
        {/* The only way in on a phone, which has no Ctrl+V and nothing to drag
            from. `capture` is deliberately absent: a picture is usually one
            already in the roll, and naming a camera would make that the
            second-class case.

            `accept` is SPELLED FROM THE GATE rather than said again as
            `image/*`: a picker that will not offer a PDF the gate would take
            is a gate that is half true, and the half a person meets first —
            they never see the refusal, they see a file greyed out in a dialog
            with no explanation anywhere. */}
        <input
          ref={picker}
          type="file"
          accept={ATTACHMENT_EXTENSIONS.join(",")}
          multiple
          class="hidden"
          onChange={(event) => {
            void props.holding.take([...(event.currentTarget.files ?? [])])
            // Cleared so picking the SAME file twice fires `change` twice.
            event.currentTarget.value = ""
          }}
        />
        <button
          type="button"
          class={`${CONTROL} w-8 border-rule text-muted hover:text-ink`}
          data-testid={TESTID.chatAttachButton}
          aria-label="attach a file"
          onClick={() => picker?.click()}
        >
          +
        </button>
        {/* What is in flight. A picture big enough to notice is a picture
            whose upload is worth saying is happening. */}
        <Show when={props.holding.sending() > 0}>
          <span class="font-mono text-[0.6875rem] text-muted">
            attaching{props.holding.sending() > 1 ? ` ${props.holding.sending()}` : ""}…
          </span>
        </Show>
        {/* The turn is stopped on a PERSON, and this is where they find out.
            A blocked question has no clock behind it: nothing times out, the
            agent will wait as long as it takes, and a form scrolled off the top
            of a long transcript is otherwise indistinguishable from an agent
            that is thinking. So the composer — which is where somebody's
            attention is, because it is where they were about to type — says
            it, in the row that already carries "queued". */}
        <Show when={props.chat.state().asking > 0}>
          <span
            class="font-mono text-[0.6875rem] text-doing"
            data-testid={TESTID.chatWaiting}
            aria-live="polite"
          >
            waiting on your answer
          </span>
        </Show>
        {/* Sent, and waiting for the turn in flight. The rows are already in
            the transcript — this says the agent has not reached them. */}
        <Show when={props.chat.state().queued > 0}>
          <span
            class="font-mono text-[0.6875rem] text-muted"
            data-testid={TESTID.chatQueued}
          >
            {props.chat.state().queued} queued
          </span>
        </Show>
        {/* Only when the agent offers some: a button that opens nothing lies. */}
        <Show when={props.chat.state().commands.length > 0}>
          <button
            type="button"
            class={`${CONTROL} w-8 border-rule font-mono text-muted hover:text-ink`}
            data-testid={TESTID.chatCommands}
            aria-label="show the agent's slash commands"
            onClick={askForAll}
          >
            /
          </button>
        </Show>
        <span class="flex-1" />
        <Show when={working()}>
          <button
            type="button"
            class={`${CONTROL} border-alarm px-3 text-alarm`}
            data-testid={TESTID.chatCancel}
            onClick={() => props.chat.cancel()}
          >
            cancel
          </button>
        </Show>
        <button
          type="button"
          class={`${CONTROL} border-transparent bg-accent px-3 font-semibold text-paper hover:opacity-90`}
          data-testid={TESTID.chatSend}
          onClick={() => void send()}
        >
          {working() ? "queue" : "send"}
        </button>
      </div>
    </div>
  )
}
