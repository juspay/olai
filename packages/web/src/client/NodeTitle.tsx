/**
 * A title, printed.
 *
 * What the title becomes is decided once, in `./markdown/title.ts` — inline
 * markdown and `#tags` — so a tree row, a zoomed heading, a breadcrumb and a
 * see-link cannot disagree about either. This file is only the element that
 * hands that HTML to the page.
 *
 * A filtered page hands down the words it found the node by, and they are lit
 * inside whatever the title turns out to be — a word, a phrase, or the `#tag`
 * that was pressed. That is a fact about the PAGE rather than about the title,
 * which is why it arrives as a prop from the row rather than being read here:
 * the same title is drawn in a breadcrumb and a see-link, where there is no
 * query to have found anything.
 *
 * ## AND A TITLE THAT IS NOTHING BUT AN ADDRESS IS DRAWN AS THE PAGE IT NAMES
 *
 * `/doc/orchestrator/instructions.md` is a title this app WRITES: it is how a
 * pin is spelled, because storing a name beside the address would be storing a
 * copy of a fact the set already holds (docs/format.md's Pins). The sidebar's
 * shelf resolved those rows from the first day and the FILE's own page did
 * not — so opening `Pins.olai`, which the design invites, showed the plumbing
 * (maintainer, 2026-08-18: *wtf is this UI*).
 *
 * The fix is here rather than on that page, and that is the whole of it: a
 * title is rendered at view time — markdown is, tags are — and an address is
 * one more reading of the same string, so it is decided where every title is
 * decided and no page has a case of its own. `Pins.olai` is browsable because
 * it is an ordinary outline, and it now reads like one.
 *
 * WHAT IS NOT TAKEN OVER is a markdown LINK. `[the spec](/doc/spec.md)` is
 * already drawn by the pipeline as a link with the label its author wrote —
 * that title never leaked anything, and a face there would swap a clickable
 * link for a mark and take away a feature titles have always had. The narrower
 * predicate is `bareAddressIn`'s, and it says so.
 *
 * The EDITOR is untouched and is the other half of the answer: a click on a
 * title opens it, and what it shows is the SOURCE — the address exactly as it
 * is stored — the same trade every markdown title already makes. So the face
 * is what you read and the address is what you edit.
 */

import { createMemo, Show } from "solid-js"

import { bareAddressIn } from "./address/address.ts"
import { Face } from "./address/Face.tsx"
import { renderTitle } from "./markdown/title.ts"

export function NodeTitle(props: {
  readonly title: string
  /** The file the title is written in — an outline, for a node. Relative
   *  pictures in a title (rare) resolve against it, same contract as a note. */
  readonly from: string
  /** When false, markdown links are unwrapped so this title can sit inside an
   *  existing `<a>` (breadcrumb, see-ref) without nesting anchors. Default
   *  true — tree rows and zoomed headings keep their links. */
  readonly links?: boolean
  /** The words a filter found this node by, lit where they sit
   *  (`./filter/lit.ts`) — absent on every title an unfiltered page draws, and
   *  on every title drawn for a row the query did not select. */
  readonly needles?: ReadonlyArray<string>
}) {
  /** The place this title names, for the titles that name one. Cheap for every
   *  other title in the directory: the test short-circuits on the first
   *  character (`./address/address.ts`). */
  const address = createMemo(() => bareAddressIn(props.title))
  const html = createMemo(() =>
    renderTitle(props.title, props.from, {
      links: props.links,
      needles: props.needles,
    }),
  )
  return (
    <Show
      when={address()}
      fallback={
        <span
          class="olai-md olai-md-inline"
          // Safe: markdown is sanitised; tags are alphabet-restricted; the empty
          // fallback is escaped. See ./markdown/title.ts and ./markdown/render.ts.
          innerHTML={html()}
        />
      }
    >
      {(route) => (
        // The needles are deliberately not carried into a face: what a filter
        // lights is where a WORD sits in the words somebody wrote, and this
        // title's words are the set's rather than the file's. The row is still
        // drawn, and still says it is a match in the ways that are about the
        // row (`./filter/why.ts`).
        <span class="flex min-w-0 flex-1 items-center gap-1.5">
          <Face route={route()} />
        </span>
      )}
    </Show>
  )
}
