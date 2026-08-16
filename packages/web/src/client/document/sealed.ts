/**
 * The SEAL a served `.html` is drawn behind — what makes showing somebody
 * else's markup safe to do at all.
 *
 * A `.md` is text this app renders: it goes through a parser, a sanitiser and a
 * rewrite (`../markdown/`), and what reaches the DOM is what those three
 * allowed. A `.html` is the opposite shape — it is already the thing a browser
 * runs, and there is no rendering step to be strict in. So the question is not
 * "what do we allow through", it is "what is this markup allowed to do once it
 * is on screen", and that has to be answered before the first byte of it is
 * drawn.
 *
 * THREE MECHANISMS answer it, and they are not three restatements of one rule —
 * they answer three different questions, and only the middle one is about
 * whether code runs:
 *
 *   1. WHOSE ORIGIN the frame is in: NOBODY'S. `sandbox` is present and
 *      `allow-same-origin` is absent, which is what makes the origin opaque —
 *      `document.cookie` is empty, `localStorage` THROWS, `window.parent` is
 *      cross-origin and every read of this app's DOM is a `SecurityError`. This
 *      is the mechanism that decides what a script COULD DO, and it is the one
 *      that must never be touched. That attribute lives on the element
 *      (`./Hypertext.tsx`), because it is a fact about the frame rather than
 *      about the markup.
 *   2. WHICH SCRIPTS RUN: exactly one, named by its hash. The policy below
 *      carries `script-src 'sha256-…'` over {@link MEASURE} and nothing else —
 *      no `'unsafe-inline'`, no `'self'`, no host. A `<script>` in somebody's
 *      saved page is refused by the browser unless it is byte-for-byte the
 *      script below, in which case it is not their script, it is ours. The file
 *      cannot get the hash to match by reading it, either: matching it means
 *      being it.
 *   3. WHAT MAY BE FETCHED: the pictures of this vault, and nothing else in the
 *      world. `default-src 'none'` is still the ground under everything — no
 *      font, no stylesheet, no frame, no `fetch`, no `<form>` action, nothing
 *      over the network at all — and it has exactly two exceptions, both of
 *      them named. `style-src 'unsafe-inline'` is the older one, and it is what
 *      makes the preview worth having: a saved page's whole appearance is its
 *      own `<style>` block and its `style=` attributes. {@link mediaOn} is
 *      the newer one, and it is a PATH rather than a scheme or a host —
 *      `img-src <this app's origin>/media/`, the route that already answers a
 *      markdown document's `![](shot.png)` and answers a picture under the
 *      served directory or a 404 (`@olai/surface`'s `mediaTarget` is the guard
 *      at that end, and `@olai/server`'s `media.ts` is the route). What that
 *      admits is no more than the bytes any `.md` in the same
 *      directory could already draw — a subset, in fact, since a `..` past the
 *      root is clamped for a document and refused here (`@olai/surface`'s
 *      `media.test.ts` holds both halves of that) — and this is the whole of
 *      the widening: no remote host, no `data:`, no `'self'` (which would be
 *      the app's own API surface, and is nothing here anyway — an opaque origin
 *      matches no `'self'`), and nothing outside the served directory, because
 *      the route at the other end of that path decodes, refuses `..` and demands a
 *      picture extension before it opens a file. TWO GUARDS, then, and they are
 *      independent: the policy decides what may be asked for, the route decides
 *      what may be answered, and neither is trusted to be the other. That is
 *      also the answer to the one weakness a path-restricted source has — a
 *      redirect drops the path and leaves only the origin — since what is at
 *      the end of this one is a static file engine over the served directory
 *      with no index and no fallback, which has nowhere to redirect anybody
 *      to.
 *
 * WHY A SCRIPT AT ALL, since the previous version of this file had none and
 * said so proudly. Because the frame's HEIGHT could not otherwise be an answer.
 * An iframe does not size to its content — nothing about a page's own layout
 * crosses the frame boundary — so the preview was given `70dvh` and left to
 * scroll inside it, which is a guess that is wrong twice: a three-line receipt
 * got two thirds of a screen of white, and a long article got a scrollbar
 * inside a scrollbar. The only thing that can measure a page is something
 * inside the page, and the only way out of an opaque origin is `postMessage`.
 * So {@link MEASURE} is the smallest program that does exactly that, it is
 * OURS rather than the file's, and the policy above pins it by hash so it
 * stays ours.
 *
 * WHAT THAT COST, said out loud rather than buried: the sandbox used to bar
 * execution too, so a `<script>` in a saved page was refused TWICE over, by two
 * independent mechanisms. It is refused once now, by (2). What did NOT change
 * is (1) — the mechanism that decides the consequence. A script that ran here
 * despite the policy would still be running in an origin that is nobody's,
 * unable to see or touch this app; that is the same frame it was.
 *
 * Note the shape of what (2) and (3) now share, because it is the honest cost:
 * they are ONE STRING. A future edit that mangles {@link policyOf} so the meta
 * does not bind takes down the script bar and the network bar together, and
 * origin isolation is what is left. That is a real reduction in independence,
 * and the mitigation is that the string is asserted twice — as a parsed
 * directive SET here (`./sealed.test.ts`) and as the exact text the browser was
 * handed (the e2e step calls {@link policyOf} rather than re-spelling it). Both
 * reviews of the PR that admitted the script landed on that sentence; it is
 * written here rather than softened. What the picture directive adds to it is
 * one more thing that string is load-bearing for, and one more reason the
 * mangled-policy case fails a test rather than a reader.
 *
 * AND THE POLICY ONLY COVERS THIS DOCUMENT. A `<meta>` CSP binds the document
 * it is in; the `sandbox` attribute binds the browsing CONTEXT and outlives
 * every navigation in it. So the sentence "a script that ran in here could
 * reach nothing" is true of a script running UNDER THIS POLICY, and a page that
 * walks the frame off `about:srcdoc` — a `refresh`, a link — is no longer under
 * it while `allow-scripts` still applies. That gap is closed on the element
 * rather than here, because it is a fact about the frame: `./Hypertext.tsx`
 * counts the documents it asked for and puts the seal back on one it did not.
 * grok's review of this PR is what found it.
 *
 * `allow-scripts` WITH `allow-same-origin` is the combination that must never
 * be written: a document with both can reach into its own frame element and
 * take the sandbox off. One of the two, and it is this one, is a frame that can
 * compute; the pair is a frame that can escape. `./Hypertext.tsx` spells the
 * attribute and `./sealed.test.ts` asserts the policy, so both halves fail
 * loudly rather than quietly widening.
 *
 * THE LINE THAT MOVED, named because a reader will find the old one. The
 * deferral that filed this work said the empty `sandbox` was not negotiable and
 * guessed at "a same-origin sizing trick" instead. That is exactly backwards,
 * and it is worth saying why: `allow-same-origin` would put somebody's saved
 * page IN THIS APP'S ORIGIN, where the only thing standing between it and the
 * reader's vault is that no code runs — one browser bug, one policy mistake,
 * and it is over. `allow-scripts` alone gives up nothing of the kind. Code runs
 * in a place where running is worth nothing. So the token that was ruled out is
 * the one that was taken, and the token that was contemplated is the one this
 * file forbids in the paragraph above.
 *
 * HOW A PICTURE COMES TO DRAW, which is what this file's previous version left
 * as a cost and named the wrong fix for. It said: rewrite each relative `src`
 * to `/media/…`, "which means parsing the markup rather than handing it over
 * whole", and warned in the same sentence that doing it badly is how a preview
 * becomes a way of serving files nobody meant to serve. The warning was right
 * and the fix was the dangerous half of it. A rewrite of somebody's markup
 * needs a tokeniser that agrees with the browser's about what an `<img>` even
 * IS — inside a comment, inside `<script>`, inside `<template>`, with an
 * unquoted attribute, spelled `<img/src=…>` — and every place the two disagree
 * is a place where what was checked is not what runs. This app owns no such
 * tokeniser and is not going to grow one for a preview.
 *
 * So the address is not rewritten. WHAT THE ADDRESS RESOLVES AGAINST is, and
 * that is one element the seal already had a place for: `<base href>`, pointing
 * at `/media/<this file's own directory>/` on this app's origin. Every relative
 * URL in the file then resolves under the media route — an
 * `<img src="art/shot.png">` in `notes/report.html` becomes
 * `/media/notes/art/shot.png`, which is the exact URL the markdown beside it
 * would have been rewritten to — and every address that is NOT vault-relative
 * resolves somewhere `img-src` refuses:
 * `https://tracker/pixel.png` is a host that is not this one, `data:…` is a
 * scheme that is not this one, and `../../../etc/passwd.png` is normalised by
 * the URL parser before any of it is fetched, which puts it outside `/media/`
 * and outside the policy. The file is still handed over BYTE FOR BYTE; nothing
 * is parsed, stripped or re-encoded; and the seal is still a prefix.
 *
 * It also covers what a rewrite would have had to chase one at a time. A
 * `srcset` with its comma-separated candidates and descriptors, a
 * `<picture><source>`, a `background: url(…)` in the page's own `<style>` — all
 * of them are relative URLs, so all of them resolve exactly where an `<img
 * src>` does, under the same directive. A rewriting pass would have had to
 * learn each of those grammars, and the CSS one is a parser of its own.
 *
 * That element is also why the file's own `<base>` cannot take this over: a
 * document's base is the FIRST `<base href>` in tree order, and the seal is in
 * front of every byte of the file. (`./sealed.test.ts` and the probe fixture
 * both assert it, because "ours is first" is a fact about the prefix that a
 * later edit could quietly lose.)
 *
 * What it costs is stated as plainly as the old cost was. A relative LINK in a
 * saved page now resolves under `/media/` too, so a click on one is a 404
 * rather than the address it meant — it was already not that address (a
 * `srcdoc` document had nothing to resolve against, and the click walked the
 * frame off, which is what the load count in `./Hypertext.tsx` exists to
 * catch), and a 404 is the more inert of the two wrong answers. And a page may
 * now name any picture in the vault, not only the ones beside it, exactly as
 * any `.md` in the same directory already can. It cannot say what it found:
 * there is no script, and the only fetch it has is a picture request to this
 * same server.
 *
 * Pure, and its own module, so the rule can be READ and asserted without a
 * browser: `./sealed.test.ts` is what says the policy has not been widened by
 * somebody who needed one image to work, and what recomputes the hash so the
 * script and the directive that admits it cannot drift apart.
 */

