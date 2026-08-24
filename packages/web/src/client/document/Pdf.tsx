/**
 * A served `.pdf`, drawn — the browser's own viewer, pointed at the file's own
 * URL on the media route.
 *
 * ZERO DEPENDENCIES, which is the ruling and is also this repository's standing
 * rule: olai requires nothing outside Nix (HACKING.md). Every browser this app
 * runs in ships a PDF viewer — pages, zoom, search, print, the lot — and
 * bundling a renderer to draw a worse one would be several megabytes of
 * somebody else's code in the tab to reproduce a feature the tab already has.
 *
 * AN `<object>` RATHER THAN AN `<embed>`, and the difference is one word:
 * FALLBACK. The two ask the browser for the same thing and `<embed>` has no
 * children, so a browser that will not draw a PDF — a text browser, a hardened
 * build, a viewer switched off — shows an empty rectangle and says nothing.
 * That is the failure this app's error rule is about, so the children below are
 * what such a reader gets instead: the sentence, and the file, which they can
 * open in whatever does draw one.
 *
 * WHAT SANDBOXES IT is the browser's own PDF process, and that is worth saying
 * out loud because the `.html` face next door says the opposite about itself. A
 * saved page is markup this app hands to its OWN renderer, so it needs a
 * sandboxed frame and a content policy to stop it reaching the app around it
 * (`@olai/surface`'s `seal.ts`). A PDF is never executed in this page's
 * context: the viewer is out-of-process, its scripting is the viewer's own and
 * cannot see this document, and an `<iframe sandbox>` around it would add no
 * boundary it is not already behind while being the ordinary way to stop the
 * viewer loading at all. What the response promises is what every file on this
 * route promises — it came from the served directory and nowhere else
 * (`@olai/server`'s `media.ts`).
 *
 * THE HEIGHT IS THIS APP'S GUESS and cannot be anything else. A `.html`
 * preview measures itself, because the seal prepends a tape measure to a
 * document this app is serving (`./Hypertext.tsx`); there is no such thing to
 * prepend to a PDF, and the viewer inside reports nothing out. So the element
 * is given a tall fixed height and the document scrolls INSIDE it, which is
 * what a PDF viewer is for — the reader pages through a fixed frame rather than
 * the app growing an element tall enough to hold a book.
 *
 * WHERE THE URL COMES FROM is ./pointed.ts, the decision this face shares with
 * the picture's: the file on the media route, at the revision it is at, so a
 * `.pdf` replaced on disk is re-fetched rather than served out of the
 * browser's cache.
 *
 * NO EDIT, for `./Hypertext.tsx`'s reason (./faces.tsx's `edits: false`).
 */

import { mediaHref } from "@olai/surface"

import { TESTID } from "../testids.ts"
import { usePointed } from "./pointed.ts"

/** What the browser is told this is. Spelled here rather than left to the
 *  response's own `Content-Type`, because it is what makes the element ASK for
 *  a PDF viewer in the first place — an `<object>` with no `type` is a guess
 *  the browser makes after the fetch, and the fallback below is what a wrong
 *  guess draws. */
const PDF_TYPE = "application/pdf"

/** The file, and nothing else — ./faces.tsx's `Reading`, spelled here for the
 *  reason ./Csv.tsx spells its own. */
export function Pdf(props: { readonly file: string }) {
  const src = usePointed(() => props.file)

  return (
    <object
      data={src()}
      type={PDF_TYPE}
      class="block h-[80dvh] w-full rounded border border-rule"
      data-testid={TESTID.pdfEmbed}
      data-file={props.file}
      aria-label={props.file}
    >
      <p class="m-0 p-4 text-muted">
        This browser will not show a PDF here.{" "}
        <a class="underline" href={mediaHref(props.file)} target="_blank" rel="noreferrer">
          Open {props.file}
        </a>
      </p>
    </object>
  )
}
