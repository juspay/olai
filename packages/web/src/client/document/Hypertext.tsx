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
 * there are two kinds of those. A page of this vault arrived at from inside the
 * frame is one — a script assigning `location`, a `refresh` naming a neighbour,
 * a link carrying a fragment — and it is a FEATURE: it is answered by this same
 * route, so the seal is over it and its tape measure reports. A jump to somebody
 * else's server is the other, and nothing reports. So an unasked-for load is
 * given {@link SAYS_HELLO} to identify itself, and the file goes back if it does
 * not.
 *
 * A LINK THE READER CLICKS AT A PAGE OF THIS VAULT IS NEITHER, and that is the
 * decision this component gained last. It is not a walk-off, and it is no longer
 * a navigation at all: the seal's own handler claims that click before the frame
 * moves and posts the address out here instead (`seal.ts`'s `FOLLOW` and
 * `OPEN`), and {@link Hypertext}'s `open` navigates THE APP to that file's page.
 * The reader lands where clicking it in the sidebar lands — same address, same
 * heading, same entry lit in the column — because it is the same route, and this
 * element is unmounted along with the page that held it. What the frame said is
 * a lookup key in this app's own file list and never anything more; the argument
 * for why that is the only safe reading of it is where the message is defined,
 * and the enforcement of it is `open` below.
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

import { heard, mediaHref, type Reading } from "@olai/surface"
import { createEffect, createSignal, on, onCleanup, onMount } from "solid-js"

import { useRouter } from "../router.tsx"
import { TESTID } from "../testids.ts"
import { useDocumentPaths } from "./documents.tsx"

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
 * WHOSE DOCUMENT IS IN THE FRAME, as ONE value with four states.
 *
 * Three facts drive everything below — is a navigation this component caused
 * still in flight, has the document in the frame said {@link sealedHello}, and
 * is a question outstanding about a document that arrived on its own — and they
 * were three loose variables (a counter, a boolean and a timer handle) whose
 * joint validity was kept by the ORDER of the arms that read them. Every one of
 * them is about the same thing, so every one of them had to be cleared together
 * at four call sites, and two of their illegal combinations were reachable:
 *
 *   - a counter that could exceed one. Two pointings with no load between them
 *     is ONE navigation (the second aborts the first), so the second load never
 *     comes and the count never returns to zero — after which every walk-off
 *     reads as a document this component asked for, and the guard is deaf;
 *   - a greeting with nothing to belong to. A hello delivered AFTER its own
 *     document's load — the case {@link SAYS_HELLO} exists for — was recorded as
 *     a greeting for the NEXT load, which the next walk-off then spent to look
 *     like a page of this vault.
 *
 * As states they cannot be spelled. There is at most one navigation in flight
 * because assigning `src` aborts the last one, so `asked` is a state and not a
 * number; and a greeting is attributed to a DOCUMENT — `spoke` says whether the
 * one in the frame has already said its piece, so the next hello is known to be
 * the next document's rather than guessed to be.
 *
 * The whole rule, which is the transition table and nothing else:
 *
 * | state              | a load arrives                    | a hello arrives      |
 * |--------------------|-----------------------------------|----------------------|
 * | `asked`            | ours → `showing`                  | this document's      |
 * | `showing` (¬spoke) | nobody asked → `stray`            | this document's      |
 * | `showing` (spoke)  | nobody asked → `stray`            | the NEXT document's  |
 * | `greeted`          | a sealed page of this vault, kept | ignored (one each)   |
 * | `stray`            | it walked off again → `stray`     | answers the question |
 */
type Custody =
  /** A navigation this component caused is in flight; the next load is ours. */
  | { readonly at: "asked"; readonly spoke: boolean }
  /** The document in the frame is the one that was asked for. */
  | { readonly at: "showing"; readonly spoke: boolean }
  /** A document nobody asked for has greeted, and its load has not arrived yet:
   *  a file of this vault, reached by a link inside the preview. */
  | { readonly at: "greeted" }
  /** A document nobody asked for has loaded without greeting. The timer is what
   *  puts the file back if it never does. */
  | { readonly at: "stray"; readonly until: ReturnType<typeof setTimeout> }

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