import { mediaBase, MEDIA_PREFIX } from "@olai/surface"

/**
 * WHAT THE FRAME SAYS, and the whole of it: one of these two prefixes, then a
 * number.
 *
 * The two ends of a `postMessage` have to agree on a shape, and the producer
 * here is text inside a script that no compiler reads. So the agreement is
 * THESE CONSTANTS, and both ends are in this module — {@link MEASURE} builds
 * the message out of them and {@link reported} takes it apart. Spelling one
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
 * `./Hypertext.tsx` accepts one of EACH per width, which is what keeps a page
 * sized in `vh` from climbing its own ladder (the argument is over there, where
 * the counting is). Two prefixes rather than a field, for the reason there is a
 * prefix at all: it is the smallest difference that survives the trip.
 *
 * A TABLE rather than two loose constants, because the two are one thing — the
 * kinds of reading there are — and the receiver does not want a boolean it has
 * to re-decide at every use. {@link Reading} is the key, {@link reported}
 * returns it, and `./Hypertext.tsx` files its accepted widths UNDER it: one
 * name, carried from the script that posts it to the record that remembers it,
 * with nothing projecting it into a flag and back on the way.
 */
const READING = {
  arriving: "olai:page-height:",
  settled: "olai:page-loaded:",
} as const

/** Which of the two a message is: taken while the page may still be arriving,
 *  or after its `load`, when there is nothing left to wait for. */
