/**
 * The two jobs one walk does, held apart.
 *
 * `./tags.ts` walks a rendered title and does two things to the text it finds:
 * it turns `#tags` into pills, and — where the page is filtered — it wraps the
 * query's words in marks. For most of a title those two travel together, and
 * they used to travel together everywhere: `code` and `a` were named as
 * subtrees the walk did not enter, and BOTH stopped at that door.
 *
 * Only one of them was ever argued for. A `#` inside a URL fragment is not a
 * tag and a `#` inside code is code — that is a rule about tags. The highlight
 * inherited it by accident, and the result was a row the filter had selected
 * on the strength of a word in its `code` span, drawn with nothing lit: the
 * one page that cannot say why it is in front of you (grok, #240).
 *
 * So this file makes the two claims separately, and on the same titles: the
 * words light everywhere, the pills do not. ./plain.test.ts is next door and
 * is about something else — the fast path, which refuses every title here.
 */

import { expect, test } from "bun:test"

import { installPipeline } from "./chunk.ts"
import * as pipeline from "./pipeline.ts"
import { plainTitle } from "./plain.ts"
import { TAG_CLASS } from "./tags.ts"
import { renderTitle } from "./title.ts"

installPipeline(pipeline)

const NOTE = "house.olai"

/** A title as a filtered page draws it — the pipeline, since every title here
 *  holds a backtick or a bracket and the fast path refuses those. */
const lit = (title: string, ...needles: string[]): string =>
  renderTitle(title, NOTE, { needles })

const CODE = "run `just check` before pushing"
const LINK = "see the [cabinet spec](https://example.com/spec#home) first"

test("the fast path never answers these, so the pipeline is what is under test", () => {
  for (const title of [CODE, LINK]) expect(plainTitle(title), title).toBeNull()
})

// ── the half that was missing ──────────────────────────────────────────

test("a needle inside a code span is lit where it sits", () => {
  expect(lit(CODE, "check")).toBe(
    `run <code>just <mark class="olai-hit" data-testid="hit">check</mark></code>` +
      ` before pushing`,
  )
})

test("a needle inside a link's text is lit where it sits", () => {
  expect(lit(LINK, "spec")).toBe(
    `see the <a href="https://example.com/spec#home" target="_blank" ` +
      `rel="noopener noreferrer">cabinet ` +
      `<mark class="olai-hit" data-testid="hit">spec</mark></a> first`,
  )
})

test("the link keeps its href — a highlight is drawn in TEXT, never in an attribute", () => {
  // `spec` is in this link's destination as well as in its label, and the
  // walk only ever sees text nodes. A mark that reached the URL would be a
  // broken link rather than a loud one.
  expect(lit(LINK, "spec")).toContain(`href="https://example.com/spec#home"`)
  expect(lit(LINK, "example")).toBe(lit(LINK))
})

test("a needle inside a code span nested in a link is lit too", () => {
  // The walk carries the tag rule down the whole subtree, and the highlight
  // is carried down with nothing switched off at all.
  expect(lit("nested [`#home`](https://x.test) link", "home")).toContain(
    `<code>#<mark class="olai-hit" data-testid="hit">home</mark></code>`,
  )
})

// ── the half that is protected, and stays protected ────────────────────

test("a `#…` inside a code span is code, not a tag", () => {
  // The whole HTML rather than a `not.toContain("data-tag")`: there is nowhere
  // for a pill to hide in a string this short, and what is written is the claim.
  expect(lit("a `#home` in code")).toBe("a <code>#home</code> in code")
})

test("a `#…` in a link is not a tag — a URL fragment is the sharpest case", () => {
  expect(lit(LINK)).not.toContain("data-tag")
  expect(lit("the [#home](https://x.test/a#home) link")).not.toContain("data-tag")
})

test("...and lighting one does not turn it into a tag either", () => {
  // The needle lands, the pill does not appear: the two claims on one string.
  const html = lit("a `#home` in code", "#home")
  expect(html).toBe(
    `a <code><mark class="olai-hit" data-testid="hit">#home</mark></code> in code`,
  )
  expect(lit("the [#home](https://x.test/a#home) link", "#home"))
    .not.toContain("data-tag")
})

test("a tag OUTSIDE the code span in the same title is still a pill", () => {
  // The rule is scoped to the subtree, not to the title that holds one.
  const html = lit("`#home` is not, #home is #kitchen")
  expect(html).toBe(
    `<code>#home</code> is not, ` +
      `<span class="${TAG_CLASS}" data-testid="tag" data-tag="#home">#home</span>` +
      ` is <span class="${TAG_CLASS}" data-testid="tag" data-tag="#kitchen">#kitchen</span>`,
  )
})

// ── and nothing moves on a page nobody is filtering ─────────────────────

test("without a query these titles are written exactly as they were", () => {
  for (const title of [CODE, LINK, "a `#home` in code", "nested [`x`](https://x.test)"]) {
    expect(lit(title, "zzzz"), title).toBe(lit(title))
    expect(lit(title), title).not.toContain("olai-hit")
  }
})
