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
 * as a CLAIM: what it publishes is one custom property ({@link PAGE_HEIGHT}),
 * and the stylesheet clamps it — so a frame is never smaller than a heading and
 * never longer than two screens, whatever number the frame sends and whether or
 * not it sends one at all. `70dvh` survives as that clamp's `var()` default,
 * which is the honest place for a guess.
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

import { createMemo, createSignal, onCleanup, onMount } from "solid-js"

import { TESTID } from "../testids.ts"
import { reportedHeight, sealed } from "./sealed.ts"

/**
 * WHAT THE FRAME REPORTS, as this element publishes it: one custom property
 * holding a CSS length, or nothing at all before a page has measured itself.
 *
 * A property rather than a computed `height`, because the two halves of "how
 * tall is this frame" belong to different owners. The MEASUREMENT is this
 * component's — it is a number that arrived over `postMessage`. The POLICY —
 * the floor, the ceiling and what to do without a measurement — is a styling
 * decision, and it lives in the class below where every other length in this
 * client's layout lives (`../Sidebar.tsx`, `../layout/Rail.tsx`) and where the
 * next person to tune it would look. Same shape as the chat dock's
 * `--visible-h` (`../viewport.ts` publishes, the stylesheet bounds), and it is
 * why the fallback can be a `var()` default rather than a branch out here.
 */
const PAGE_HEIGHT = "--page-height"

export function Hypertext(props: { readonly file: string; readonly text: string }) {
  // The SEALED text, memoised — and it is the seal that has to be inside the
  // memo, not just the body. A collection entry is a fresh object on every
  // revision the server publishes, so without a memo the file would be copied
  // and compared — saved pages run to megabytes — every time anything in the
  // directory moved. But Solid compiles the several dynamic bindings on one
  // element into ONE effect, so a memo over the bare text would re-run `sealed`
  // every time any other binding's dependency changed: this element's height
  // property moves on every message the frame sends, which would concatenate a
  // megabyte and throw it away on each one. A memo CACHES, so the effect's
  // re-read is a pointer compare and the seal is built once per revision.
  const source = createMemo(() => sealed(props.text))

  const [measured, setMeasured] = createSignal<string>()
  let frame: HTMLIFrameElement | undefined

  // The message arrives on the WINDOW — there is no per-frame channel — so the
  // sender is identified by IDENTITY rather than by origin: a sandboxed frame
  // with no `allow-same-origin` posts as `"null"`, which every other such frame
  // in every other tab would also post as. `event.source` is the one thing that
  // cannot be spelled by a stranger: it either IS this element's content window
  // or it is somebody else's message, and somebody else's message is dropped
  // before its shape is even looked at (`./sealed.ts` owns the shape).
  //
  // In `onMount`, which is the shape every window listener in this client has
  // (`../palette/Shortcuts.tsx`, `../edit/Editable.tsx`) and the one that makes
  // the ref below a fact rather than a hope: the element exists by then.
  onMount(() => {
    const listen = (event: MessageEvent) => {
      if (event.source !== frame?.contentWindow) return
      const height = reportedHeight(event.data)
      if (height !== undefined) setMeasured(`${height}px`)
    }
    window.addEventListener("message", listen)
    onCleanup(() => window.removeEventListener("message", listen))
  })

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
      srcdoc={source()}
      // The frame is a document in the page, so it gets a name a screen reader
      // can announce — the path, which is what the heading above it says too.
      title={props.file}
      // The measurement, and nothing else: unset until a page reports, which is
      // what makes the `var()` default below the answer for a frame that never
      // does. Setting a height from a measurement made INSIDE the box being
      // sized is a loop, and this is where it closes; it terminates because of
      // which reading the measure takes — `documentElement.offsetHeight` is the
      // content's height and does not know the frame's, so growing the frame
      // does not grow the number (`./sealed.ts` argues the choice). A page
      // reflowing to a new WIDTH does report again, which is the point, and
      // that converges too: a frame sized to its content has no scrollbar left
      // to take width away.
      style={{ [PAGE_HEIGHT]: measured() }}
      // The height POLICY, in the stylesheet rather than in the component,
      // because every number in it is a styling decision:
      //
      //   `6rem`   — a floor. An empty `.html` measures a couple of dozen
      //              pixels, and a bordered rectangle that thin reads as a bug
      //              in the app rather than as an empty file.
      //   `70dvh`  — the `var()` default, so a frame that never reports keeps
      //              exactly the fixed height this component used to give every
      //              preview unconditionally. The new mechanism's failure mode
      //              is the old mechanism.
      //   `200dvh` — a ceiling of two screens. Past it the page scrolls INSIDE
      //              the frame, which is the old behaviour and the right one at
      //              that length: the alternative is a single element tall
      //              enough to hold a book. Two, so the ordinary long page — a
      //              report, an article, an exported dashboard — lands under it
      //              and scrolls with the page around it, and only the
      //              genuinely enormous file meets a scrollbar of its own.
      //
      // `dvh` for both viewport-relative lengths, and specifically the LAYOUT
      // viewport rather than the chat dock's `--visible-h`: this frame sits in
      // flow, so it wants the same reading `../Sidebar.tsx` argues for at
      // length — the visual viewport is right for a `fixed` box on a phone with
      // a keyboard up, and the two disagree by however tall the keyboard is.
      class="block h-[clamp(6rem,var(--page-height,70dvh),200dvh)] w-full rounded border border-rule bg-white"
      data-testid={TESTID.hypertextPreview}
    />
  )
}