export type Reading = keyof typeof READING

/**
 * The one program allowed to run in there: a tape measure.
 *
 * It reports the page's own height to the embedder and does nothing else — no
 * DOM of its own, no state, no reply channel. `postMessage` is the only way out
 * of an opaque origin, and what goes through it is one number that the receiver
 * (`./Hypertext.tsx`) treats as a claim rather than a fact: it is bounded there
 * by CSS, so the worst a lying height could do is pick one of the two ends of a
 * range the reader would have got anyway.
 *
 * `documentElement.offsetHeight` rather than its `scrollHeight`, and that is
 * the whole trick: in standards mode (which the seal's doctype guarantees) the
 * root box is auto-height, so its `offsetHeight` is the CONTENT's height —
 * while `scrollHeight` is `max(content, viewport)` and would therefore report
 * the frame's current height back to the frame, pinning a short page at
 * whatever it was first given. `body.scrollHeight` is the max'd-in second
 * reading for the page that sets `html { height: 100% }` and overflows it —
 * unguarded, because every path into `post` runs at `DOMContentLoaded` or
 * later, and by then there is a body.
 *
 * TWO mechanisms do the measuring now, and they answer different questions. A
 * `ResizeObserver` on the root box is the first: it delivers a callback the
 * moment it starts observing, which is the first measurement, and again
 * whenever that box changes — which is how a page reflowing into a narrower
 * window gets a frame that follows it.
 *
 * `load` is the second, and it is what pictures made necessary. It used to be
 * unnecessary and this file said so at length: under the old policy nothing
 * could be fetched at all, so nothing could arrive between `DOMContentLoaded`
 * and `load` to move a line. An `<img src="art/shot.png">` is exactly such a
 * thing — a box with no height until its bytes arrive — so the page's real
 * height is not knowable until the pictures are in. That reading is TAGGED
 * differently ({@link READING}'s `settled`), because the receiver cannot tell
 * "the page grew because its pictures landed" from "the page grew because I
 * made the frame taller and it is measured in `vh`", and it may only act on
 * the first of those.
 *
 * It also does the job the old `load` handler did for a browser with no
 * `ResizeObserver` — one reading at `DOMContentLoaded`, one more when
 * everything has settled, which is the best a page can do without one. Guarded
 * rather than assumed, because an exception thrown in here would surface as a
 * console error on a page whose whole point is that its console is quiet apart
 * from the refusals.
 *
 * Module-private, and the hash below is over these exact bytes — a space added
 * in here is a script the browser refuses. What guards that is
 * `./sealed.test.ts`, which does not read this constant: it digests the script
 * out of a {@link sealed} with no file at all, because the constant is not what
 * a browser hashes, the markup is.
 */
