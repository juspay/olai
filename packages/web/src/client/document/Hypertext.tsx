/**
 * A served `.html`, drawn — and, since the ruling of 2026-08-16, RUNNING.
 *
 * One element: a frame pointed at the file's own URL on the media route, which
 * answers it behind the seal (`@olai/surface`'s `seal.ts`, where the whole
 * security argument is written and where a reviewer should start). This file is
 * the frame's own decisions and nothing else.
 *
 * `src` rather than `srcdoc`, and that is the first of them. It used to be the
 * other way round, with a good reason that has run out: the body is already in
 * the tab, so a URL was a second way to read a file this app already holds. What
 * a `srcdoc` document does not have is an ADDRESS — and every relative address
 * in somebody's saved page needs one to resolve against. The old seal papered
 * over that with a `<base href>` at the media route, which made a picture draw
 * and left every relative LINK 404ing at a URL that was never meant to be one
 * (`html-preview-relative-links`). Served at its own path, the file's base is
 * its own URL and the vault's directory shape IS the URL space: `art/shot.png`
 * beside `notes/report.html` is `/media/notes/art/shot.png`, and `other.html`
 * is the page beside it. Nothing is rewritten to make that true.
 *
 * What it costs is one route answering one more kind of file, and the guard at
 * that end is the same guard pictures already went through (`@olai/server`'s
 * `media.ts`, `@olai/surface`'s `mediaTarget`).
 *
 * THE FILE'S OWN SCRIPTS RUN, which is the ruling. What that changes here is
 * less than a reader expects, because the mechanism that decides the
 * CONSEQUENCE of running is the sandbox and it has not moved: no
 * `allow-same-origin`, so the origin in there is nobody's — no cookies, no
 * storage, no reach into this app's DOM. What it changes about THIS file is the
 * walk-off accounting below, which used to be able to prove where the frame was
 * and no longer can.
 *
 * The HEIGHT is the page's OWN, and it is measured rather than assumed. It used
 * to be `70dvh` flat, so every preview got the same two thirds of a screen
 * whether it held a three-line receipt (a screenful of white under it) or a long
 * article (a scrollbar inside the page's scrollbar). The seal prepends a tape
 * measure whose whole job is to `postMessage` the page's height out
 * (`seal.ts`'s `MEASURE`). This file is the other end of that message, and it
 * treats what arrives as a CLAIM: what it publishes is one custom property
 * ({@link PAGE_HEIGHT}), and the stylesheet clamps it — so a frame is never
 * smaller than a heading and never longer than two screens, whatever number the
 * frame sends and whether or not it sends one at all. `70dvh` survives as that
 * clamp's `var()` default, which is the honest place for a guess.
 *
 * THE FRAME COMES HOME, and this is the decision the new rule reshaped. A
 * `sandbox` attribute is a fact about the browsing CONTEXT and survives every
 * navigation; the seal's policy is a fact about one RESPONSE and does not. So a
 * page that walks the frame off the vault — a `<meta http-equiv="refresh">`, a
 * link to a stranger — lands somewhere with no `default-src` over it, where its
 * script may fetch whatever it likes. The origin is still nobody's, so the
 * vault and this app are still out of reach; what is lost is the PRIVACY half
 * of the promise, which is the half a preview makes.
 *
 * It cannot be asked where it is — an opaque origin answers nothing — so it is
 * COUNTED, and now also LISTENED FOR. Every document this component points the
 * frame at is one it asked for; a `load` nobody asked for is a navigation, and
 * there are two kinds of those now. A relative link to a sibling file of the
 * vault is one, and it is a FEATURE — it is answered by this same route, so the
 * seal is over it and its tape measure reports. A jump to somebody else's server
 * is the other, and nothing reports. So an unasked-for load is given
 * {@link SAYS_HELLO} to identify itself, and the file goes back if it does not.
 *
 * THAT TEST IS FORGEABLE, and it is written down here rather than left to be
 * discovered: a page that has walked off can post the same message, because it
 * runs script and the message is nine bytes and a number. It is not fixable —
 * once the previewed file executes, it is the adversary, and any secret handed
 * in to prove a document is ours is a secret it can hand to a confederate. What
 * this is, then, is a BOUND rather than a proof: a page that leaves without
 * saying anything is brought back, {@link WALK_OFFS} times, and then the frame
 * is emptied — so no served file can put this tab in a reload loop. A page
 * determined to leave has already leaked by the act of leaving (`seal.ts`'s
 * last paragraph), and no counting on this side can un-send that request.
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

import { mediaHref, type Reading, reported, sealedHello } from "@olai/surface"
import { createEffect, on, onCleanup, onMount } from "solid-js"
import { createSignal } from "solid-js"

import { TESTID } from "../testids.ts"

/**
 * How many times a page may walk the frame off the vault without identifying
 * itself, per document shown, before this component stops putting the file back
 * and empties the frame instead.
 *
 * A BUDGET, counted, with no clock in it — and the clock is what this is
 * deliberately not. The tempting rule is "restore unless it happens again
 * immediately, because a reader clicking a link is slower than a refresh": that
 * rule ping-pongs forever against `content="2;…"`, which is slower than the
 * threshold and just as automatic. A page that re-arms its own walk-off is
 * unbounded under any timing rule and bounded under this one.
 *
 * What it costs is the reader who follows several links OUT of a preview and
 * finds the frame empty on the fourth; they reopen the page, which is one
 * click, and the budget is fresh. Links INSIDE the vault cost nothing at all —
 * those documents identify themselves, so they are not walk-offs. What it buys
 * is that no served file can put this tab in a reload loop, refetching a
 * megabyte on every bounce.
 *
 * An EMPTY frame is the end state rather than the file, because the file is
 * what keeps leaving: `about:blank` is inert, has no address of ours in it, and
 * is visibly not the document — which is the honest way to say "this page will
 * not be shown without walking off".
 */