export function Hypertext(props: { readonly file: string; readonly rev: number }) {
  const [measured, setMeasured] = createSignal<string>()
  const router = useRouter()
  const held = useDocumentPaths()
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
  let walkOffs = 0
  let visits = 0
  // Whose document is in the frame ({@link Custody}, where the whole rule is a
  // table). Before the first pointing there is nothing in there and nothing has
  // been asked for, which is the same answer this gives to every question:
  // a load now would be one nobody asked for.
  let custody: Custody = { at: "showing", spoke: true }

  /** Move to the next state, letting go of the old one's timer. ONE assignment,
   *  so "the question is off when we leave the state that asked it" is
   *  mechanical rather than four remembered lines. */
  const stand = (next: Custody) => {
    if (custody.at === "stray") clearTimeout(custody.until)
    custody = next
  }

  /** Point the frame somewhere, and remember that its `load` is ours. The
   *  heights and the pending question belonged to the document that is
   *  leaving. */
  const point = (url: string) => {
    if (frame === undefined) return
    fresh()
    stand({ at: "asked", spoke: false })
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

  /**
   * OPEN A PAGE OF THIS VAULT, because a reader clicked a link to it inside the
   * preview — and the whole of what "because" is worth here.
   *
   * What arrives is a path from a document running somebody else's JavaScript,
   * so it is a LOOKUP KEY and nothing else: it is looked up in the paths this
   * app is serving ({@link useDocumentPaths} — the same list `../page.ts` asks
   * the same question of before it will draw a `/doc/` address), and a path
   * that is not in there names no page and moves nothing.
   *
   * THAT MEMBERSHIP IS THE WHOLE GUARANTEE — one question, asked the way the
   * page model asks it, and there is no second one hiding behind it. In
   * particular, navigating with the string the LIST holds rather than with the
   * one that arrived buys nothing: the two are `===` equal strings, so there is
   * no copy and nothing is laundered. Anything that reads as a further guard
   * here is ceremony, and ceremony makes the real test harder to see.
   *
   * A MISS MOVES NOTHING, deliberately, and the tempting alternative is worth
   * naming because it looks kinder: navigating anyway would let this app's own
   * "no such document" screen say what happened. It would also put an arbitrary
   * string from a sandboxed frame into the URL bar, which is a capability, and
   * the sentence on screen would be about a file the reader never named.
   *
   * WHAT A MISS COSTS, because a dead click is not free. The two ends of this
   * disagree about what the vault holds, in one direction. The seal claims a
   * click by SUFFIX under `/media/` — the ROUTE's world, whose guard is lexical
   * and will serve any `.html` it can find on disk. This list is the STORE's
   * world, and the store's walk prunes dot-directories and `node_modules`
   * (`@olai/store`'s `disk.ts`). So a `.html` under a pruned directory is
   * servable and unlistable at once: the click is claimed and then dropped,
   * where before this change the frame would have drawn it. Nothing became
   * unreachable that was reachable — `../page.ts` refuses those paths too, so
   * olai has no page for such a file either — but the FRAME's rendering of it
   * is gone, and it goes silently. `html_previews.feature` holds that case, so
   * it is a known cost rather than something for a reader to discover.
   *
   * AND IT NEEDS NO GESTURE, which is the one place this channel is more than
   * the link it is modelled on. `[here](./here.md)` in rendered markdown
   * reaches `../router.tsx`'s `followed` only when somebody presses it; this
   * arrives whenever the page decides to send it, because a `postMessage` is
   * not a press and nothing on this side can tell them apart. A page naming
   * ITSELF is where that shows: the app re-navigates to the page already open,
   * which does not re-key `DocumentPage`, so this element is never replaced and
   * the sender is still there to send again — history a page can spend with no
   * reader in it. Named here rather than left to be found; the PR's report
   * carries it as owed work.
   */
  const open = (named: string) => {
    if (!held().includes(named)) return
    router.go({ kind: "document", file: named })
  }

  /** Put the file back, or — once the budget is out — nothing at all. */
  const bring = () => {
    walkOffs += 1
    if (walkOffs > WALK_OFFS) point("about:blank")
    else show()
  }

  const loaded = () => {
    // The document this component asked for. Whether its hello has landed yet
    // is carried across, so a greeting still in flight is not mistaken later
    // for the NEXT document's.
    if (custody.at === "asked") return stand({ at: "showing", spoke: custody.spoke })
    // Nobody asked for this document: the page walked the frame off, or the
    // reader followed a link out of it. Either way it is a new page, so the
    // heights of the old one go.
    fresh()
    // A file of this vault, reached by a link inside the preview — it greeted
    // while it parsed. That is the feature, not the walk-off: it is sealed
    // exactly as the file that linked to it is, so it stays and it keeps its
    // own height.
    if (custody.at === "greeted") return stand({ at: "showing", spoke: true })
    // Nothing said it was one of ours. It has {@link SAYS_HELLO} to say so
    // before the file goes back.
    stand({ at: "stray", until: setTimeout(bring, SAYS_HELLO) })
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
      // WHAT WAS SAID, decided once and carried as a name (`seal.ts`'s `Said`).
      // Three arms rather than three parsers tried in an order this file would
      // have to be trusted to remember — the same move `Custody` above makes,
      // for the same reason.
      const said = heard(event.data)
      if (said === undefined) return
      if (said.kind === "hello") {
        // WHOSE greeting this is, decided by what the frame is holding rather
        // than by when it arrived (`Custody`'s table). A document says this
        // once, while it parses, so: the one in the frame has now spoken — or,
        // if it already had, this is the NEXT document arriving on its own, and
        // its load is what will find that out.
        if (custody.at === "stray") stand({ at: "showing", spoke: true })
        else if (custody.at === "greeted") return
        else if (custody.spoke) stand({ at: "greeted" })
        else stand({ ...custody, spoke: true })
        return
      }
      // A PAGE OF THIS VAULT, asked for from inside the frame. The frame has
      // already declined to navigate itself (`seal.ts`'s `FOLLOW`), so nothing
      // loaded and nothing walked off, and custody is deliberately untouched:
      // there is no navigation of the FRAME's to record. What happens after is
      // the app's — usually this element unmounting with the page that held it,
      // and, for a page that named itself, no unmount at all (see `open`).
      if (said.kind === "open") return open(said.file)
      const width = frame.clientWidth
      if (acceptedAt[said.reading] === width) return
      acceptedAt[said.reading] = width
      setMeasured(`${said.height}px`)
    }
    window.addEventListener("message", listen)
    onCleanup(() => window.removeEventListener("message", listen))
  })

  // A pending question outlives nothing: an unmounted component must not leave
  // a timer holding a dead element.
  onCleanup(() => {
    if (custody.at === "stray") clearTimeout(custody.until)
  })

  // DEFERRED, because the first document is pointed at by the `ref` below —
  // before the element is in the page, so it arrives with its address already
  // on it and costs exactly one load.
  //
  // What this is watching is the REVISION, and this component reads nothing
  // else of the entry: the bytes reach the frame over HTTP now, and what the
  // collection's copy of them is good for is knowing that the file on disk
  // MOVED. The revision says exactly that and says it in a number — a page that
  // is rewritten with the bytes it already had does not move it, and a
  // megabyte string does not have to be compared to find that out. A new
  // revision is a new document, so the walk-off budget starts over: what it
  // bounds is one page bouncing, not a file's whole history.
  //
  // WHAT ASKING COSTS, named rather than hidden, and it went up when the set
  // stopped keeping a `.html`'s bytes (#204): the body is read from disk when a
  // reader opens the file, and this page is that reader. So a preview causes one
  // whole-file read that nobody draws — the frame fetches the same file over
  // HTTP — and the page waits for that read before the element exists at all.
  // What it buys is this effect: the server re-reads a watched file when it
  // moves, which is the only way this component learns the file changed.
  //
  // Closing it is a change to the WIRE, not to this component: the collection
  // would have to be able to say "this path is at revision N" without carrying
  // the body, which is the head member `../document/documents.tsx` argues
  // should be measured rather than guessed at. It is this PR's standing
  // deferral.
  createEffect(
    on(() => props.rev, () => {
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