const MEASURE = `(function () {
  var post = function (tag) {
    var page = document.documentElement
    parent.postMessage(
      tag + Math.max(page.offsetHeight, document.body.scrollHeight),
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
 * The SHA-256 of {@link MEASURE}, base64, as CSP spells a hash source.
 *
 * Written down rather than computed, because the seal has to be a plain string
 * a browser reads at parse time and the Web Crypto digest is a promise — a
 * policy that arrived one microtask after the markup is no policy. So the
 * constant is the source of truth for the browser, and `./sealed.test.ts`
 * digests the seal's own `<script>` and asserts the policy names exactly that.
 * A stale number here fails there, before a reader finds out by getting a
 * preview quietly back on its fallback height.
 */
const MEASURE_SHA256 = "woiCkKb0lFGJnVWaR6Vi4/Qsyk6TJMDz/bl1xCenCNc="

/**
 * WHERE A SEALED FRAME IS: the two facts about this app that reach a served
 * file, and the only two.
 *
 * `origin` is this app's own — where the pictures are, and the one thing a
 * `<meta>` policy cannot say for itself. There is no keyword for "the page that
 * embedded me": `'self'` inside an opaque origin matches nothing, so the origin
 * has to be SPELLED, which means it has to be handed in. It comes from
 * `location.origin` at the one call site (`./Hypertext.tsx`) and this module
 * stays pure and testable, which is the same trade every other decision here
 * makes.
 *
 * `file` is the served path of the `.html` being shown, and what it decides is
 * one thing: which directory a relative address in that file is relative TO.
 * Same rule as a markdown picture (`@olai/format`'s `pictureOf` resolves beside
 * the file the markdown was written in), reached by a different mechanism.
 */
export interface Framed {
  readonly origin: string
  readonly file: string
}

/**
 * The one place a sealed frame may fetch from, as a CSP source and as the base
 * of every relative address in the file — or NOTHING, for an origin this
 * refuses to spell.
 *
 * Fail-closed, and that is the whole reason this is a function with a test
 * rather than one interpolation. The origin is the only value from outside that
 * lands unescaped inside a policy string and inside an HTML attribute, and both
 * of those have exits: a `;` would open a directive of somebody's choosing, a
 * `"` would close the attribute and start a tag. It cannot happen — the caller
 * hands over `location.origin`, which a browser builds itself — and it is
 * checked anyway, because "cannot happen" is a claim about a call site that a
 * later edit can move. What a refused origin gets is not a mangled seal or a
 * throw: it is the seal exactly as it was before pictures drew at all, with no
 * `img-src` and no `<base>`, which is a preview that is missing something
 * rather than a page that is missing a guard.
 *
 * A scheme, a host or a bracketed IPv6 literal, an optional port, and NOTHING
 * ELSE — no path, no credentials, no query, so nothing that could carry a
 * separator either language cares about. That is exactly the shape of an
 * `origin`.
 *
 * AN ALLOWLIST RATHER THAN A PARSE, and the difference matters enough to write
 * down because the tempting edit is `new URL(origin).origin === origin`. A URL
 * parser is not this check: it is built to accept what browsers accept, and the
 * forbidden-host set it enforces does not include `;` — so `http://a;b` parses,
 * round-trips as its own origin, and would carry a directive of somebody's
 * choosing straight into the policy. What is wanted here is the small set of
 * shapes this app is served on, named, and nothing else.
 */
