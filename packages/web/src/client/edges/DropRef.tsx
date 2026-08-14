/**
 * The `×` that takes one target off a node's edge list.
 *
 * Two surfaces draw it — beside a link in the row a node draws
 * (`./EdgeRefs.tsx` through `../NodeRefs.tsx`), and beside a chip in the panel
 * that writes the same field (`./EdgePanel.tsx`) — and they are two DOORS onto
 * one op, which is exactly the thing `./relation.ts` exists to keep from being
 * called two different things. It was two hand-copied buttons carrying the same
 * `aria-label` template: rename the sentence in one and the other goes on
 * saying the old thing, compiling.
 *
 * WHAT DIFFERS between the two is the testid, which is deliberate rather than
 * an oversight: a `data-testid` is a contract with a package that does not
 * import this one, and "the × on a drawn reference" and "the × in the panel"
 * are two claims a scenario has to be able to tell apart.
 *
 * The press is stopped here, both ways. Where this hangs off a link in a row,
 * the ancestors are a navigation and, in a tree, a click that opens an editor —
 * and this press is neither of those. Doing it unconditionally rather than only
 * where an ancestor happens to care is what keeps a third caller safe.
 */

import { type TestId } from "../testids.ts"

export function DropRef(props: {
  /** Which × this is, to the browser tests. */
  readonly testid: TestId
  /** The relation the target would come off — the format's own word, since it
   *  is what the sentence says and what an agent's tool is named after. */
  readonly relation: string
  /** The target: the id that rides `data-ref`, and the title the sentence
   *  names it by. */
  readonly id: string
  readonly title: string
  readonly onDrop: (id: string) => void
}) {
  return (
    <button
      type="button"
      class="cursor-pointer border-0 bg-transparent p-0 text-xs leading-none text-muted hover:text-alarm"
      data-testid={props.testid}
      data-ref={props.id}
      aria-label={`stop this node's \`${props.relation}\` naming ${props.title}`}
      title={`remove ${props.title}`}
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        props.onDrop(props.id)
      }}
    >
      ×
    </button>
  )
}