const WALK_OFFS = 3

/**
 * How long a document the frame arrived at by itself is given to say hello,
 * when it has not said it already.
 *
 * Usually zero: the seal's hello is posted by the first script in the document,
 * at parse time, so it is normally in hand BEFORE the `load` that asks this
 * question (`@olai/surface`'s `seal.ts` argues why it is sent from there rather
 * than being the height reading). This is the backstop for the turn of the
 * event loop where it is not — the message is already sent by then, so what
 * this waits out is delivery and not work.
 *
 * Short, because a page that never says it is a page the reader is waiting to
 * be taken back from, and every bounce of a page that keeps walking off costs
 * one of these.
 */
const SAYS_HELLO = 300

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

/**
 * The query this component points the frame with, and the reason there is one.
 *
 * A frame is navigated by ASSIGNING a `src`, and assigning the string that is
 * already there is not reliably a navigation — which is exactly what putting a
 * walked-off frame back, and what re-reading a file that changed on disk, both
 * ask for. A counter in the query makes every pointing a different URL, so the
 * navigation is a fact rather than a hope, and it takes any cache between here
 * and the disk out of the question along with it.
 *
 * The route cuts the query before it decodes anything (`@olai/surface`'s
 * `mediaTarget`), so this names no file and reaches no guard. It is not part of
 * how a relative address in the page resolves either: a query belongs to the
 * URL that carries it and is not inherited by what resolves against it.
 */
const VISIT = "olai-visit"

