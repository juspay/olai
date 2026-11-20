import { Show } from "solid-js"

import { TESTID } from "../../testids.ts"

export function LinkCard(props: {
  readonly message: string
  readonly url: string
  readonly host: string
  readonly done: boolean
}) {
  return (
    <div data-testid={TESTID.chatLink} data-host={props.host} data-done={props.done}>
      <p class="m-0 whitespace-pre-wrap text-body">{props.message}</p>
      <div class="mt-2 flex items-center gap-2 text-label">
        <a
          class="rounded-control border border-accent px-2 py-1 text-accent underline underline-offset-2"
          href={props.url}
          target="_blank"
          rel="noreferrer"
          data-testid={TESTID.chatLinkOpen}
        >
          {props.host}
        </a>
        <span class="text-muted">
          <Show when={props.done} fallback={"Open this in a new tab."}>
            The agent says this is done.
          </Show>
        </span>
      </div>
    </div>
  )
}