const ORIGIN = /^https?:\/\/(?:[a-z0-9.-]+|\[[0-9a-f:.]+\])(?::\d{1,5})?$/i

/**
 * A media URL on this app's own origin — the route itself for the policy's
 * source, the file's own directory for its base — or NOTHING, for an origin
 * this refuses to spell.
 *
 * ONE GATE, and that is why both callers come through here rather than each
 * testing the origin for itself: the `img-src` and the `<base>` are two halves
 * of one decision (a frame may draw this vault's pictures, or it may not), and
 * two spellings of the check are two chances for a later edit to move one and
 * leave the other. A seal with a base and no directive is a page asking for
 * pictures it may not have; a directive with no base is a permission nothing
 * uses.
 *
 * The PATH is `@olai/surface`'s in both cases ({@link MEDIA_PREFIX},
 * {@link mediaBase}), and what this module adds is the origin — the part that
 * package cannot know. A path-only base would resolve against the embedder's
 * document, and the seal would rather say where it means than inherit it.
 *
 * A file path with a `.` or a `..` in it cannot arrive here — these are the
 * paths a directory walk found — and if one did, the failure is closed rather
 * than open: the URL parser normalises the segment away, the base lands
 * somewhere that is not under `/media/`, and every relative address in the file
 * is then refused by `img-src`. A preview with no pictures, not a preview with
 * the wrong ones.
 */
const mediaOn = (origin: string, path: string): string | undefined =>
  ORIGIN.test(origin) ? origin + path : undefined

/**
 * What is put in front of the file's own markup.
 *
 * A doctype FIRST, so the frame is in standards mode: the file's own doctype
 * arrives a few characters later and is ignored as a stray token, and a frame
 * that fell into quirks mode would draw somebody's page wrong for a reason they
 * could never find. (It is also what makes the measurement above mean anything
 * — the auto-height root box is a standards-mode fact.)
 *
 * Then the policy, as a `<meta>`, because there is no HTTP response to put a
 * header on — `srcdoc` markup is a string this app hands the parser. A meta
 * policy binds when it is the first thing in the head, which is what prepending
 * guarantees, and it cannot be undone by anything the document says afterwards:
 * a second CSP only ever narrows.
 *
 * And a colour scheme, which is not security but is the same kind of decision —
 * a fact about the frame that the file did not ask for and cannot be sensibly
 * left to chance. The preview is LIGHT: an unstyled page is black on white in
 * every browser, and inheriting a dark app's scheme would leave that page's own
 * black text on the frame's own white ground, unreadable, with the file itself
 * blameless. A page that styles itself paints over this and is unaffected.
 *
 * Then the BASE, which is the addressing decision ({@link mediaOn}, at the
 * file's own directory) and belongs in front of the file for a second reason
 * beyond the parser's: a document's base is the first `<base href>` in tree
 * order, so a saved page carrying one
 * of its own — a real thing, since "save page as" writes them — finds ours
 * already there. It is omitted entirely for a refused origin, and then the file
 * has nothing to resolve against, which is where this preview started.
 *
 * The measure goes LAST and still in front of every byte of the file, so it is
 * admitted by the policy above it and installed before the file's own markup —
 * including any `<script>` of its own, which the policy refuses — has been
 * parsed.
 *
 * {@link policyOf} is named apart from the markup that carries it because two
 * places read it and neither should re-spell it: `./sealed.test.ts` asserts the
 * whole set of directives, and the e2e step that reads the frame's `srcdoc` out
 * of a real browser (`packages/tests/step_definitions/html_steps.ts`) calls it
 * for the same reason the testids are imported — a policy widened here would
 * otherwise still read as sealed over there.
 */
