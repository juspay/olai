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
 * survives a live frame because Solid keeps the element.
 *
 * Which is also the one thing that has to be said out loud about it. `open` is
 * an attribute the BROWSER then owns: shutting it mutates the element and
 * nothing re-runs. A page reused from `/doc/a` to `/doc/b` would therefore
 * carry the reader's answer about the first document onto the second, and
 * "open by default" would quietly mean "open until you ever shut one".
 *
 * Today it does not, and NOT because of anything here: a document's body
 * arrives one at a time (./documents.tsx), so a new file is `undefined` for a
 * frame, the `<Show>` in ../document/DocumentPage.tsx tears this whole block
 * down, and the next `<details>` is a new element. That is a timing fact about
 * a different module, and a promise resting on one is a promise that is fine
 * until somebody makes bodies arrive faster. So the block is KEYED on the file
 * as well: a different document is a different element by construction,
 * whatever the wire does. Within ONE document the element survives every live
 * frame, which is the half worth keeping.
 *
 * What it is NOT is remembered across documents on purpose — a preference
 * (../preference.ts) would be a stored answer to a question nobody has asked
 * twice yet.
 */

import { createMemo, For, Show } from "solid-js"

import type { Heading } from "../markdown/outline.ts"
import { WELL } from "../surface.ts"
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

export function Toc(props: {
  /** The document these headings came out of. Not drawn — it is what the
   *  `<details>` is keyed on, so one document's collapse is not the next
   *  one's. See the note above. */
  readonly file: string
  readonly headings: readonly Heading[]
}) {
  // Re-based against the shallowest heading the document actually has: a note
  // whose top level is `##` is not a document indented one step, and a
  // document that opens with `#` and then never uses it again should not have
  // every line of its contents pushed in.
  //
  // A memo, because every LINE reads it: as a plain accessor it would be a
  // full scan per row, which is the heading count squared for one number that
  // is the same all the way down.
  const base = createMemo(() => {
    let shallowest = 6
    for (const heading of props.headings) shallowest = Math.min(shallowest, heading.depth)
    return shallowest
  })

  // The file, once there is a contents to draw for it. One heading is not a
  // contents — it is the document's own title said a second time, above
  // itself. Two is the smallest thing a reader can choose between, which is
  // what a contents is for.
  const drawnFor = createMemo(() => (props.headings.length > 1 ? props.file : undefined))

  return (
    // KEYED: a different document rebuilds the block, so the new one gets its
    // own `<details>` rather than the last one's state. See the note above for
    // why this is belt as well as braces.
    <Show when={drawnFor()} keyed>
      <nav aria-label="Contents">
        {/* A WELL, inside the sheet (`../surface.ts`): a contents is furniture
            about the document rather than part of it, so it is recessed into
            the paper the way the month is recessed into the rail — which is
            also what retires the hairline box it used to be drawn as. */}
        <details
          open
          class={`mb-6 rounded-xl ${WELL} px-4 py-3`}
          data-testid={TESTID.toc}
        >
          <summary class="cursor-pointer text-sm text-muted select-none">
            Contents
          </summary>
          <ol class="mt-2 space-y-0.5 text-sm">
            <For each={props.headings}>
              {(heading) => (
                <li style={{ "padding-left": `${(heading.depth - base()) * INDENT_REM}rem` }}>
                  {/* A plain `<a href="#…">`, not a `<Link>`: this goes
                      nowhere — it is the same page, and the fragment is the
                      browser's own job. Intercepting it would be this app
                      re-implementing a scroll the platform already does, and
                      losing the address a reader can copy. */}
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
