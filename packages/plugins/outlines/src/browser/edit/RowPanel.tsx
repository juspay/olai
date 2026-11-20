import { type JSX, Show } from "solid-js"

import type { PanelIds, Press } from "./panel.ts"
import type { Submission } from "./submission.ts"
import { SaidLine } from "@olai/web/client/SaidLine.tsx"
import type { Said } from "@olai/web/client/saying.ts"
import { PANEL_OUT } from "@olai/web/client/pill.ts"
import { TARGET } from "@olai/ui-primitives/touch.ts"

export function RowPanel(props: {
  readonly submission: Submission
  readonly ids: PanelIds
  readonly press: () => Press
  readonly send: () => Promise<Said | undefined>
  readonly onClose: () => void
  readonly notice?: string | undefined
  readonly about?: string | undefined
  readonly children: JSX.Element
}) {
  const { said, setSaid, sending, setSending } = props.submission
  let submit: HTMLButtonElement | undefined
  let cancel: HTMLButtonElement | undefined
  const dismiss = () => {
    props.submission.dismiss()
    props.onClose()
  }

  const press = async (): Promise<void> => {
    if (sending() || !props.press().writes) return
    if (document.activeElement === submit) cancel?.focus()
    setSending(true)
    setSaid(null)
    const revision = props.submission.revision()
    try {
      const answer = await props.send()
      if (revision !== props.submission.revision()) return
      if (answer !== undefined) {
        setSaid(answer)
        return
      }
      props.onClose()
    } finally {
      setSending(false)
    }
  }

  return (
    <div
      class="my-1"
      data-testid={props.ids.panel}
      data-key={props.about}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return
        event.preventDefault()
        event.stopPropagation()
        dismiss()
      }}
    >
      <form
        class="flex flex-wrap items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          void press()
        }}
      >
        {props.children}
        <button
          ref={submit}
          type="submit"
          class={`${TARGET} md:min-h-0 cursor-pointer rounded-control border border-rule bg-transparent px-2 py-1 text-body text-ink hover:bg-rule disabled:cursor-default disabled:text-muted disabled:hover:bg-transparent`}
          data-testid={props.ids.set}
          disabled={sending() || !props.press().writes}
        >
          {props.press().label}
        </button>
        <button
          ref={cancel}
          type="button"
          class={PANEL_OUT}
          data-testid={props.ids.cancel}
          onClick={dismiss}
        >
          Cancel
        </button>
      </form>

      <Show when={props.notice}>
        {(notice) => (
          <p class="mt-1 mb-0 text-label leading-snug text-muted" data-testid={props.ids.notice}>
            {notice()}
          </p>
        )}
      </Show>

      <Show when={said()}>
        {(message) => (
          <SaidLine
            said={message()}
            class="mt-1 mb-0 text-body leading-snug"
            testid={props.ids.said}
          />
        )}
      </Show>
    </div>
  )
}
