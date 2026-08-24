/**
 * A served picture, drawn — one `<img>`, pointed at the file's own URL on the
 * media route.
 *
 * The simplest face there is, and every decision in it is about what it is
 * NOT doing.
 *
 * AN `<img>` AND NEVER INLINE MARKUP, which is the ruling and is the whole of
 * the trust boundary here. The picture kind claims `.svg` along with the raster
 * spellings (`@olai/format`'s `kinds.ts`), and an SVG is a document that can
 * script: dropped into this page's own DOM it would run in this app's origin,
 * with this app's cookies and this app's storage, which is the one thing a file
 * somebody else wrote may never do. An `<img>` is the element that will not run
 * it — no script, no external fetch, no reach into the page around it — and it
 * is the same shape a markdown `![](…)` has always drawn. The other half of the
 * promise is the RESPONSE, since a reader can also type the media URL into
 * their own address bar: `@olai/server`'s `media.ts` answers an SVG with a
 * policy that sandboxes it, so the file is inert whichever way it is reached.
 *
 * NO INTRINSIC SIZE IS ASSUMED. The file says how big it is and this does not
 * — `max-w-full` and an auto height, so a screenshot four thousand pixels wide
 * lands inside the column and a small icon is drawn at the size it is rather
 * than blown up to fill one. Same rule a picture in a document already gets
 * (`../styles.css`), stated here because this page is not markdown.
 *
 * WHERE THE URL COMES FROM is ./pointed.ts, which is the decision this face
 * shares with the `.pdf` one next door: the file on the media route, at the
 * revision it is at, so a picture replaced on disk is re-fetched rather than
 * served out of the browser's cache.
 *
 * NO EDIT, for `./Hypertext.tsx`'s reason: `write_document` takes a `.md` and
 * nothing else, so a control here would be a door onto a refusal. That is
 * `edits: false` in the registry of faces (./faces.tsx).
 */

import { stemOf } from "@olai/format"

import { TESTID } from "../testids.ts"
import { usePointed } from "./pointed.ts"

/** The file, and nothing else — ./faces.tsx's `Reading`, spelled here for the
 *  reason ./Csv.tsx spells its own. */
export function Image(props: { readonly file: string }) {
  const src = usePointed(() => props.file)

  return (
    <img
      src={src()}
      /* The STEM, which is what the sidebar calls this file and what a reader
         would say out loud. Not the whole path: the path is already the
         heading of this page, and a screen reader reading it twice is the
         page saying the same thing in two voices. Not empty either — a
         picture that IS the page is never decoration. */
      alt={stemOf(props.file)}
      class="block h-auto max-w-full rounded border border-rule"
      data-testid={TESTID.imageView}
      data-file={props.file}
    />
  )
}
