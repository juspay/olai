import { onCleanup } from "solid-js"
import { insertAt, type Insertion } from "./insertion.ts"

import { ATTACHMENT_ACCEPT } from "@olai/surface"
import { agentIn } from "olai-plugin-chat/wire"
import { batch, createEffect, createMemo, createSignal, on, Show } from "solid-js"

import type { Written } from "@olai/markdown-ui/insert.ts"
import { camera } from "./camera.ts"
import { createChipTitles } from "./chips.ts"
import { composing } from "@olai/web/client/composition.ts"
import { SaidLine } from "@olai/web/client/SaidLine.tsx"
import { Tip } from "@olai/web/client/Tip.tsx"
import { sameIds } from "@olai/web/client/ids.ts"
import { createSearch } from "../search.ts"
import { atOnce } from "@olai/web/client/settled.ts"
import { useServed } from "../vault.ts"
import { TESTID } from "../../testids.ts"
import { useConversationUI } from "./ui.tsx"
import { Attachments } from "./Attachments.tsx"
import {
  type Completing,
  completed,
  completingIn,
  namedIn,
  tokenOf,
  unnamed,
} from "./completion.ts"
import { CompletionMenu, type MenuRow } from "./CompletionMenu.tsx"
import { type Chip, ContextChips } from "./ContextChips.tsx"
import type { Holding } from "./holding.ts"
import { offers } from "./naming.ts"
import { createMessageDraft } from "./message-draft.ts"
import type { Chat } from "./state.ts"

const CONTROL =
  "flex h-8 shrink-0 items-center justify-center rounded-control border text-label"

const LOGIN = "login"

