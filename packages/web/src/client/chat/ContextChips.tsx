/**
 * The nodes a message is about, as chips — in the composer before it is sent,
 * and on the message afterwards.
 *
 * ONE component for both moments, which is {@link ./Attachments.tsx}'s
 * arrangement and for its reason: they are the same thing at two times, and
 * what differs is only that the pending one can be taken back off. Drawn in the
 * same chip as an attachment, because they are the same claim — *this went with
 * the message* — and two shapes of chip in one strip would say there are two
 * kinds of thing there when there is one.
 *
 * What the chip READS is the title, because that is what a person recognises;
 * what it POINTS at is the id, which is what everything else in this feature
 * speaks. A chip is a {@link ./NodeRef.tsx}, so pressing one in the composer
 * shows you the row you armed — the answer to "is this the right node" being
 * the node itself, rather than a longer label.
 */

import { For, Show } from "solid-js"

import { TESTID } from "../testids.ts"
import { NodeRef } from "./NodeRef.tsx"

/** What a chip needs, which is less than a `NodeContext` and is a structural
 *  subset of one: the id it points at and the words it reads as. The composer
 *  has only the id and reads the title out of the set beside it; a sent message
 *  carries the server's own answer for both. Neither has to build the other's. */
export interface Chip {
  readonly id: string
  readonly title: string
}

export function ContextChips(props: {
  readonly nodes: ReadonlyArray<Chip>
  /** Drawn as a × when given: the composer's strip can disarm one before it is
   *  sent. A row in the transcript is something that happened, and nothing
   *  about it can be taken back. */
  readonly onRemove?: (id: string) => void
}) {
  return (
    <Show when={props.nodes.length > 0}>
      <ul class="mb-1 flex flex-wrap gap-1" data-testid={TESTID.chatContext}>
        <For each={props.nodes}>
          {(node) => (
            <li
              class="flex max-w-full items-center gap-1 rounded border border-accent/40 bg-paper px-1.5 py-0.5 text-[0.6875rem]"
              data-testid={TESTID.chatContextChip}
              data-node={node.id}
            >
              {/* The glyph says NODE, quietly — a chip with a file name in it
                  and a chip with a title in it are otherwise one shape saying
                  two things. */}
              <span class="text-muted" aria-hidden="true">◦</span>
              <NodeRef id={node.id} class="min-w-0 truncate">
                {node.title}
              </NodeRef>
              <Show when={props.onRemove}>
                {(remove) => (
                  <button
                    type="button"
                    class="shrink-0 text-muted hover:text-alarm"
                    aria-label={`send without ${node.title}`}
                    data-testid={TESTID.chatContextRemove}
                    onClick={() => remove()(node.id)}
                  >
                    ×
                  </button>
                )}
              </Show>
            </li>
          )}
        </For>
      </ul>
    </Show>
  )
}
