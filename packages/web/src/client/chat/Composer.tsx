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
 *   - **a picture can be pasted, dropped, or picked.** Three events, one
 *     path: `attach` sends the bytes to the conversation's tmp directory and
 *     answers with a path, which rides the next `send`. All three ship
 *     together because they are the same function behind different listeners —
 *     paste is the desktop gesture, drop is the one for a file already on
 *     screen, and the picker is the only one a phone has, since a phone has no
 *     Ctrl+V. Attaching does NOT send: the picture sits in a strip above the
 *     box, where it can be removed or typed at, because "what is wrong here"
 *     needs the picture and the question together.
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

import { createSignal, Show } from "solid-js"

import { TESTID } from "../testids.ts"
import type { Attachment } from "./attach.ts"
import { Attachments } from "./Attachments.tsx"
import { SlashMenu } from "./SlashMenu.tsx"
import type { Chat } from "./state.ts"

/** Every control on the toolbar, the same height and the same corners. Written
 *  once because "these line up" is the property, and three copies of a class
 *  list line up only until somebody edits one. */
const CONTROL =
  "flex h-8 shrink-0 items-center justify-center rounded border text-xs"

export function Composer(props: { readonly chat: Chat }) {
  const [draft, setDraft] = createSignal("")
  const [showing, setShowing] = createSignal(false)
  /** Opened by the BUTTON rather than by typing a slash — the difference is
   *  only which prefix the list is filtered by. */
  const [asked, setAsked] = createSignal(false)
  /** Pictures already on the server and waiting for a message to go with.
   *  Local to this tab, exactly like the draft: an attachment nobody has sent
   *  is part of what is being typed. */
  const [pending, setPending] = createSignal<ReadonlyArray<Attachment>>([])
  /** How many are in flight, so the box can say so. A count rather than a
   *  flag: two pictures dropped at once are two uploads. */
  const [sending, setSending] = createSignal(0)
  let input: HTMLTextAreaElement | undefined
  let picker: HTMLInputElement | undefined

  const working = () => props.chat.state().status === "thinking"

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

  /** Attach whatever was just pasted, dropped or picked.
   *
   *  Every file, not the first one: a drop of three screenshots is three
   *  attachments, and taking one of them silently would be the panel deciding
   *  which. And every file is OFFERED, rather than filtered here by what this
   *  component thinks a picture is: whether olai takes it is one rule in one
   *  place (`@olai/surface`'s gate, which `attach` runs before it encodes
   *  anything), and a second rule up here would be a dropped PDF vanishing
   *  with nothing said about it. */
  const take = async (files: ReadonlyArray<File>) => {
    if (files.length === 0) return
    setSending((count) => count + files.length)
    for (const file of files) {
      const attached = await props.chat.attach(file)
      setSending((count) => count - 1)
      if (attached === null) continue
      setPending((already) => [...already, attached])
    }
    input?.focus()
  }

  const send = () => {
    const text = draft()
    const attachments = pending()
    if (text.trim() === "" && attachments.length === 0) return
    props.chat.send(text, attachments.map((attachment) => attachment.path))
    setDraft("")
    setPending([])
    dismiss()
    // Where the caret already is, unless something took it — a person sending
    // two messages in a row should not have to aim at the box for the second.
    input?.focus()
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
      send()
    }
  }

  return (
    <div
      class="relative shrink-0 border-t border-rule p-2"
      // The whole composer is the drop target, not just the box: a picture
      // dragged at a panel is aimed at the conversation, and a target you can
      // miss by two pixels is a target that eats the file. `dragover` must
      // preventDefault or the browser navigates to the dropped file instead.
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        if (event.dataTransfer === null) return
        event.preventDefault()
        void take([...event.dataTransfer.files])
      }}
    >
      <Show when={open()}>
        <SlashMenu commands={matches()} onAccept={accept} onDismiss={dismiss} />
      </Show>

      {/* Above the box, where what is being typed is: an attachment is part of
          the message until it is sent. */}
      <Attachments
        names={pending().map((attachment) => attachment.name)}
        onRemove={(name) =>
          setPending((already) =>
            already.filter((attachment) => attachment.name !== name)
          )}
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
        class="w-full resize-none rounded border border-rule bg-paper px-2 py-1.5 text-sm outline-none focus:border-accent"
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
          void take(files)
        }}
      />

      <div class="mt-2 flex items-center gap-2">
        {/* The only way in on a phone, which has no Ctrl+V and nothing to drag
            from. `capture` is deliberately absent: a picture is usually one
            already in the roll, and naming a camera would make that the
            second-class case. */}
        <input
          ref={picker}
          type="file"
          accept="image/*"
          multiple
          class="hidden"
          onChange={(event) => {
            void take([...(event.currentTarget.files ?? [])])
            // Cleared so picking the SAME file twice fires `change` twice.
            event.currentTarget.value = ""
          }}
        />
        <button
          type="button"
          class={`${CONTROL} w-8 border-rule text-muted hover:text-ink`}
          data-testid={TESTID.chatAttachButton}
          aria-label="attach a picture"
          onClick={() => picker?.click()}
        >
          +
        </button>
        {/* What is in flight. A picture big enough to notice is a picture
            whose upload is worth saying is happening. */}
        <Show when={sending() > 0}>
          <span class="font-mono text-[0.6875rem] text-muted">
            attaching{sending() > 1 ? ` ${sending()}` : ""}…
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
          class={`${CONTROL} border-rule px-3 hover:border-accent hover:text-accent`}
          data-testid={TESTID.chatSend}
          onClick={send}
        >
          {working() ? "queue" : "send"}
        </button>
      </div>
    </div>
  )
}
