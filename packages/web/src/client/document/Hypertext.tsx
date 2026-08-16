/**
 * A served `.html`, drawn.
 *
 * One element: a frame holding the file's own markup behind the seal
 * (./sealed.ts, which is where the whole security argument is written and where
 * a reviewer should start). This file is the frame's own four decisions and
 * nothing else.
 *
 * `srcdoc` rather than `src`, and that is the first of them. The body is
 * already in the tab — a `.html` rides the documents collection like every
 * other bodied file, arriving on the same revision and updating on the same
 * probe — so a URL would be a second way to read a file this app already holds,
 * which means a second route on the server, a second path guard on it, and a
 * second answer to "which files may be fetched" beside `/media/`'s. `srcdoc`
 * has none of that: there is no address, so there is nothing to guess, nothing
 * to traverse, and nothing an unauthenticated fetch could reach. The file's own
 * PICTURES do come off `/media/`, and that is the same route rather than a
 * second one: this component hands the seal the origin and the file's path, and
 * the seal points the file's relative addresses at the route markdown's
 * pictures already travel (./sealed.ts, which argues why re-basing rather than
 * rewriting is what a preview may safely do to somebody's markup).
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
 * The frame STAYS ON ITS OWN DOCUMENT, and that is the fourth decision — the
 * one this component owes to the seal rather than to the reader. A `sandbox`
 * attribute is a fact about the browsing CONTEXT and survives every navigation;
 * a `<meta>` policy is a fact about one DOCUMENT and dies with it. So a page
 * that walks the frame off `about:srcdoc` — a `<meta http-equiv="refresh">`, a
 * link the reader clicks — used to land somewhere unsealed and harmless,
 * because `sandbox=""` barred scripts everywhere; now it would land somewhere
 * unsealed where scripts RUN, with no `default-src 'none'` over it. The origin
 * would still be nobody's, so the vault is not reachable either way, but
 * "running is worth nothing in there" would stop being true the moment the
 * frame stopped being the sealed document.
 *
 * It cannot be asked where it is — an opaque origin answers nothing — so it is
 * COUNTED instead. Every document this component puts in the frame is one it
 * asked for; a `load` nobody asked for is the frame somewhere else, and the
 * answer is to put the seal back ({@link WALK_OFFS} bounds the case where the
 * page does it again the moment it is restored). Grok's review of this PR is
 * what found the gap.
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

import { createEffect, createMemo, createSignal, on, onCleanup, onMount } from "solid-js"

import { TESTID } from "../testids.ts"
import { type Framed, reported, sealed } from "./sealed.ts"

/**
 * How many times a page may walk the frame off its own document, per document
 * shown, before this component stops putting the file back and gives the frame
 * a sealed EMPTY one instead.
 *
 * A BUDGET, counted, with no clock in it — and the clock is what this is
 * deliberately not. The tempting rule is "restore unless it happens again
 * immediately, because a reader clicking a link is slower than a refresh": that
 * rule ping-pongs forever against `content="2;…"`, which is slower than the
 * threshold and just as automatic. A page that re-arms its own walk-off is
 * unbounded under any timing rule and bounded under this one.
 *
 * What it costs is the reader who follows several links in one preview and
 * finds the frame empty on the fourth; they reopen the page, which is one
 * click, and the budget is fresh. What it buys is that no served file can put
 * this tab in a reload loop, reparsing a megabyte on every bounce.
 *
 * The empty seal is the end state rather than the file, because the file is
 * what keeps leaving: inert, sealed, and visibly not the document — which is
 * the honest way to say "this page will not be shown without walking off".
 */