export function Hypertext(props: { readonly file: string; readonly text: string }) {
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
  // reflow at a new width is one. A page whose PICTURES have arrived is the
  // other: an `<img>` is a zero-tall box until its bytes land, so the reading
  // taken when the document parsed is short by however tall the pictures turn
  // out to be, and the frame's own `load` is when there is nothing left to wait
  // for (`seal.ts` tags that reading, and argues why the tag has to come from
  // in there rather than be guessed out here).
  //
  // TWO RUNGS, then, not an open ladder: at one width this accepts at most one
  // measurement and at most one settled reading. A page that draws itself with
  // its own script is the case the new rule adds, and it needs nothing new:
  // whatever it draws is drawn before its `load`, and the `ResizeObserver` in
  // the measure reports the box it drew.
  //
  // ONE RECORD, filed under the reading the frame named (`seal.ts`'s
  // `Reading`), rather than a variable per kind. Two variables would be two
  // things a new document has to remember to clear, and the rule that they
  // clear together would live in whoever remembered to write both lines; here
  // the whole record is replaced and the rule is the assignment.
  let acceptedAt: Partial<Record<Reading, number>> = {}
  // Loads this component asked for. Every document it points the frame at is
  // one; a `load` with none outstanding is the frame somewhere nobody sent it.
  let expected = 0
  let walkOffs = 0
  let visits = 0
  // A greeting in hand and not yet spent: the one thing every document this
  // server seals says first (`@olai/surface`'s `sealedHello`), which arrives
  // while its document is still parsing and therefore normally before the
  // `load` that asks about it. Each load SPENDS one, so it is an answer about
  // the document that just arrived and never about the one before it.
  let hailed = false
  // A navigation nobody asked for whose document has not greeted us yet, and
  // the timer that will put the file back if it never does. Held so the message
  // listener can call it off and so an unmount does not leave a timer holding a
  // dead element.
  let unclaimed: ReturnType<typeof setTimeout> | undefined

  /** Point the frame somewhere, and remember that its `load` is ours. The
   *  heights and the pending question belonged to the document that is
   *  leaving. */
  const point = (url: string) => {
    if (frame === undefined) return
    expected += 1
    fresh()
    // Nothing said by the document that is leaving carries over to the one
    // being asked for.
    hailed = false
    clearTimeout(unclaimed)
    unclaimed = undefined
    frame.src = url
  }

  /** The heights belonged to the document that is leaving. */
  const fresh = () => {
    acceptedAt = {}
    setMeasured(undefined)
  }

  /** The file itself, at its own address on the media route — a fresh URL every
   *  time, for {@link VISIT}'s reason. */
  const show = () => {
    visits += 1
    point(`${mediaHref(props.file)}?${VISIT}=${visits}`)
  }

  /** Put the file back, or — once the budget is out — nothing at all. */
  const bring = () => {
    unclaimed = undefined
    walkOffs += 1
    if (walkOffs > WALK_OFFS) point("about:blank")
    else show()
  }

  const loaded = () => {
    // Every load spends the greeting that came with it, whoever asked for the
    // document: an unspent one would answer for the NEXT load, which is exactly
    // the walk-off this is here to catch.
    const ours = hailed
    hailed = false
    if (expected > 0) {
      expected -= 1
      return
    }
    // Nobody asked for this document: the page walked the frame off, or the
    // reader followed a link out of it. Which of those it is, is a question
    // only the document can answer — everything this server seals greets its
    // embedder while it parses — and either way this is a new page, so the
    // heights of the old one go.
    fresh()
    // A file of this vault, reached by a link inside the preview. That is the
    // feature, not the walk-off: it is sealed exactly as the file that linked
    // to it is, so it stays, and it keeps its own height.
    if (ours) return
    clearTimeout(unclaimed)
    unclaimed = setTimeout(bring, SAYS_HELLO)
  }

  // The message arrives on the WINDOW — there is no per-frame channel — so the
  // sender is identified by IDENTITY rather than by origin: a sandboxed frame
  // with no `allow-same-origin` posts as `"null"`, which every other such frame
  // in every other tab would also post as. `event.source` is the one thing that
  // cannot be spelled by a stranger: it either IS this element's content window
  // or it is somebody else's message, and somebody else's message is dropped
  // before its shape is even looked at (`seal.ts` owns the shape).
  //
  // In `onMount`, which is the shape every window listener in this client has
  // (`../palette/Shortcuts.tsx`, `../edit/Editable.tsx`) and the one that makes
  // the ref below a fact rather than a hope: the element exists by then.
  onMount(() => {
    const listen = (event: MessageEvent) => {
      if (event.source !== frame?.contentWindow) return
      if (sealedHello(event.data)) {
        // Either it arrived while its document was parsing, in which case the
        // `load` about to be delivered will spend it — or it arrived after that
        // load, and what it answers is the question already waiting.
        if (unclaimed === undefined) hailed = true
        else {
          clearTimeout(unclaimed)
          unclaimed = undefined
        }
        return
      }
      const report = reported(event.data)
      if (report === undefined) return
      const width = frame.clientWidth
      if (acceptedAt[report.reading] === width) return
      acceptedAt[report.reading] = width
      setMeasured(`${report.height}px`)
    }
    window.addEventListener("message", listen)
    onCleanup(() => window.removeEventListener("message", listen))
  })

  onCleanup(() => clearTimeout(unclaimed))

  // DEFERRED, because the first document is pointed at by the `ref` below —
  // before the element is in the page, so it arrives with its address already
  // on it and costs exactly one load.
  //
  // What this is watching is the file's own TEXT, which this component
  // otherwise no longer reads: the bytes reach the frame over HTTP now, and
  // what the collection's copy is good for is knowing that the file on disk
  // MOVED. A new revision is a new document, so the walk-off budget starts over
  // — what it bounds is one page bouncing, not a file's whole history.
  createEffect(
    on(() => props.text, () => {
      walkOffs = 0
      show()
    }, { defer: true }),
  )

  return (
    <iframe
      // The element, and its first address, in one step: assigning `src` here
      // happens before insertion, so there is no `about:blank` load ahead of
      // the sealed one and the count starts honest.
      ref={(element) => {
        frame = element
        show()
      }}
      onLoad={loaded}
      // `allow-scripts` and NOTHING ELSE. What is absent is what matters:
      // without `allow-same-origin` the frame's origin is nobody's, so the
      // file's own scripts — which now run, and are the whole point — have no
      // cookies, no storage, no reach into this app's DOM. The pair
      // `allow-scripts allow-same-origin` is the combination that lets a framed
      // document take its own sandbox off, and it is the edit this attribute
      // exists to make obvious: ADDING A SECOND TOKEN HERE IS THE DIFFERENCE
      // between this component and a page that runs somebody's JavaScript in
      // this app's origin. The response says the same thing for a reader who
      // types the address instead (`seal.ts`'s `sandbox allow-scripts`), so the
      // guarantee does not depend on the frame being where the bytes are read.
      sandbox="allow-scripts"
      // What the frame fetches is this vault's own files off this same server
      // (the seal's sources), and nothing else is fetched at all. This is belt
      // to those braces: the request for the page does not carry which page of
      // the app a reader is on, and the response says the same about everything
      // the page goes on to ask for.
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
      // does not grow the number (`seal.ts` argues the choice). A page
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
