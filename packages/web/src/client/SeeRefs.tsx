/**
 * A node's free cross-references (`see`), drawn as links.
 *
 * The format stores target ids; the link TEXT is each target's title, resolved
 * at view time through the set's indexes (./derived.tsx). That is the same
 * discipline as status and tags: nothing about the target is stored on the
 * source, so a retitle on the target is free and a link cannot disagree with
 * the page it opens. The HREF is the target's id as written — `/n/<id>` is a
 * permalink, and a mirror id lands on the same canonical page a bullet would.
 *
 * Drawn wherever a node is drawn (./NodeBody.tsx): a tree row, a day entry,
 * the subject's own page. Absent when the node carries no `see`.
 */

import { follow, isMirror, type RegularNode } from "@olai/format"
import { createMemo, For, Show } from "solid-js"

import { useDerived } from "./derived.tsx"
import { Link } from "./router.tsx"
import { TESTID } from "./testids.ts"
import { TARGET } from "./touch.ts"

export function SeeRefs(props: {
  /** The regular node being shown — for a mirror row, the node it stands for. */
  readonly node: RegularNode
}) {
  const derived = useDerived()

  const refs = createMemo(() => {
    const see = props.node.see
    if (see === undefined || see.length === 0) return []
    const indexes = derived()
    if (indexes === undefined) return []

    return see.flatMap((id) => {
      const located = indexes.byId.get(id)
      if (located === undefined) {
        // A set under the stale banner can hold a dangling id the validator
        // would refuse; still draw the link so the page says what the file
        // says, with the id as text rather than a blank.
        return [{ id, title: id }]
      }
      if (!isMirror(located.node)) {
        return [{ id, title: located.node.title }]
      }
      const found = follow(indexes, located)
      return found.kind === "found"
        ? [{ id, title: found.shows.node.title }]
        : [{ id, title: id }]
    })
  })

  return (
    <Show when={refs().length > 0}>
      <div
        class="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm"
        data-testid={TESTID.seeRefs}
      >
        <span class="text-muted">see</span>
        <For each={refs()}>
          {(ref) => (
            <Link
              route={{ kind: "node", id: ref.id }}
              class={`inline-flex ${TARGET} items-center text-accent no-underline hover:underline md:min-h-0`}
              testid={TESTID.seeLink}
              title={`open ${ref.title}`}
            >
              {/* data-see is the TARGET id: titles change under a live page,
                  ids do not, so a scenario picks the link by this. */}
              <span data-see={ref.id}>{ref.title}</span>
            </Link>
          )}
        </For>
      </div>
    </Show>
  )
}
