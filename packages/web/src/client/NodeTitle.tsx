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
 * `/orchestrator/orchestrator.olai` is a title this app WRITES: it is how a
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
 * A TITLE WRITTEN AS ONE MARKDOWN LINK to an address is the same face with a
 * name in it (human, 2026-08-19): `[Kitchen project](/#abc123)` draws
 * *Kitchen project* and pressing it opens `/#abc123`. That is how a pin
 * carries a name somebody chose — renaming one is editing this row's text, and
 * no op and no field were added for it. It stays an ANCHOR because it was
 * written as a link; what it gains is the mark and the query beside it, and
 * what it loses is being drawn by the markdown pipeline, which for one link and
 * nothing else was a round trip through a chunk to arrive at the same words
 * (before the chunk lands, that title draws its raw source — which for a pin is
 * the plumbing, briefly, on every first paint).
 *
 * The EDITOR is untouched and is the other half of the answer: a click on the
 * line opens it, and what it shows is the SOURCE — the title exactly as it is
 * stored — the same trade every markdown title already makes. So the face is
 * what you read and the address is what you edit. On a NAMED face the label
 * itself is the link, so the press that edits is anywhere else on the line;
 * `../Tree.tsx`'s `clickTitle` is what keeps those two presses apart.
 */

import { createMemo, Show } from "solid-js"

import { addressIn, shownIn, titleFace } from "./address/address.ts"
import { Face } from "./address/Face.tsx"
import { useNames } from "./reading.tsx"
import { renderTitle, sameDrawing } from "./markdown/title.ts"
import { TitleHtml } from "./markdown/TitleHtml.tsx"

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
  const names = useNames()
  /** The place this title names, for the titles that name one. Cheap for every
   *  other title in the directory: the test short-circuits on the first
   *  character (`./address/address.ts`). */
  const address = createMemo(() => addressIn(props.title))
  /** The drawing, and NOT a fresh identity per recompute: a filtered page
   *  re-runs this memo on every keystroke, and a title whose HTML has not
   *  changed must not push a new value through to the element — which is what
   *  a memo over an object does by default (`===`). */
  const drawing = createMemo(
    () =>
      renderTitle(props.title, props.from, {
        links: props.links,
        needles: props.needles,
      }),
    undefined,
    { equals: sameDrawing },
  )
  return (
    <Show when={address()} fallback={<TitleHtml drawing={drawing()} />}>
      {(route) => {
        /** WHAT THIS FACE SAYS AND WHAT IT MAY BE, from the one reading both
         *  faces make of a title (`./address/address.ts`) — and the set's half
         *  of it read off the names this PAGE was sent with (`./reading.tsx`).
         *  It was a lookup in the tab's own copy of the vault until PR 10 of
         *  `https://github.com/juspay/oss.olai/blob/main/projects/olai/brainstorming/vault-in-browser.md`; both faces are answered by
         *  the server now, the shelf's on its own member and this one on the
         *  reading of the page the row is drawn in. */
        const face = createMemo(() =>
          titleFace(props.title, route(), shownIn(names(), route()))
        )
        return (
          // The needles are deliberately not carried into a face: what a filter
          // lights is where a WORD sits in the words somebody wrote, and this
          // title's words are the set's rather than the file's. The row is still
          // drawn, and still says it is a match in the ways that are about the
          // row (`./filter/why.ts`).
          <span class="flex min-w-0 flex-1 items-center gap-1.5">
            <Face
              route={route()}
              name={face().name}
              // A WRITTEN name is what may be pressed, and whether this caller
              // may hold an anchor at all is its own half of that answer.
              pressable={face().written && props.links !== false}
            />
          </span>
        )
      }}
    </Show>
  )
}
