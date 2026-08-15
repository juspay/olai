/**
 * A served `.html`, drawn.
 *
 * One element: a frame with every sandbox restriction on, holding the file's
 * own markup behind the seal (./sealed.ts, which is where the whole security
 * argument is written and where a reviewer should start). This file is the
 * frame's own three decisions and nothing else.
 *
 * `srcdoc` rather than `src`, and that is the first of them. The body is
 * already in the tab — a `.html` rides the documents collection like every
 * other bodied file, arriving on the same revision and updating on the same
 * probe — so a URL would be a second way to read a file this app already holds,
 * which means a second route on the server, a second path guard on it, and a
 * second answer to "which files may be fetched" beside `/media/`'s. `srcdoc`
 * has none of that: there is no address, so there is nothing to guess, nothing
 * to traverse, and nothing an unauthenticated fetch could reach.
 *
 * The HEIGHT is a decision because it cannot be an answer. A frame sizes to its
 * content only if something inside it measures and reports, and nothing inside
 * this one can run — that is the point of it. So the frame is given a tall,
 * fixed share of the viewport and SCROLLS ITS OWN CONTENT, which is what a
 * browser does with a page anyway. `70dvh` rather than a fraction of the pane:
 * `dvh` is what this app already uses for boxes that have to fit a phone with
 * its address bar in motion (`../Sidebar.tsx`, the chat dock), and a preview
 * that ran off the bottom of a phone would be a preview with no way back to the
 * sidebar.
 *
 * And it is drawn on WHITE, with a border. A saved page assumes a page's
 * ground: unstyled markup is black text, and the seal declares a light colour
 * scheme so the frame's own defaults follow. The border is what says the white
 * rectangle in a dark theme is a document being shown and not the app losing
 * its colours — the same edge a picture in a document gets.
 *
 * No EDIT affordance, and no draft: `write_document` refuses anything that is
 * not a `.md` (`@olai/ops`), so a control here would be a door onto a refusal.
 * That is the registry's `edits: false` (./faces.tsx) rather than a `Show` in
 * this file, so the two kinds of page answer the question in one place.
 */

import { createMemo } from "solid-js"

import { TESTID } from "../testids.ts"
import { sealed } from "./sealed.ts"

export function Hypertext(props: { readonly file: string; readonly text: string }) {
  // The text, held by VALUE, and the seal applied downstream of it. A
  // collection entry is a fresh object on every revision the server publishes,
  // so without this the file would be copied and compared — saved pages run to
  // megabytes — every time anything in the directory moved. A memo over a
  // string settles by `===`, so an unchanged body never reaches `sealed`.
  const body = createMemo(() => props.text)

  return (
    <iframe
      // EVERY restriction: no scripts, and an opaque origin because
      // `allow-same-origin` is absent. Spelled as the empty string rather than
      // omitted — an absent `sandbox` attribute is a frame with NO restrictions
      // at all, which is the one-character difference between this component
      // and a page that runs somebody's JavaScript in this app's origin.
      // MUST STAY THE EMPTY STRING — a token added here is that difference.
      sandbox=""
      // Nothing is fetched from in there (the seal's `default-src 'none'` sees
      // to that), so this is belt to that braces: were a directive ever
      // loosened, the request still would not carry which page a reader is on.
      referrerpolicy="no-referrer"
      srcdoc={sealed(body())}
      // The frame is a document in the page, so it gets a name a screen reader
      // can announce — the path, which is what the heading above it says too.
      title={props.file}
      class="block h-[70dvh] w-full rounded border border-rule bg-white"
      data-testid={TESTID.hypertextPreview}
    />
  )
}
