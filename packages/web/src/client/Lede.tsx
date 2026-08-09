/**
 * The paragraph under a heading that says what happened.
 *
 * One component rather than one class string per screen: the error view and a
 * dead permalink are the same voice — what is wrong, and where to look — and
 * two copies would be two chances for one of them to drift into a different
 * measure or colour while saying the same kind of thing.
 */

import type { JSX } from "solid-js"

export function Lede(props: {
  readonly children: JSX.Element
  readonly testid?: string
}) {
  return (
    <p class="mt-0 mb-4 max-w-3xl text-muted" data-testid={props.testid}>
      {props.children}
    </p>
  )
}
