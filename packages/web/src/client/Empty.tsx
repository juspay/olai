import { Dynamic } from "solid-js/web"
import { Show } from "solid-js"

import { TESTID } from "@olai/ui-primitives/testids.ts"
import { Leaf } from "@olai/web/client/Leaf.tsx"

export interface EmptyAction {
  readonly label: string
  readonly href?: string
  readonly run?: () => void
  readonly testid?: string
}

export function Empty(props: {
  readonly testid?: string
  readonly line: string
  readonly detail?: string
  readonly action?: EmptyAction
}) {
  const pageId = () => props.testid !== undefined && props.testid !== TESTID.nothing ? props.testid : undefined
  return (
    <div class="flex flex-col items-start gap-5 py-12" data-testid={pageId()}>
      <Leaf class="size-16 text-accent/40" />
      <div class="flex flex-col items-start gap-1">
        <p class="m-0 font-sans text-title font-medium leading-snug text-muted" data-testid={TESTID.nothing}>
          {props.line}
        </p>
        <Show when={props.detail}>
          {(detail) => <p class="m-0 text-body text-muted">{detail()}</p>}
        </Show>
      </div>
      <Show when={props.action}>
        {(action) => (
          <Dynamic component={action().href ? "a" : "button"}
            href={action().href}
            type={action().href ? undefined : "button"}
            class="inline-flex min-h-11 cursor-pointer items-center rounded-control border-0 bg-accent px-4 text-body font-semibold text-paper hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent md:min-h-9"
            data-testid={action().testid}
            onClick={() => action().run?.()}
          >
            {action().label}
          </Dynamic>
        )}
      </Show>
    </div>
  )
}