const WALK_OFFS = 3

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
  // WHERE THIS FRAME IS, as the seal's two inputs. `location.origin` is the one
  // thing the seal cannot say for itself and the reason it takes an argument at
  // all: a `<meta>` policy has no keyword for "the origin that embedded me",
  // and `'self'` inside an opaque origin matches nothing. Read HERE, at the
  // only call site, so `./sealed.ts` stays a pure module a test can hand a
  // hostile origin to.
  const framed = (): Framed => ({ origin: location.origin, file: props.file })

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
  const source = createMemo(() => sealed(props.text, framed()))

  const [measured, setMeasured] = createSignal<string>()
  let frame: HTMLIFrameElement | undefined

  // The widths the accepted heights were measured at, and the reason they are
  // kept: a page may be sized in `vh`. `min-height: 100vh` on a wrapper is
  // ordinary in a saved dashboard, and its height is then the FRAME's height —
  // so accepting every report would be a ladder, each one taller because the
  // last one made the frame taller, climbing until the clamp ate it. (Measured,
  // before this guard: a one-screen `100vh` page came out at 1798px against a
  // 1800px bound.)
  //
  // So a height is accepted ONCE PER WIDTH, PER KIND — and there are two kinds
  // because there are two moments a page's height is honestly different. A
  // reflow at a new width is one, and it was the only one while the seal
  // refused every fetch there was. A page whose PICTURES have arrived is the
  // other: an `<img>` is a zero-tall box until its bytes land, so the reading
  // taken when the document parsed is short by however tall the pictures turn
  // out to be, and the frame's own `load` is when there is nothing left to wait
  // for (`./sealed.ts` tags that reading, and argues why the tag has to come
  // from in there rather than be guessed out here).
  //
  // TWO RUNGS, then, not an open ladder: at one width this accepts at most one
  // measurement and at most one settled reading, both of which the frame sends
  // once. A `vh` page can therefore climb exactly the difference the second
  // reading sees and then stops, whatever else arrives — including from a
  // document that walked off the seal and is running its own script, which is
  // the only sender that could ever repeat a message on purpose.
  let sizedAt: number | undefined
  let settledAt: number | undefined
  // Loads this component asked for. Every document it puts in the frame is one;
  // a `load` with none outstanding is the frame somewhere nobody sent it.
  let expected = 0
  let walkOffs = 0

  /** Put a document in the frame, and remember that its `load` is ours.
   *
   *  Imperative, and the reason is the restore: the markup that goes back after
   *  a walk-off is the SAME string that is already in the attribute, and a
   *  declarative binding compares and does nothing. Assigning `srcdoc` — even
   *  the identical value — re-navigates the frame, which is what makes putting
   *  the seal back possible at all. */
  const show = (markup: string) => {
    if (frame === undefined) return
    expected += 1
    // The height belonged to the document that is leaving.
    sizedAt = undefined
    settledAt = undefined
    setMeasured(undefined)
    frame.srcdoc = markup
  }

  const loaded = () => {
    if (expected > 0) {
      expected -= 1
      return
    }
    // Nobody asked for this document. The page walked the frame off its own
    // markup, and whatever is under there now has no seal over it.
    walkOffs += 1
    show(walkOffs > WALK_OFFS ? sealed("", framed()) : source())
  }

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
      const report = reported(event.data)
      if (report === undefined) return
      const width = frame.clientWidth
      if (width === (report.settled ? settledAt : sizedAt)) return
      if (report.settled) settledAt = width
      else sizedAt = width
      setMeasured(`${report.height}px`)
    }
    window.addEventListener("message", listen)
    onCleanup(() => window.removeEventListener("message", listen))
  })

  // DEFERRED, because the first document is put in by the `ref` below — before
  // the element is in the page, so it arrives with its markup already on it and
  // costs exactly one load. This is only the file changing on disk afterwards,
  // and a new revision is a new document, so the walk-off budget starts over:
  // what it bounds is one page bouncing, not a file's whole history.
  createEffect(
    on(source, (markup) => {
      walkOffs = 0
      show(markup)
    }, { defer: true }),
  )

  return (
    <iframe
      // The element, and its first document, in one step: assigning `srcdoc`
      // here happens before insertion, so there is no `about:blank` load ahead
      // of the sealed one and the count starts honest.
      ref={(element) => {
        frame = element
        show(source())
      }}
      onLoad={loaded}
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
      // The one thing fetched from in there is a picture of this vault, off
      // this same server (the seal's `img-src`), and nothing else is fetched at
      // all. This is belt to those braces: the picture request does not carry
      // which page a reader is on, and were a directive ever loosened, neither
      // would whatever the loosening admitted.
      referrerpolicy="no-referrer"
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