export function Composer(props: {
  readonly chat: Chat
  readonly onInsert?: (insert: (text: Insertion) => void) => () => void
  readonly holding: Holding
}) {
  const { armedNodes, disarmNode, releaseArmed, restoreArmed } = useConversationUI().armed
  const { draft, setDraft, taken, setTaken, caret, setCaret, dismissed, setDismissed, recover, retry, setRetry } = createMessageDraft(() => {
    const state = props.chat.state()
    const agent = agentIn(state)
    return agent === null || state.session === null
      ? null
      : JSON.stringify([agent.id, state.session.id])
  }, props.chat.ui.messages)
  const [asked, setAsked] = createSignal(false)
  let input: HTMLTextAreaElement | undefined
  let picker: HTMLInputElement | undefined
  let shutter: HTMLInputElement | undefined
  let camcorder: HTMLInputElement | undefined

  const picked = (files: FileList | null): void => {
    const chosen = [...(files ?? [])]
    if (chosen.length === 0) return
    void props.holding.take(chosen)
  }

  const readCaret = (): void => {
    setCaret(input?.selectionStart ?? 0)
  }

  const working = () => props.chat.state().status === "thinking"

  const interruptible = () => working() && agentIn(props.chat.state())?.steers === true

  const promised = () => working() && agentIn(props.chat.state())?.queues === true

  const signInOffered = () => (agentIn(props.chat.state())?.methods.length ?? 0) > 0

  createEffect(() => {
    if (draft() !== "") return
    const words = props.chat.takeBack()
    if (words !== null) setDraft(words)
  })


  const subjects = createMemo<ReadonlyArray<string>, undefined>(
    () => [...new Set([...armedNodes(), ...namedIn(draft(), taken())])],
    undefined,
    { equals: sameIds },
  )

  const titles = createChipTitles(subjects)
  const armed = createMemo<ReadonlyArray<Chip>>(() =>
    subjects().map((id) => ({ id, title: titles().get(id) ?? id }))
  )

  const trigger = createMemo<Completing | null>(() => completingIn(draft(), caret()))

  const found = createMemo<Completing | null>(() => {
    const now = trigger()
    if (asked()) {
      return now?.kind === "command" ? now : { kind: "command", from: 0, query: "" }
    }
    return now === null || tokenOf(now) === dismissed() ? null : now
  })

  createEffect(() => {
    if (trigger() === null) setDismissed(null)
  })

  const files = useServed()

  const naming = createMemo(() => {
    const completing = found()
    return completing !== null && completing.kind === "name" ? completing.query : null
  })

  const nodesNamed = createSearch(naming, "node")

  const rows = createMemo<ReadonlyArray<MenuRow>>(() => {
    const completing = found()
    if (completing === null) return []
    switch (completing.kind) {
      case "command": {
        const commands = props.chat
          .state()
          .commands.filter((command) => command.name.startsWith(completing.query))
          .map((command) => ({
            value: command.name,
            label: `/${command.name}`,
            hint: command.description ?? undefined,
            taking: atOnce,
            take: () => accept(command.name),
          }))
        if (signInOffered() && "login".startsWith(completing.query)) {
          commands.unshift({
            value: LOGIN,
            label: `/${LOGIN}`,
            hint: `Sign in to ${agentIn(props.chat.state())?.name ?? "this agent"}`,
            taking: atOnce,
            take: () => accept(LOGIN),
          })
        }
        return commands
      }
      case "name":
        return offers(files(), nodesNamed.hits(), completing.query).map((offer) => ({
          value: offer.value,
          label: offer.label,
          from: offer.from,
          hint: offer.hint,
          place: offer.place,
          section: offer.section,
          taking: offer.kind === "node" ? nodesNamed.taking : atOnce,
          take: () => {
            if (offer.kind === "node") {
              setTaken((already) => new Set(already).add(offer.value))
            }
            setDismissed(tokenOf(completing))
            rewrite(completed(draft(), completing, offer.value, caret()))
          },
        }))
    }
  })

  const open = () => rows().length > 0

  createEffect(
    on(
      () => props.holding.pending().length + armedNodes().length,
      (now, before) => {
        if (before !== undefined && now > before) input?.focus()
      },
    ),
  )

  const spend = () => {
    setDraft("")
    setCaret(0)
    setAsked(false)
    setDismissed(null)
    input?.focus()
  }

  const send = async (interrupt = false) => {
    const uploadScope = props.chat.state().uploadScope
    const text = draft()
    if (text.trim() === `/${LOGIN}` && signInOffered()) {
      spend()
      props.chat.signIn(null)
      return
    }
    if (
      text.trim() === "" &&
      props.holding.pending().length === 0 &&
      subjects().length === 0
    ) return
    const attachments = props.holding.release()
    const context = subjects()
    const held = releaseArmed()
    const recoverDraft = recover()
    setRetry(false)
    setTaken(new Set<string>())
    spend()

    const sent = await props.chat.send(
      text,
      attachments.map((attachment) => attachment.path),
      context,
      interrupt,
    )
    if (sent) return
    recoverDraft()
    props.holding.restore(uploadScope, attachments)
    restoreArmed(held)
  }

  const accept = (name: string) => {
    rewrite({ text: `/${name} `, caret: name.length + 2 })
    setAsked(false)
  }

  const rewrite = (next: Written) => {
    // Focus reads the caret into the shared draft too. Keep it in this batch:
    // otherwise that notification can reapply the OLD text between the DOM
    // rewrite and setDraft, moving a mid-sentence caret to the end.
    batch(() => {
      if (input !== undefined) {
        input.value = next.text
        input.setSelectionRange(next.caret, next.caret)
        input.focus()
      }
      setDraft(next.text)
      setCaret(next.caret)
    })
  }

  const insertCarried = (text: Insertion) => rewrite(insertAt(draft(), caret(), text))
  const releaseInsert = props.onInsert?.(insertCarried)
  onCleanup(() => releaseInsert?.())

  const unname = (id: string) => {
    disarmNode(id)
    const next = unnamed(draft(), id, caret())
    if (next.text !== draft()) rewrite(next)
  }

  const dismiss = () => {
    const completing = found()
    if (completing !== null) setDismissed(tokenOf(completing))
    setAsked(false)
  }

  const askForAll = () => {
    if (open()) {
      dismiss()
      return
    }
    setDismissed(null)
    setAsked(true)
    input?.focus()
  }

  const onKey = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      setAsked(false)
      return
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      // Confirming an IME candidate (Japanese, Chinese, Korean) is a `keydown`
      // whose `key` reads `Enter`, so without this the message leaves
      // mid-conversion.
      if (composing(event)) return
      void send(event.altKey && interruptible())
    }
    queueMicrotask(readCaret)
  }

  return (
    <div class="relative shrink-0 p-2 short:p-1">
      <Show when={open()}>
        <CompletionMenu
          completing={found()}
          rows={rows()}
          asked={nodesNamed.answering() ?? undefined}
          within={() => input}
          onDismiss={dismiss}
        />
      </Show>

      <Show when={naming() !== null && nodesNamed.failure()}>
        {(said) => (
          <SaidLine
            said={{ tone: "alarm", text: `Couldn't search your notes. ${said()}` }}
            class="m-0 mb-1 text-label"
            testid={TESTID.chatNamingFailure}
          />
        )}
      </Show>

      <ContextChips nodes={armed()} onRemove={unname} />

      <Attachments
        names={props.holding.pending().map((attachment) => attachment.name)}
        onRemove={props.holding.remove}
      />

      <textarea
        ref={input}
        class="w-full resize-none rounded-control border border-rule bg-paper px-3 py-2 text-body placeholder:text-muted focus:border-accent short:py-1"
        data-testid={TESTID.chatInput}
        // If Enter ever stops sending here, this attribute goes with it.
        enterkeyhint="send"
        data-asked={nodesNamed.answering() ?? undefined}
        rows={2}
        placeholder={working() ? "…or say the next thing" : "Ask the agent…"}
        value={draft()}
        onInput={(event) => {
          batch(() => {
            setDraft(event.currentTarget.value)
            readCaret()
            setAsked(false)
          })
        }}
        onClick={readCaret}
        onSelect={readCaret}
        onFocus={readCaret}
        onKeyDown={onKey}
        onPaste={(event) => {
          const files = [...(event.clipboardData?.files ?? [])]
          if (files.length === 0) return
          event.preventDefault()
          void props.holding.take(files)
        }}
      />

      <Show when={props.holding.sending() > 0 || props.chat.state().asking > 0 || promised()}>
        <div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <Show when={props.holding.sending() > 0}>
            <span class="tabular-nums text-caption text-muted" data-testid={TESTID.chatUploadProgress}>
              Attaching{props.holding.sending() > 1 ? ` ${props.holding.sending()}` : ""}… {props.holding.progress()}%
            </span>
          </Show>
          <Show when={props.chat.state().asking > 0}>
            <span
              class="text-caption text-doing"
              data-testid={TESTID.chatWaiting}
              aria-live="polite"
            >
              Waiting on your answer
            </span>
          </Show>
          <Show when={promised()}>
            <span
              class="text-caption text-muted"
              data-testid={TESTID.chatQueues}
            >
              Messages wait their turn
            </span>
          </Show>
        </div>
      </Show>

      <div class="mt-2 flex items-center gap-2">
        <input
          ref={picker}
          type="file"
          accept={ATTACHMENT_ACCEPT}
          multiple
          class="hidden"
          onChange={(event) => {
            picked(event.currentTarget.files)
            // Cleared so picking the SAME file twice fires `change` twice.
            event.currentTarget.value = ""
          }}
        />
        <button
          type="button"
          class={`${CONTROL} w-8 border-rule text-muted hover:text-ink`}
          data-testid={TESTID.chatAttachButton}
          aria-label="Attach a file"
          onClick={() => picker?.click()}
        >
          +
        </button>
        {/* `capture="environment"` asks a phone to open its back camera
            directly; each input names one media kind, and the platform returns
            one capture per invocation, so neither carries `multiple`. `accept`
            is a media WILDCARD rather than the gate's extension list because
            the capture prompt reads its mode from the MIME kind. Desktop
            browsers ignore `capture` and would open an ordinary file dialog,
            so the doors are drawn only where `camera()` says a finger is the
            pointer. */}
        <Show when={camera()}>
          <input
            ref={shutter}
            type="file"
            accept="image/*"
            capture="environment"
            class="hidden"
            onChange={(event) => {
              picked(event.currentTarget.files)
              event.currentTarget.value = ""
            }}
          />
          <button
            type="button"
            class={`${CONTROL} w-8 border-rule text-muted hover:text-ink`}
            data-testid={TESTID.chatCameraButton}
            aria-label="Take a photo"
            onClick={() => shutter?.click()}
          >
            <svg viewBox="0 0 16 16" class="size-4" aria-hidden="true" fill="currentColor">
              <path
                fill-rule="evenodd"
                d="M5.5 2h5l1 2h1A1.5 1.5 0 0 1 14 5.5v6a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 11.5v-6A1.5 1.5 0 0 1 3.5 4h1l1-2zM8 11a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"
                clip-rule="evenodd"
              />
            </svg>
          </button>
          <input
            ref={camcorder}
            type="file"
            accept="video/*"
            capture="environment"
            class="hidden"
            onChange={(event) => {
              picked(event.currentTarget.files)
              event.currentTarget.value = ""
            }}
          />
          <button
            type="button"
            class={`${CONTROL} w-8 border-rule text-muted hover:text-ink`}
            data-testid={TESTID.chatVideoButton}
            aria-label="Record a video"
            onClick={() => camcorder?.click()}
          >
            <svg viewBox="0 0 16 16" class="size-4" aria-hidden="true" fill="currentColor">
              <path d="M2.5 3.5h7A1.5 1.5 0 0 1 11 5v6a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 1 11V5a1.5 1.5 0 0 1 1.5-1.5zM12 6l3-2v8l-3-2z" />
            </svg>
          </button>
        </Show>
        <Show when={props.chat.state().commands.length > 0}>
          <button
            type="button"
            class={`${CONTROL} w-8 border-rule text-muted hover:text-ink`}
            data-testid={TESTID.chatCommands}
            aria-label="Show slash commands"
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
            Cancel
          </button>
        </Show>
        <Show when={interruptible()}>
          <Tip text="Send now, into the running turn (Alt+Enter)">
            <button
              type="button"
              class={`${CONTROL} border-doing px-3 text-doing`}
              data-testid={TESTID.chatInterrupt}
              onClick={() => void send(true)}
            >
              Interrupt
              <span class="sr-only"> — send now, into the running turn (Alt+Enter)</span>
            </button>
          </Tip>
        </Show>
        <button
          type="button"
          class={`${CONTROL} border-transparent bg-accent px-3 font-semibold text-paper hover:opacity-90`}
          data-testid={TESTID.chatSend}
          onClick={() => void send()}
        >
          {retry() && draft().trim() ? "Send again" : "Send"}
        </button>
      </div>
    </div>
  )
}
