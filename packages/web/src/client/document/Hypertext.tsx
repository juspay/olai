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
 * else's server is the other, and nothing reports. Both halves are held by
 * `html_previews.feature`: the walk-off scenarios read the file coming BACK,
 * and a page sending the frame to its own neighbour reads it being LEFT there —
 * the same mechanism asserted saying no and saying yes, which is what stops a
 * change that answered navigations rather than clicks from passing. So an unasked-for load is
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

import { heard, mediaHref } from "@olai/surface"
import {
  createEffect,
  createMemo,
  createSignal,
  on,
  onCleanup,
  onMount,
  Show,
} from "solid-js"

import { SaidLine } from "../edit/SaidLine.tsx"
import type { Said } from "../edit/undoing.ts"
import { useOpens } from "../opens.tsx"
import { useGo, useLanding } from "../router.tsx"
import { fileNamed } from "../routes.ts"
import { TESTID } from "../testids.ts"
import { useHead } from "../served.tsx"
import { echo } from "./echo.ts"

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

/**
 * WHAT A DROPPED CLICK SAYS, and the whole of what it may say.
 *
 * A refusal in the two moods this client has (`../edit/SaidLine.tsx`), and it
 * is the alarm one, because that is what the tone MEANS here: it is the reason
 * nothing happened, and a reader who does not notice it believes a link is
 * broken rather than pointing somewhere this directory does not serve.
 *
 * IT DOES NOT QUOTE THE PATH, which is the one decision in it. The string that
 * missed came from a document running somebody else's JavaScript, and echoing
 * it would let that page put words of its own choosing into this app's chrome —
 * text, safely escaped, and still a sentence the app appears to be saying. The
 * whole discipline of this feature is that nothing a frame says reaches the
 * reader as the app's own words, and a message is not the place to make the
 * first exception. What the reader is owed is why the click did nothing, and
 * that is a fact about the DIRECTORY rather than about the string.
 *
 * A CONSTANT, because there is exactly one reason to draw it: the lookup
 * missed. Anything else the frame says is either answered or ignored.
 */
const REFUSED: Said = {
  tone: "alarm",
  text: "That link points at a file this directory does not serve, so there is no page to open.",
}

/** The `#…` the frame's own address wears, or nothing — encoded for the reason
 *  `../routes.ts` encodes the other end: an id in a saved page is whatever its
 *  author wrote, and it lands in a URL. */
const anchor = (at: string | undefined): string =>
  at === undefined || at === "" ? "" : `#${encodeURIComponent(at)}`

/**
 * WHAT THE FRAME WAS POINTED AT — the two facts about the document in there
 * that this component asks about afterwards, beside {@link Custody}, which is
 * the separate question of whose that document IS.
 *
 * `rev` is the revision the file was fetched at, and it is what separates "the
 * file moved on disk" from "the address changed" in the one effect that watches
 * both — the second is not a reason to fetch anything.
 *
 * `at` is the section the address carried, or nothing for a pointing that
 * carried none, and it is how the host window's half of a landing knows whose
 * number it is answering: only a document this component pointed at a fragment
 * can move this window. A page that walked off, a page brought home after one,
 * and the file re-fetched because its revision moved are all pointed with no
 * fragment, so a report from any of them is a number nobody asked for.
 */
interface Pointed {
  readonly rev: number | undefined
  readonly at: string | undefined
}

