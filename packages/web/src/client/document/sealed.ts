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
 *   3. WHAT MAY BE FETCHED: nothing. `default-src 'none'` is the strictest
 *      directive there is — no image, no font, no stylesheet, no frame, no
 *      `fetch`, no `<form>` action, nothing over the network at all. The one
 *      exception is `style-src 'unsafe-inline'`, and it is what makes the
 *      preview worth having: a saved page's whole appearance is its own
 *      `<style>` block and its `style=` attributes, and inline CSS inside an
 *      opaque origin with every fetching directive at `'none'` cannot reach
 *      anything — a `url()` in it is an image request, and image requests are
 *      refused.
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
 * is (1) and (3) — the two that decide the consequence. A script that somehow
 * ran here despite the policy would still be running in an origin that is
 * nobody's, with no network, unable to see or touch this app; that is the same
 * frame it was. The bar came down on "does foreign code execute", and it did
 * not come down at all on "can foreign code reach anything", which is what the
 * word isolation means here.
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
 * WHAT IT ALSO COSTS, unchanged from before: a `.html` that draws its pictures
 * from files beside it shows them as broken, because `img-src` is `'none'` and
 * a relative URL inside an opaque-origin frame has nothing to resolve against
 * anyway. The fix, when somebody wants it, is the one markdown already has —
 * rewrite each relative `src` to the `/media/…` route, which means parsing the
 * markup rather than handing it over whole. That is a different PR with a
 * different argument, and doing it badly is how a preview becomes a way of
 * serving files nobody meant to serve. Until then the promise is exact: what
 * you see is the file's own text and the file's own styling, and nothing else
 * was fetched.
 *
 * Pure, and its own module, so the rule can be READ and asserted without a
 * browser: `./sealed.test.ts` is what says the policy has not been widened by
 * somebody who needed one image to work, and what recomputes the hash so the
 * script and the directive that admits it cannot drift apart.
 */

/**
 * WHAT THE FRAME SAYS, and the whole of it: this prefix, then a number.
 *
 * The two ends of a `postMessage` have to agree on a shape, and the producer
 * here is text inside a script that no compiler reads. So the agreement is ONE
 * CONSTANT, and both ends are in this module — {@link MEASURE} builds the
 * message out of it and {@link reportedHeight} takes it apart. Spelling it
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
 */
const REPORT = "olai:page-height:"

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
 * reading for the page that sets `html { height: 100% }` and overflows it.
 *
 * Measured again on `load` (pictures are refused, but a font metric or a late
 * stylesheet can still move a line) and on every resize of the root box, which
 * is how a page reflowing into a narrower window gets a frame that follows it.
 * The observer is guarded rather than assumed: an exception thrown in here
 * would surface as a console error on a page whose whole point is that its
 * console is quiet apart from the refusal.
 *
 * Module-private, and the hash below is over these exact bytes — a space added
 * in here is a script the browser refuses. What guards that is `./sealed.test.ts`,
 * which does not read this constant: it digests the script out of {@link SEAL},
 * because the constant is not what a browser hashes, the markup is.
 */
const MEASURE = `(function () {
  var post = function () {
    var page = document.documentElement, body = document.body
    parent.postMessage(
      ${JSON.stringify(REPORT)} + Math.max(page.offsetHeight, body ? body.scrollHeight : 0),
      "*"
    )
  }
  addEventListener("load", post)
  addEventListener("DOMContentLoaded", function () {
    post()
    if (typeof ResizeObserver === "function") new ResizeObserver(post).observe(document.documentElement)
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
const MEASURE_SHA256 = "wLCFaN9yrbDA5UnaRV1OMYb8sxZxJtLPz90rPRRJVPQ="

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
 * The measure goes LAST of the four and still in front of every byte of the
 * file, so it is admitted by the policy above it and installed before the
 * file's own markup — including any `<script>` of its own, which the policy
 * refuses — has been parsed.
 *
 * {@link POLICY} is named apart from the markup that carries it because two
 * places read it and neither should re-spell it: `./sealed.test.ts` asserts the
 * whole set of directives, and the e2e step that reads the frame's `srcdoc` out
 * of a real browser (`packages/tests/step_definitions/html_steps.ts`) imports
 * it for the same reason the testids are imported — a policy widened here would
 * otherwise still read as sealed over there.
 */
export const POLICY =
  `default-src 'none'; style-src 'unsafe-inline'; script-src 'sha256-${MEASURE_SHA256}'`

export const SEAL = "<!doctype html>" +
  `<meta http-equiv="Content-Security-Policy" content="${POLICY}">` +
  `<meta name="color-scheme" content="light">` +
  `<script>${MEASURE}</script>`

/** The file's markup, sealed — VERBATIM after the prefix, because the point of
 *  showing a `.html` is showing what it says. Nothing is stripped, rewritten or
 *  re-encoded: what makes that safe is the frame it is drawn in and the policy
 *  above it, not an edit to somebody else's file. */
export const sealed = (markup: string): string => SEAL + markup

/**
 * The other end of {@link REPORT}: what a sealed frame said, as a height — or
 * nothing, which is the answer to every message that was not one of ours and
 * to every one of ours that made no sense.
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
 */
export const reportedHeight = (said: unknown): number | undefined => {
  if (typeof said !== "string" || !said.startsWith(REPORT)) return undefined
  const height = Number(said.slice(REPORT.length))
  return Number.isFinite(height) && height > 0 ? Math.ceil(height) : undefined
}
