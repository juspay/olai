/**
 * A served `.html`, drawn.
 *
 * One element: a frame holding the file's own markup behind the seal
 * (./sealed.ts, which is where the whole security argument is written and where
 * a reviewer should start). This file is the frame's own three decisions and
 * nothing else.
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
 * The HEIGHT is the page's OWN, and it is measured rather than assumed. It used
 * to be `70dvh` flat, because a frame sizes to its content only if something
 * inside it measures and reports and nothing in there could run — so every
 * preview got the same two thirds of a screen whether it held a three-line
 * receipt (a screenful of white under it) or a long article (a scrollbar inside
 * the page's scrollbar). The seal now admits exactly one script, by hash, and
 * that script's whole job is to `postMessage` the page's height out
 * (`./sealed.ts`'s `MEASURE`, where the security argument for admitting it is
 * made). This file is the other end of that message, and it treats what arrives
 * as a CLAIM: {@link BOUNDS} is a CSS `clamp` around it, so a frame is never
 * smaller than a heading and never longer than two screens, whatever number the
 * frame sends and whether or not it sends one at all — `70dvh` survives as the
 * FALLBACK inside that clamp, which is the honest place for a guess.
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

import { createMemo, createSignal, onCleanup } from "solid-js"

import { TESTID } from "../testids.ts"
import { sealed } from "./sealed.ts"

/**
 * The range a measured page is allowed to land in, and the guess it falls back
 * to — the three numbers that make an untrusted height safe to obey.
 *
 * `min`: a frame shorter than this reads as a rendering failure rather than as
 * a short page. An empty `.html` measures a couple of dozen pixels; a rectangle
 * that thin with a border on it looks like a bug in the app, so a preview keeps
 * enough height to say "this file is empty" by showing that it is.
 *
 * `max`: two screens. A page taller than this scrolls INSIDE the frame, which
 * is the old behaviour and the right one at that length — the alternative is a
 * single element tall enough to hold a book, which costs the browser real
 * layout and leaves the reader no way past it but the wheel. Two is chosen so
 * that the ordinary long page — a report, an article, an exported dashboard —
 * lands under the bound and scrolls with the page around it, and only the
 * genuinely enormous file meets a scrollbar of its own.
 *
 * `guess`: what the frame is before the first measurement arrives, and what it
 * stays as if none ever does — an old browser, a policy that refused the
 * measure, a page that hung before `DOMContentLoaded`. It is the number this
 * component used unconditionally before, so the failure mode of the new
 * mechanism is exactly the behaviour of the old one.
 *
 * `dvh` for both bounds, because it is what this app already uses for boxes
 * that have to fit a phone with its address bar in motion (`../Sidebar.tsx`,
 * the chat dock), and a preview that ran off the bottom of a phone would be a
 * preview with no way back to the sidebar.
 */
const BOUNDS = { min: "6rem", max: "200dvh", guess: "70dvh" } as const

/** What {@link MEASURE} sends, as the receiver must treat it: a message from an
 *  opaque origin, so every field is checked rather than trusted. */
const heightIn = (said: unknown): number | undefined => {
  if (typeof said !== "object" || said === null) return undefined
  const claim = said as { readonly olai?: unknown; readonly height?: unknown }
  if (claim.olai !== "page-height") return undefined
  if (typeof claim.height !== "number" || !Number.isFinite(claim.height)) return undefined
  return claim.height > 0 ? Math.ceil(claim.height) : undefined
}

export function Hypertext(props: { readonly file: string; readonly text: string }) {
  // The text, held by VALUE, and the seal applied downstream of it. A
  // collection entry is a fresh object on every revision the server publishes,
  // so without this the file would be copied and compared — saved pages run to
  // megabytes — every time anything in the directory moved. A memo over a
  // string settles by `===`, so an unchanged body never reaches `sealed`.
  const body = createMemo(() => props.text)

  const [measured, setMeasured] = createSignal<number>()
  let frame: HTMLIFrameElement | undefined

  // The message arrives on the WINDOW — there is no per-frame channel — so the
  // sender is identified by IDENTITY rather than by origin: a sandboxed frame
  // with no `allow-same-origin` posts as `"null"`, which every other such frame
  // in every other tab would also post as. `event.source` is the one thing that
  // cannot be spelled by a stranger: it either IS this element's content window
  // or it is somebody else's message, and somebody else's message is dropped
  // before its shape is even looked at.
  const listen = (event: MessageEvent) => {
    if (frame === undefined || event.source !== frame.contentWindow) return
    const height = heightIn(event.data)
    if (height !== undefined) setMeasured(height)
  }
  window.addEventListener("message", listen)
  onCleanup(() => window.removeEventListener("message", listen))

  // The clamp is CSS rather than arithmetic here, so the bounds stay in the
  // units they are argued in: `dvh` is a number this component does not have
  // and should not be reading, and a clamp the browser evaluates is one that
  // follows a rotated phone without anybody being told.
  const height = () =>
    `clamp(${BOUNDS.min}, ${measured() === undefined ? BOUNDS.guess : `${measured()}px`}, ${BOUNDS.max})`

  return (
    <iframe
      ref={frame}
      // `allow-scripts` and NOTHING ELSE. What is absent is what matters:
      // without `allow-same-origin` the frame's origin is nobody's, so the one
      // script the policy admits (./sealed.ts) — and anything that somehow ran
      // beside it — has no cookies, no storage, no reach into this app's DOM.
      // The pair `allow-scripts allow-same-origin` is the combination that lets
      // a framed document take its own sandbox off, and it is the edit this
      // attribute exists to make obvious: ADDING A SECOND TOKEN HERE IS THE
      // DIFFERENCE between this component and a page that runs somebody's
      // JavaScript in this app's origin.
      sandbox="allow-scripts"
      // Nothing is fetched from in there (the seal's `default-src 'none'` sees
      // to that), so this is belt to that braces: were a directive ever
      // loosened, the request still would not carry which page a reader is on.
      referrerpolicy="no-referrer"
      srcdoc={sealed(body())}
      // The frame is a document in the page, so it gets a name a screen reader
      // can announce — the path, which is what the heading above it says too.
      title={props.file}
      style={{ height: height() }}
      class="block w-full rounded border border-rule bg-white"
      data-testid={TESTID.hypertextPreview}
    />
  )
}