export const policyOf = (origin: string): string => {
  const pictures = mediaOn(origin, MEDIA_PREFIX)
  return `default-src 'none'; style-src 'unsafe-inline'; ` +
    `script-src 'sha256-${MEASURE_SHA256}'` +
    (pictures === undefined ? "" : `; img-src ${pictures}`)
}

/**
 * The file's markup, sealed — VERBATIM after the prefix, because the point of
 * showing a `.html` is showing what it says. Nothing is stripped, rewritten or
 * re-encoded, pictures included: what makes that safe is the frame it is drawn
 * in, the policy above it and the base beside that, not an edit to somebody
 * else's file.
 *
 * ONE builder, and the prefix has no name of its own. There used to be a
 * `sealOf` beside this that built the seal alone, and nothing in the app called
 * it: this function called it, and a test read it. Two exported names for one
 * string is one more thing to keep in step for nothing — the seal alone is
 * `sealed("", where)`, which is also what `./Hypertext.tsx` shows a page that
 * keeps walking off, and it says what it is at the call site.
 */
export const sealed = (markup: string, where: Framed): string => {
  const base = mediaOn(where.origin, mediaBase(where.file))
  return "<!doctype html>" +
    `<meta http-equiv="Content-Security-Policy" content="${policyOf(where.origin)}">` +
    `<meta name="color-scheme" content="light">` +
    (base === undefined ? "" : `<base href="${base}">`) +
    `<script>${MEASURE}</script>` +
    markup
}

/** What a sealed frame said: a height, and which reading it is. */
export interface Report {
  readonly height: number
  readonly reading: Reading
}

/**
 * The other end of {@link READING}: what a sealed frame said, as a report — or
 * nothing, which is the answer to every message that was not one of ours and to
 * every one of ours that made no sense.
 *
 * It lives HERE, beside the script whose output it reads, because the two are
 * one thing: a message format. Split across a module boundary it would be a
 * format nobody owns, kept in step by whoever remembers to change both sides.
 * Here it is also PURE and browser-free like everything else in this file, so
 * `./sealed.test.ts` can hand it the hostile inputs a real frame never sends.
 *
 * Everything is checked because the sender is an opaque origin and nothing it
 * says is privileged. `Number` of a prefix-stripped tail rejects the empty
 * string as `0` and anything wordy as `NaN`, both of which fall out through the
 * same gate as a negative or an infinity. Rounded UP, because a fractional
 * layout truncated down is the last line of a page clipped by half a pixel.
 *
 * WHICH READING it is, is decided ONCE and then carried as a name. The two
 * prefixes are separate strings and neither is the other's, so a message is one
 * kind, the other, or nothing — and `settled` is never a claim the sender got to
 * make by spelling a number oddly.
 */
export const reported = (said: unknown): Report | undefined => {
  if (typeof said !== "string") return undefined
  const reading: Reading | undefined = said.startsWith(READING.settled)
    ? "settled"
    : said.startsWith(READING.arriving)
    ? "arriving"
    : undefined
  if (reading === undefined) return undefined
  const height = Number(said.slice(READING[reading].length))
  return Number.isFinite(height) && height > 0
    ? { height: Math.ceil(height), reading }
    : undefined
}
