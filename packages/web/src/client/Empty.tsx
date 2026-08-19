/**
 * A page that has nothing on it, said with the leaf that is the app's mark.
 *
 * The SENTENCE is still the claim and it still carries the testid the
 * scenarios wait on. What this adds is the mark above it, so an empty page
 * is not a lone line of dim type on a field of paper.
 */

import { Leaf } from "./Leaf.tsx"

export function Empty(props: {
  readonly testid?: string
  readonly line: string
}) {
  return (
    <div class="flex flex-col items-start gap-5 py-12">
      <Leaf class="size-16 text-accent/35" />
      <p class="font-serif text-xl italic leading-snug text-muted" data-testid={props.testid}>
        {props.line}
      </p>
    </div>
  )
}