export function Hypertext(props: { readonly file: string }) {
  // WHICH REVISION THIS FILE IS AT, which is the whole of what this component
  // asks the wire for — the effect at the bottom is what spends it. A number,
  // off the one stream the tab's file list already arrives on
  // (`@olai/surface`'s `Head`), and never the body: the body is what the frame
  // below fetches for itself, over HTTP, which is the point of all this.
  //
  // A MEMO over it, because the head is one ENTRY of a collection and the
  // accessor under this reads a field of it: the entry speaks when anything
  // about the file moves, and what this frame acts on is the NUMBER. Compared
  // as a number, a head that spoke without moving says nothing here.
  const rev = createMemo(useHead(() => props.file))
  const [measured, setMeasured] = createSignal<string>()
  // What the last click could not be answered with, or nothing. It is CLEARED
  // by the next pointing rather than by a timer ({@link fresh}), which is the
  // rule `../edit/UndoSaid.tsx` states for the same kind of line: a refusal
  // that vanished on its own is one a reader can miss by looking away, and the
  // next thing this frame does is the honest moment for it to go.
  const [refused, setRefused] = createSignal<Said>()
  // Where the frame said its anchor ended up, measured from the frame's own
  // top (`seal.ts`'s `LANDED`), or nothing when no landing was asked for or the
  // page had no such id. A SIGNAL rather than a scroll done on arrival, for the
  // reason the effect below gives.
  const [landedAt, setLandedAt] = createSignal<number>()
  const go = useGo()
  /** Where inside this file this pane was asked to land, read the two ways
   *  this file needs it — the slug as a FACT, which is what the frame's URL is
   *  built from, and the ACT still owed, which is what may put a fragment on
   *  that URL. The router's own answer for the pane this frame is drawn in,
   *  memoized there so a navigation next door says nothing here
   *  (`../router.tsx`'s {@link Landfall}). */
  const landing = useLanding(() => props.file)
  const opens = useOpens()
  let frame: HTMLIFrameElement | undefined

  // Which height reports this frame acts on: every one that says something the
  // report before it did not, and none of the ones that are this frame's own
  // height coming back — which is what keeps a page sized in `vh` from climbing
  // a ladder of its own making while a page that grows after it has loaded is
  // still followed. The rule and the whole argument for it are `./echo.ts`,
  // held there rather than here because this client has no harness that mounts
  // this component and a rule that is arithmetic should be checkable by doing
  // the arithmetic.
  const heights = echo()
  let walkOffs = 0
  let visits = 0
  /**
   * WHAT IS IN THE FRAME ({@link Pointed}), or nothing at all before the first
   * pointing and for a document nobody asked for.
   *
   * A PLAIN VARIABLE and not a signal, because nothing reads it to draw with:
   * it is assigned in the same breath as the frame's `src`, before any document
   * in there could possibly report, and the effect that reads it is already
   * woken by the report itself.
   */
  let pointed: Pointed | undefined
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

  /** Point the frame somewhere, and remember that its `load` is ours — and
   *  WHAT is arriving ({@link Pointed}), or nothing for a pointing at something
   *  that is not this file at all. The heights and the pending question
   *  belonged to the document that is leaving. */
  const point = (url: string, arriving?: Pointed) => {
    if (frame === undefined) return
    fresh(arriving)
    stand({ at: "asked", spoke: false })
    frame.src = url
  }

  /**
   * OUT WITH THE DOCUMENT THAT IS LEAVING, and in with what this component
   * knows about the one arriving — which is a {@link Pointed} when we asked for
   * it, and NOTHING when what is in the frame is not this file: a page that
   * walked off, or the empty frame a page that would not stop leaving is
   * finally given.
   *
   * ONE ASSIGNMENT, for {@link stand}'s reason one function up. What goes is
   * the ladder of height reports the old document was climbing, the refusal it
   * drew, the report it made about its anchor, and the section it was pointed
   * at — and the last of those is what makes `pointed` a fact about the
   * document in the frame right now rather than about this pane's history.
   *
   * THE HEIGHT IS THE ONE THAT DEPENDS ON THE ARGUMENT, and that is the change
   * of mind. It used to go unconditionally, and that is the second half of the
   * same yank the spent landing above closes: a revision moves, the frame is
   * re-pointed to fetch the new bytes, and dropping the applied height put the
   * box back to the `70dvh` guess for as long as the round trip takes. The page
   * around it lost a thousand pixels, and whoever was reading the end of it was
   * clamped to the top by an edit they did not make — measured at 1076px to 0.
   *
   * A height is this FILE's rather than one fetch of it: one revision stale, it
   * is the best estimate of the next one there is, and the report that follows
   * replaces it a moment later. What it may not outlive is the file itself
   * being gone from the frame — which is exactly what an absent `arriving`
   * says, so no caller has to remember a second line.
   */
  const fresh = (arriving?: Pointed) => {
    heights.fresh()
    setRefused(undefined)
    setLandedAt(undefined)
    pointed = arriving
    if (arriving === undefined) setMeasured(undefined)
  }

  /** The file itself, at its own address on the media route — a fresh URL every
   *  time, for {@link VISIT}'s reason. */
  const show = () => {
    visits += 1
    // THE FRAGMENT RIDES ON THE FRAME'S OWN URL, which is the whole of what
    // landing on a section costs for this kind of file. A `.html` is a document
    // in there with whatever ids its author wrote, so the browser does the
    // scrolling — the same thing it would do if the reader had typed the
    // address. Nothing here looks for the id, and nothing has to: a fragment
    // naming nothing leaves the frame at the top of the page, which is a
    // browser's own answer and the right one.
    //
    // AFTER the query, because that is the order an address has — the visit
    // counter belongs to this URL and the fragment to the document it names.
    //
    // AND ONLY WHILE IT IS STILL OWED, which is the whole of this pane's half
    // of "a landing happens once". This frame is re-pointed for reasons that
    // have nothing to do with where the reader wants to be — the file MOVED ON
    // DISK, which is an agent's write, a `git pull` or another tab — and the
    // slug used to ride along on every one of them: the browser scrolled the
    // document in there to the section again, reported where it had ended up,
    // and this window followed. Somebody reading the end of a report was hauled
    // back to a heading they clicked minutes ago by an edit they did not make.
    //
    // What SPENDS it is the scroll and not this pointing, for the reason the
    // markdown face gives (`./faces.tsx`) and one of this frame's own: a
    // pointing is not an arrival. The bytes have to be fetched, the browser has
    // to find the id, and the anchor's position has to come back out — and a
    // landing spent by a frame that turned out to have no such id would be an
    // act nobody performed.
    const at = landing.owed()
    point(`${mediaHref(props.file)}?${VISIT}=${visits}${anchor(at)}`, { rev: rev(), at })
  }

  /**
   * OPEN A PAGE OF THIS VAULT, because a reader clicked a link to it inside the
   * preview — and the whole of what "because" is worth here.
   *
   * What arrives is a path from a document running somebody else's JavaScript,
   * so it is a LOOKUP KEY and nothing else: it is handed to the page model
   * (`../opens.tsx`, `../page.ts`'s `opensAt`), which answers with the route
   * that draws that file — the body page for a `.md` or a `.html`, the tree
   * page for an outline — or with nothing, and nothing moves nothing.
   *
   * THAT MEMBERSHIP IS THE WHOLE GUARANTEE — one question, asked by the module
   * that answers it for every other address in this app, and there is no second
   * one hiding behind it. In particular, navigating with the string the LIST
   * holds rather than with the one that arrived buys nothing: the two are `===`
   * equal strings, so there is no copy and nothing is laundered. Anything that
   * reads as a further guard here is ceremony, and ceremony makes the real test
   * harder to see.
   *
   * WHICH PAGE is deliberately not decided here either. This component knows
   * that a path either opens somewhere or does not; that a `.md` is read at
   * a body while an outline is a tree is the page model's, and a
   * preview frame is the last place that should hold a second copy of it.
   *
   * A MISS MOVES NOTHING, deliberately, and the tempting alternative is worth
   * naming because it looks kinder: navigating anyway would let this app's own
   * "no such document" screen say what happened. It would also put an arbitrary
   * string from a sandboxed frame into the URL bar, which is a capability, and
   * the sentence on screen would be about a file the reader never named.
   *
   * BUT IT SAYS SO. A click that does nothing and explains nothing is what
   * HACKING's error rule is about — the reader pressed a link, the page did not
   * move, and nothing on screen accounts for it — so the miss draws a refusal
   * in the voice every other refused act in this client speaks
   * ({@link REFUSED}). Moving nothing is still the answer; being silent about
   * it was never part of the argument.
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
   * AND A PAGE NAMING ITSELF IS REFUSED, which is the rule this channel needing
   * no gesture forced.
   *
   * `[here](./here.md)` in rendered markdown reaches `../router.tsx`'s
   * `followed` only when somebody presses it. This arrives whenever the page
   * decides to send it, because a `postMessage` is not a press and nothing on
   * this side can tell the two apart. Everywhere else that costs nothing: a
   * message naming ANOTHER file navigates once and takes this element with it,
   * so the sender is gone. A message naming THE FILE ALREADY SHOWN is the one
   * that does not — the route is the page that is open, so `DocumentPage` does
   * not re-key, this element is never replaced, and the sender is still sitting
   * there able to send again. Unrefused, that is history a page can spend with
   * no reader in it, and the tab's scroll with it: the same hazard class
   * {@link WALK_OFFS} exists for ("no served file can put this tab in a reload
   * loop"), on the channel that arrived after it.
   *
   * So the file being shown is not a file this can open. Asked through
   * `fileNamed` rather than by reading the route's arms, because which routes
   * name a file is `../routes.ts`'s answer and both of the ones this produces
   * do — an outline can never BE the file shown here, but the comparison should
   * not be the thing that knows it.
   *
   * SILENTLY, and that is the one place this parts company with a miss. A miss
   * is a click this app could not answer, so the reader is owed the reason
   * ({@link REFUSED}); a self-open names a page olai has and is DRAWING — the
   * reader is looking at it. An alarm saying the link cannot be opened, over
   * the very file it names, would be a refusal contradicted by the screen it is
   * drawn on. A reader who clicks a link to the page they are on is already
   * where it goes.
   */
  const open = (named: string, at?: string) => {
    const route = opens(named, at)
    if (route === undefined) return setRefused(REFUSED)
    if (fileNamed(route) === props.file) return
    go(route)
  }

  /** Put the file back, or — once the budget is out — nothing at all, which is
   *  a pointing with no {@link Pointed} to it: nothing of ours is in there, so
   *  the box goes back to the guess rather than standing at the size of a page
   *  that has left ({@link fresh}). */
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
    // reader followed a link out of it. Either way it is a new page and it is
    // not ours, which is what an argumentless {@link fresh} says — so what the
    // old one left goes, and its HEIGHT with it, this being the one case where
    // that must happen.
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
      if (said.kind === "open") return open(said.file, said.at)
      // WHERE THE ANCHOR ENDED UP, and the host window's half of landing on it.
      //
      // The frame scrolls ITSELF to the fragment on its own URL, which lands
      // the reader only when the page in there overflows the box it is drawn
      // in. Sized to its content, it usually does not — so the anchor sits some
      // way down a frame that is taller than the window, and the page around it
      // has to move for the reader to see it. That is this window's job and
      // nothing in the frame can do it.
      //
      // The frame is put at the top first (`scrollIntoView`, which obeys the
      // sticky header through the stylesheet's `scroll-padding-top` rather than
      // this file knowing how tall a header is), and then the page moves down
      // by what the frame reported. Composed that way round, the platform's own
      // rule about the header still applies and the offset is added on top of
      // it.
      //
      // ONLY WHILE A LANDING WAS ASKED FOR: an unasked-for number moves
      // nothing, so a page that has walked off cannot scroll this tab around by
      // posting one.
      if (said.kind === "landed") return setLandedAt(said.top)
      // THE FRAME'S OWN HEIGHT IS HALF THE QUESTION, so it is read here and
      // handed over: `clientHeight` is the box the page in there measured
      // itself inside, and how far the page stands above it is the whole of
      // what says whether this report is news (`./echo.ts`).
      if (!heights.takes(said.height, frame.clientHeight)) return
      setMeasured(`${said.height}px`)
    }
    window.addEventListener("message", listen)
    onCleanup(() => window.removeEventListener("message", listen))
  })

  /**
   * THE HOST WINDOW'S HALF OF LANDING ON A SECTION.
   *
   * The frame scrolls ITSELF to the fragment on its own URL, and that lands the
   * reader only when the page in there overflows the box it is drawn in. Sized
   * to its content, it usually does not — so the anchor sits some way down a
   * frame taller than the window, and the page AROUND it has to move. Nothing
   * inside an opaque origin can do that, which is why the frame reports where
   * the anchor ended up (`seal.ts`'s `LANDED`) and this does the scrolling.
   *
   * The frame goes to the top first, and then the page moves down by what was
   * reported. `scrollIntoView` for the first half rather than arithmetic,
   * because it obeys the stylesheet's `scroll-padding-top` — so the sticky
   * header is accounted for by the rule that already states it, and this file
   * never learns how tall a header is.
   *
   * IT WAITS FOR THE HEIGHT, and that is why this is an effect over two signals
   * rather than a scroll done when the message arrives. The report lands beside
   * the settled height, and until that height is applied the frame is still the
   * `70dvh` guess: a page too short to scroll that far clamps the scroll, and
   * then grows underneath the reader, leaving them a screen above the section.
   * Measured, not reasoned — the first draft did the scroll on arrival and put
   * the anchor 170px below the fold. Tracking `measured()` makes the last run
   * the one with the geometry the reader actually sees.
   *
   * ONLY WHILE A LANDING WAS ASKED FOR, and it takes both halves of that. The
   * ADDRESS must still name a section ({@link Landfall}'s `at`) — Back takes
   * the fragment off it, and a number arriving after that is about a place the
   * reader is no longer being sent to. And the DOCUMENT IN THE FRAME must be
   * one this pane pointed at that section ({@link pointed}) — so an unasked-for
   * number moves nothing, whether it comes from a page that walked off or from
   * the file re-fetched because its revision moved, which is pointed at its own
   * address with no fragment on it once the landing has been spent.
   *
   * SPENTNESS IS NOT ONE OF THE HALVES, deliberately: this effect re-runs as
   * the height settles so that the LAST run has the geometry the reader
   * actually sees, and a guard that went out the moment the first scroll
   * happened would leave them a screen short of the section.
   */
  createEffect(() => {
    const top = landedAt()
    // Tracked, not read: the frame's height is what makes the arithmetic below
    // land where the reader will be looking.
    measured()
    if (top === undefined || frame === undefined) return
    if (pointed?.at === undefined || landing.at() === undefined) return
    const box = frame
    const at = pointed.at
    const painted = requestAnimationFrame(() => {
      box.scrollIntoView({ block: "start" })
      if (top !== 0) scrollBy({ top, behavior: "instant" })
      // ARRIVED, which is what spends the landing (`../router.tsx`'s `landed`).
      // The reader has been taken to the section, so the next time this file
      // moves on disk the frame is re-pointed at its own address and nothing
      // more. Spending does not stop THIS effect re-running as the height
      // settles — it reads `pointed`, which is a fact about the document in the
      // frame — so the last run is still the one with the geometry the reader
      // actually sees.
      landing.landed(at)
    })
    onCleanup(() => cancelAnimationFrame(painted))
  })

  // A pending question outlives nothing: an unmounted component must not leave
  // a timer holding a dead element.
  onCleanup(() => {
    if (custody.at === "stray") clearTimeout(custody.until)
  })

  // WHAT IT WATCHES IS TWO NUMBERS AND A SLUG, and each is compared as
  // itself — which is the whole of why neither is read raw here. `on` has no
  // equality: it re-runs whenever anything its input READ notifies, so an input
  // over a signal that speaks without moving re-runs for nothing. Both of these
  // are such signals underneath — the head is one entry of a collection, and
  // `router.landing()` is one object broadcast to every pane on every push — so
  // each is memoized where it is answered ({@link rev} above, `../router.tsx`'s
  // `useLanding`), and what arrives here is a value. Un-memoized, pane B
  // opening a heading reloaded pane A's preview: a question whose answer was
  // `undefined` before and after.
  //
  // DEFERRED, because the first document is pointed at by the `ref` below —
  // before the element is in the page, so it arrives with its address already
  // on it and costs exactly one load.
  //
  // What this is watching is the REVISION, and it is the ONLY thing this page
  // asks the wire for: the bytes reach the frame over HTTP, and what a reader
  // needs from the socket is that the file on disk MOVED. The revision says
  // exactly that and says it in a number — a page rewritten with the bytes it
  // already had does not move it, and a megabyte string does not have to be
  // compared to find that out. A new revision is a new document, so the
  // walk-off budget starts over: what it bounds is one page bouncing, not a
  // file's whole history.
  //
  // WHAT ASKING COSTS, named rather than hidden: a path and an integer, off a
  // stream the sidebar's file list is already arriving on. Why that member
  // exists, and what it replaced, is written where it is declared
  // (`@olai/surface`'s `Head`).
  //
  // IT IS ALSO NOT BOUNDED, which is the part that belongs here because it is
  // a fact about THIS frame and nothing else: a head moves on every revision,
  // for every file, to every tab, and there is nothing to read and nothing to
  // age out. That is a property of the member this asks for, not of anything
  // the server counts — what a body costs, and who keeps one live, is the
  // BODY's story and is written where it happens (`@olai/server`'s
  // `bodies.ts`). This frame stopped being part of it when it stopped asking.
  // …and the SECTION is watched beside it, for the case the revision cannot
  // cover: the page is keyed by FILE (`./DocumentPage.tsx`), so arriving at
  // another place inside the file already open is the same element being asked
  // for a different landing. The frame is re-pointed, because where a document
  // is scrolled to is a fact about its URL and this is the only way to change
  // one from out here.
  //
  // THE SLUG AS A FACT is what is watched, and not the act still owed — which
  // is exactly why spending a landing is a MARK and not a clear
  // (`../router.tsx`'s `landed`). Watching the owed half would make the act's
  // own completion look like a new address and re-point the frame at the file
  // for nobody's reason: a white flash, a lost scroll and, for a page that
  // draws itself, its script run twice. What `show` does with the slug is the
  // half that changes once it has been spent.
  //
  // DEFERRED also covers the one transition a head has that a prop did not: the
  // revision ARRIVING. It is already here when this element mounts — the page
  // model refuses a path the heads do not hold, so the route this component is
  // under could not have resolved without one (`../page.ts`) — and if that ever
  // stopped being true the cost is one re-pointing at the file already shown,
  // which is what a walk-off already does and what the budget above bounds.
  createEffect(
    on(() => [rev(), landing.at()] as const, ([now, at]) => {
      // A LANDING GONE IS NOT A PLACE TO BE, so it is not a reason to fetch the
      // file again. The slug goes to nothing when this pane leaves the page and
      // when Back takes the fragment off the address, and neither is somewhere
      // to arrive at — while an iframe re-pointed after its first load is a
      // HISTORY ENTRY, so re-fetching to drop a `#` nobody is reading cost the
      // reader a second press of Back off every page they had landed on.
      //
      // The REVISION is the other half of the condition and not an oversight:
      // a file that moved on disk has to be fetched whatever the address says.
      // Compared against the document in the frame ({@link pointed}) rather
      // than against `on`'s own previous input, which is not there to compare
      // with — a deferred `on` skips its first run without recording it.
      if (at === undefined && pointed !== undefined && pointed.rev === now) return
      walkOffs = 0
      show()
    }, { defer: true }),
  )

  return (
    <>
      {/* WHAT A CLICK COULD NOT DO, above the frame it was clicked in.
          `RowEditor.tsx` draws a write's refusal under the row it was typed
          in; this is the same placement rule for a surface with no row — the
          reader's eyes are on the preview, so the line goes against its top
          edge, where the link they just pressed is. It is not pinned over the
          page like the undo's, because unlike an undo this refusal HAS
          somewhere to belong. */}
      <Show when={refused()}>
        {(said) => (
          <SaidLine
            said={said()}
            class="mb-2 text-[0.8125rem] leading-snug"
            testid={TESTID.hypertextSaid}
          />
        )}
      </Show>
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
    </>
  )
}
