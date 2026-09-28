/**
 * A page that has nothing on it, said with the leaf that is the app's mark.
 *
 * The SENTENCE is still the claim and it still carries the testid the
 * scenarios wait on. What this adds is the mark above it, so an empty page
 * is not a lone line of dim type on a field of paper — and, where the owner
 * of the page knows one, the NEXT STEP: a short second line saying what will
 * appear here, and one button that does the obvious thing. An empty page that
 * only says it is empty leaves a person to guess what to do next.
 *
 * Both are the caller's, because only the page's owner knows what belongs on
 * it and which verb starts it. This component knows no plugin and reaches no
 * service; `children` is where an owner draws what its action opened (the new
 * outline's name box, say) so it lands under the words rather than somewhere
 * else on the page.
 */

import type { JSX } from "solid-js"
import { Show } from "solid-js"

import { Leaf } from "@olai/web/client/Leaf.tsx"

/** The one thing an empty page offers to do. */
export interface EmptyAction {
  /** The button's words, Sentence case: `New outline`, `Go home`. */
  readonly label: string
  readonly run: () => void
  readonly testid?: string
}

export function Empty(props: {
  readonly testid?: string
  readonly line: string
  /** What will appear here, or how it gets here, in one short line. */
  readonly detail?: string
  readonly action?: EmptyAction
  readonly children?: JSX.Element
}) {
  return (
    <div class="flex flex-col items-start gap-5 py-12">
      <Leaf class="size-16 text-accent/40" />
      <div class="flex flex-col items-start gap-1">
        <p class="m-0 font-serif text-title italic leading-snug text-muted" data-testid={props.testid}>
          {props.line}
        </p>
        <Show when={props.detail}>
          {(detail) => <p class="m-0 text-body text-muted">{detail()}</p>}
        </Show>
      </div>
      <Show when={props.action}>
        {(action) => (
          <button
            type="button"
            class="inline-flex min-h-11 cursor-pointer items-center rounded-control border-0 bg-accent px-4 text-body font-semibold text-paper hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent md:min-h-9"
            data-testid={action().testid}
            onClick={() => action().run()}
          >
            {action().label}
          </button>
        )}
      </Show>
      {props.children}
    </div>
  )
}
