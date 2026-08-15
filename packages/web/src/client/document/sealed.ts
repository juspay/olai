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
 * TWO INDEPENDENT MECHANISMS answer it, and the doubling is deliberate — each
 * one alone is enough, and a mistake in either is not a compromise:
 *
 *   1. The frame is `sandbox=""` — the empty value, which is EVERY restriction
 *      on: no scripts, and (because `allow-same-origin` is absent) an OPAQUE
 *      origin. So a `<script>` in the file does not run; and even in a browser
 *      where one somehow did, it would be running in an origin that is nobody's
 *      — `document.cookie` is empty, `localStorage` THROWS, `window.parent` is
 *      cross-origin and every read of this app's DOM is a `SecurityError`. That
 *      attribute lives on the element (`./Hypertext.tsx`), because it is a fact
 *      about the frame rather than about the markup.
 *   2. The markup is prefixed with the {@link SEAL} below — a Content-Security
 *      Policy of `default-src 'none'`, which is the strictest one there is: no
 *      script, no image, no font, no stylesheet, no frame, no `fetch`, no
 *      `<form>` action, nothing over the network at all. The one exception is
 *      `style-src 'unsafe-inline'`, and it is what makes the preview worth
 *      having: a saved page's whole appearance is its own `<style>` block and
 *      its `style=` attributes, and inline CSS inside a script-less opaque
 *      origin with every fetching directive at `'none'` cannot reach anything
 *      — a `url()` in it is an image request, and image requests are refused.
 *
 * WHY BOTH. The sandbox is the stronger guarantee and the CSP is the wider one:
 * scripts are what could touch this app, but a plain `<img src="https://…">` in
 * a saved page needs no script at all to tell a third party that someone is
 * reading it — and that is the exact rule this repo already holds markdown to
 * (`@olai/format`'s `pictureOf` refuses remote images, and the highlighter is
 * vendored rather than fetched, tested as "the page requested nothing off this
 * server"). A preview that phoned home would be the one place in olai where
 * reading a file in your own directory is observable from outside it.
 *
 * WHAT IT COSTS, said out loud: a `.html` that draws its pictures from files
 * beside it shows them as broken, because `img-src` is `'none'` and a relative
 * URL inside an opaque-origin frame has nothing to resolve against anyway. The
 * fix, when somebody wants it, is the one markdown already has — rewrite each
 * relative `src` to the `/media/…` route, which means parsing the markup rather
 * than handing it over whole. That is a different PR with a different argument,
 * and doing it badly is how a preview becomes a way of serving files nobody
 * meant to serve. Until then the promise is exact: what you see is the file's
 * own text and the file's own styling, and nothing else was fetched.
 *
 * Pure, and its own module, so the rule can be READ and asserted without a
 * browser: `./sealed.test.ts` is what says the policy has not been widened by
 * somebody who needed one image to work.
 */

/**
 * What is put in front of the file's own markup.
 *
 * A doctype FIRST, so the frame is in standards mode: the file's own doctype
 * arrives a few characters later and is ignored as a stray token, and a frame
 * that fell into quirks mode would draw somebody's page wrong for a reason they
 * could never find.
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
 */
export const SEAL = "<!doctype html>" +
  `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">` +
  `<meta name="color-scheme" content="light">`

/** The file's markup, sealed — VERBATIM after the prefix, because the point of
 *  showing a `.html` is showing what it says. Nothing is stripped, rewritten or
 *  re-encoded: what makes that safe is the frame it is drawn in and the policy
 *  above it, not an edit to somebody else's file. */
export const sealed = (markup: string): string => SEAL + markup
