/**
 * A node named in the panel, as something you can press.
 *
 * One component for every reference this panel AUTHORS — the chips on a message
 * and the node an olai write was about — so "what does pointing at a node look
 * like, and what happens when you press it" is answered once. The third kind of
 * reference is not authored here and cannot be: an id inside the agent's own
 * prose arrives as rendered HTML, so it is marked and listened for on the pane
 * instead ({@link ./refs.ts}). Both ends call the same {@link focusNode}, which
 * is the point of naming this at all.
 *
 * A BUTTON and not a link, because it does not go anywhere: it points at the
 * page the reader already has, and only falls back to the node's own address
 * when the node is not drawn there at all. A `<Link>` would say the opposite
 * with its href, its middle-click and its status bar — and would take a reader
 * off a page they were reading for a node three rows above them.
 */

import type { JSX } from "solid-js"

import { useShowNode } from "../focus.ts"
import { TESTID } from "../testids.ts"

export function NodeRef(props: {
  readonly id: string
  /** What it reads as. A title when the set has one, the id when it does not —
   *  the caller's decision, because the two callers know different amounts
   *  about the node. */
  readonly children: JSX.Element
  readonly class?: string
}) {
  const show = useShowNode()

  return (
    <button
      type="button"
      class={`cursor-pointer border-0 bg-transparent p-0 text-left text-accent hover:underline ${
        props.class ?? ""
      }`}
      data-testid={TESTID.chatNodeRef}
      data-node-ref={props.id}
      title="show this node"
      aria-label={`show ${props.id}`}
      // On this page if it is here; at its own address if it is not — which
      // covers another outline, a collapsed branch and a row done-hidden has
      // left out, without this having to tell them apart. Which of those a
      // press does is `../focus.ts`'s one answer, not this component's.
      onClick={() => show(props.id)}
    >
      {props.children}
    </button>
  )
}
