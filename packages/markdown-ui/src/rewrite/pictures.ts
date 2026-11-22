/**
 * A PICTURE IS A FILE IN THE SERVED DIRECTORY.
 *
 * `![](shot.png)` names a file beside the text that wrote it, and the browser
 * can only fetch a URL, so the relative path becomes `/media/…`. Anything that
 * is not a relative picture is not drawn AT ALL — no remote host (a page that
 * fetched one would tell a third party what someone is reading), no `data:`,
 * no absolute path. `@olai/format` decides what resolves and `@olai/surface`
 * spells the URL; this SAYS SO where the picture would have been when the
 * answer is nothing, rather than deleting the element, which is how a typo'd
 * filename used to render as a page with a hole in it.
 *
 * A wikilink's picture embed (`![[handle.png]]`) meets the same allowlist and
 * draws the same box when it finds nothing — through `../wikilinks.ts`, which
 * takes {@link UNDRAWN} and the per-block count from here.
 */
import { type Claims, pictureOf } from "@olai/format"
import { TESTID } from "@olai/markdown-ui/testids.ts"
import { mediaHref } from "@olai/surface"
import type { Element } from "hast"

/** What an undrawn picture looks like: a quiet inline box, in the same family
 *  as the app's other readouts. */
export const UNDRAWN = "inline-block rounded border border-rule px-1.5 py-0.5 " +
  "font-mono text-xs text-muted"

/** How many pictures this rendered block has drawn so far — the walk's own
 *  count, carried through it, because only the FIRST picture of a block is
 *  fetched eagerly (see below). */
export interface Pictures { drawn: number }

/**
 * Point an `<img>` at the media route — or, when nothing here resolves, say so
 * IN PLACE OF THE PICTURE.
 *
 * It used to be deleted, subtree and all, and that is the bug: `![](shot.pngg)`
 * and `![](sh0t.png)` are the ordinary way of getting a picture wrong, and what
 * they produced was a page with nothing on it where the picture was meant to
 * be. Nobody can debug a blank — not the person who wrote the typo, and not the
 * agent asked why its picture is missing.
 *
 * The allowlist is unchanged and deliberately so: what is drawn is still only a
 * relative picture under the served root ({@link pictureOf} owns that rule, and
 * `.svg`, `data:` and remote hosts are still refused). What changes is that a
 * refusal is now VISIBLE and names what it refused, which costs the reader
 * nothing and tells them everything. The name is the `src` the markdown wrote,
 * because that is the string a reader has to go and fix — never the resolved
 * path, which is ours.
 *
 * The element is REWRITTEN rather than replaced so the walk stays one pass over
 * one array: an `<img>` is void, so there is no subtree to carry.
 */
export const resolvePicture = (
  element: Element,
  claims: Claims | undefined,
  from: string,
  pictures: Pictures,
): void => {
  const written = element.properties?.["src"]
  const src = typeof written === "string" ? written : ""
  const picture = src === "" || claims === undefined ? null : pictureOf(claims, from, src)
  if (picture !== null) {
    // Which ones wait, and the one that may not: {@link waits}.
    element.properties = { ...element.properties,
      src: mediaHref(picture), loading: waits(pictures) ? "lazy" : "eager", decoding: "async" }
    return
  }

  element.tagName = "span"
  element.properties = {
    className: [UNDRAWN],
    "data-testid": TESTID.undrawnPicture,
    // Only when there IS one. An `![](…)` with nothing in it has no name to
    // carry, and an attribute holding the words "no file named" would be prose
    // in a slot every reader of the DOM takes for a src.
    ...(src === "" ? {} : { "data-src": src }),
  }
  element.children = [{
    type: "text",
    // No `src` at all is TWO things and this pass cannot tell them apart: an
    // `![]()` with nothing in it, and an address the SANITISER already took
    // away before this walk ran (a `data:` URI is the one that reaches here
    // that way — the allowlist is the security boundary and runs first, which
    // is the right order and not something to work around). So the sentence
    // covers both rather than guessing at one.
    value: src === ""
      ? "this picture could not be drawn: its address was empty, or not one this page may fetch"
      : `this picture could not be drawn: ${src}`,
  }]
}

/**
 * WHICH PICTURES WAIT, and the one that may not — counted here, so a `![](…)`
 * and a `![[…]]` embed share one count and one rule.
 *
 * A document is prose with pictures in it, and the pictures are the heaviest
 * thing on the page: a screenshot somebody saved at four thousand pixels wide
 * is megabytes, and a page of them is a reader spending their first second on
 * bytes for a figure they have not scrolled to. So every picture after the
 * first defers its own fetch until the reader comes near it. That is the
 * browser's answer rather than ours — one attribute, no observer, no scroll
 * handler, nothing to get wrong.
 *
 * THE FIRST ONE DOES NOT WAIT, and that exception is the whole decision.
 * Deferring the picture a page is largest-contentful-painted by is the one
 * mistake the priority guidance names outright: it takes an image the browser
 * would have fetched alongside the stylesheet and moves it behind layout. This
 * pass cannot see the fold — it is a string becoming a tree, with no viewport,
 * no fonts and no idea how much prose sits above any of it — but it can see
 * ORDER, and the only picture that can be the largest paint is the one no other
 * picture precedes. So the first is left eager and the browser's own
 * heuristics, which DO know where the fold is, get to decide what it costs.
 * SAID rather than omitted, because a default and a decision look identical in
 * the DOM and only one of them survives somebody editing this line.
 *
 * NO `fetchpriority`. `high` is for an image measured as the LCP, and a figure
 * halfway down `plan.md` is not that; `low` on the deferred ones would be this
 * file asking for them to arrive LATE once the reader is looking at them, which
 * is the opposite of what lazy is for.
 *
 * PER RENDERED BLOCK rather than per page, because a block is what this pass is
 * handed: a note under a row, an agent's reply and a document body are each
 * their own run (the id namespace is the same fact read another way), and each
 * is one thing a reader looks at at once.
 *
 * `decoding="async"` goes on all of them, here and on an embed: decoding is
 * main-thread work, and a four-thousand-pixel screenshot decoded synchronously
 * stalls the frame the prose around it would have painted in.
 */
export const waits = (pictures: Pictures): boolean => pictures.drawn++ !== 0
