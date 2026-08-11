/**
 * A document's table of contents: the headings it has, as links into itself.
 *
 * WHY IT IS HERE, at the top of the page, rather than in a rail beside it. The
 * complaint this answers is "a long document has no way to survey or jump" —
 * and both halves of that are answered by a list a reader meets ON THE WAY IN,
 * before the first paragraph, exactly where a book puts one. A floating rail
 * answers the second half better and the first half not at all: it is furniture
 * beside the text rather than part of it, it needs a column this layout does
 * not have below 48rem, and it has to decide what to do while a reader is at
 * the top of the page and has read nothing. This is the smaller thing, and it
 * is the whole of the complaint. A rail is a later iteration if the reading
 * says so.
 *
 * DOCUMENTS ONLY. A note is a tree row, not a page: it is drawn under a title
 * the page already owns, in `olai-md-compact`, often three of them on screen at
 * once. A contents on each would be furniture stacked on furniture, and a
 * contents for a body of four lines is longer than the body.
 *
 * NOTHING IS STORED. The headings come from the rendering the page is about to
 * draw anyway (`markdown/outline.ts`), so this cannot disagree with the text —
 * and a document whose body has not arrived yet (`./documents.tsx` fetches one
 * at a time) has no contents rather than a stale one. When the body lands, this
 * is drawn from it, with no second question asked over the wire.
 *
 * A `<details>` and nothing else: the collapse is the browser's, so it works
 * before this app's JavaScript has an opinion, it is keyboard-reachable and
 * announced without an `aria-expanded` to keep in step, and the open state
 * survives a live frame because Solid keeps the element. What it is NOT is
 * remembered across documents — a preference (../preference.ts) would be a
 * stored answer to a question nobody has asked twice yet.
 */

import { createMemo, For, Show } from "solid-js"

import type { Heading } from "../markdown/outline.ts"
import { TESTID } from "../testids.ts"
import { TARGET } from "../touch.ts"

/** How far one level of nesting indents a line, in rem. */
const INDENT_REM = 0.75

/**
 * One line. `inline-block` and not the `inline-flex` a row of node refs uses:
 * those are titles that fit on a line, and this is a whole heading — a flex
 * line does not wrap, so a long one would run out of the pane. The padding is
 * what makes the finger target, rather than centring inside a fixed height,
 * for the same reason.
 */
const LINE =
  `inline-block ${TARGET} py-3 break-words text-accent no-underline hover:underline md:min-h-0 md:py-0`

export function Toc(props: { readonly headings: readonly Heading[] }) {
  // Re-based against the shallowest heading the document actually has: a note
  // whose top level is `##` is not a document indented one step, and a
  // document that opens with `#` and then never uses it again should not have
  // every line of its contents pushed in.
  //
  // A memo, because every LINE reads it: as a plain accessor this would be a
  // fresh array and a full scan per row, which is the heading count squared
  // for one number that is the same all the way down.
  const base = createMemo(() => {
    let shallowest = 6
    for (const heading of props.headings) shallowest = Math.min(shallowest, heading.depth)
    return shallowest
  })

  return (
    // One heading is not a contents — it is the document's own title said a
    // second time, above itself. Two is the smallest thing a reader can choose
    // between, which is what a contents is for.
    <Show when={props.headings.length > 1}>
      <nav aria-label="Contents">
        <details
          open
          class="mb-6 rounded border border-rule px-3 py-2"
          data-testid={TESTID.toc}
        >
          <summary class="cursor-pointer text-sm text-muted select-none">
            Contents
          </summary>
          <ol class="mt-2 space-y-0.5 text-sm">
            <For each={props.headings}>
              {(heading) => (
                <li style={{ "padding-left": `${(heading.depth - base()) * INDENT_REM}rem` }}>
                  {/* A plain `<a href="#…">`, not a `<Link>`: this goes nowhere
                      — it is the same page, and the fragment is the browser's
                      own job. Intercepting it would be this app re-implementing
                      a scroll the platform already does, and losing the address
                      a reader can copy. */}
                  <a href={`#${heading.id}`} class={LINE} data-testid={TESTID.tocLink}>
                    {heading.text}
                  </a>
                </li>
              )}
            </For>
          </ol>
        </details>
      </nav>
    </Show>
  )
}
