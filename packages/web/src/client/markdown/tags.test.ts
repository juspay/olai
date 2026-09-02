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
import { tagStyle } from "../theme/tagInk.ts"
import { renderTitle } from "./title.ts"

installPipeline(pipeline)

const NOTE = "house.org"

/** A title as a filtered page draws it — the pipeline, since every title here
 *  holds a backtick or a bracket and the fast path refuses those. */
const lit = (title: string, ...needles: string[]): string =>
  renderTitle(title, NOTE, { needles }).html

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

test("a needle at a span's edges, and one that is the whole span", () => {
  // The edges are `runsIn`'s and not this file's — a window is a pair of
  // bounds on one search of the text — but a literal stretch reaches it
  // through the guard added here, so this is where a change to that guard
  // would show up. No empty runs, no mark that swallows a backtick.
  const hit = (text: string) =>
    `<mark class="olai-hit" data-testid="hit">${text}</mark>`
  expect(lit(CODE, "just")).toContain(`<code>${hit("just")} check</code>`)
  expect(lit(CODE, "check")).toContain(`<code>just ${hit("check")}</code>`)
  expect(lit(CODE, "just check")).toContain(`<code>${hit("just check")}</code>`)
})

// ── a phrase that spans two rendered pieces lights BOTH ────────────────

test("a phrase spanning two rendered pieces lights both", () => {
  // One search over the title as the reader sees it, then each HAST text
  // node is a window onto that search — the same contract a phrase across a
  // `#tag` already had. A one-sided mark (the fragment inside the code span,
  // the fragment inside the link) is the failure the old `not.toContain`
  // pin existed to forbid, so every case is exact HTML covering both sides.
  const hit = (text: string) =>
    `<mark class="olai-hit" data-testid="hit">${text}</mark>`

  expect(lit(CODE, "check before")).toBe(
    `run <code>just ${hit("check")}</code>${hit(" before")} pushing`,
  )
  expect(lit(LINK, "spec first")).toBe(
    `see the <a href="https://example.com/spec#home" target="_blank" ` +
      `rel="noopener noreferrer">cabinet ${hit("spec")}</a>${hit(" first")}`,
  )
  expect(lit("nested [`#home`](https://x.test) link", "#home link")).toBe(
    `nested <a href="https://x.test" target="_blank" ` +
      `rel="noopener noreferrer"><code>${hit("#home")}</code></a>${hit(" link")}`,
  )
  expect(lit("check **before** pushing", "check before")).toBe(
    `${hit("check ")}<strong>${hit("before")}</strong> pushing`,
  )
  expect(lit("see https://example.com first", "see https")).toBe(
    `${hit("see ")}<a href="https://example.com" target="_blank" ` +
      `rel="noopener noreferrer">${hit("https")}://example.com</a> first`,
  )
  // Tag in a later piece (`from !== 0`). Seeding the titleParts cursor at 0
  // would mark haystack[0, …) instead of `#home`.
  expect(lit("**urgent** #home", "urgent #home")).toBe(
    `<strong>${hit("urgent")}</strong>${hit(" ")}` +
      `<span class="${TAG_CLASS}" data-testid="tag" data-tag="#home" style="${
        tagStyle("#home")
      }">${hit("#home")}</span>`,
  )
})

test("unwrapping a spanning link still lights both pieces", () => {
  // Search rows sit inside a <button>, so they render with links: false.
  // Unwrap must not drop either mark.
  const hit = (text: string) =>
    `<mark class="olai-hit" data-testid="hit">${text}</mark>`
  const html = renderTitle(LINK, NOTE, { needles: ["spec first"], links: false }).html
  expect(html).not.toContain("<a")
  expect(html).toBe(`see the cabinet ${hit("spec")}${hit(" first")}`)
})

test("a lost-text fallback does not light", () => {
  // The pipeline dropped the words; escaped source is "show what you wrote"
  // and marking it up is what that path refuses to do.
  const html = lit("Use <Component> here", "Component")
  expect(html).toContain("Component")
  expect(html).not.toContain(`data-testid="hit"`)
})

test("a phrase that crosses an unwrapped fence into trailing prose lights neither", () => {
  // The unwrapped fence's visible text is not the title's words (highlight.js
  // tokens, closer leaking, pretty-print newlines). Making it so is a
  // renderer change this walk is not allowed to make. Neither, never one side.
  expect(lit("```js\nconst x = 1\n``` after", "1 after")).not.toContain(
    `data-testid="hit"`,
  )
  expect(lit("```js\nconst x = 1\n```\nafter", "1 after")).not.toContain(
    `data-testid="hit"`,
  )
})

// Nested emphasis used to lose its render to the escaped source (title.ts's
// accounting), and the escaped source lights nothing — so a filtered row whose
// only reason was a word inside `**b *c* d**` was drawn with its marks showing
// and nothing lit. Both halves are one fix: the title renders, and the needle
// lands where it sits inside the nesting.
test("a needle inside nested emphasis is lit where it sits", () => {
  expect(lit("a **b *c* d** e", "c")).toBe(
    `a <strong>b <em><mark class="olai-hit" data-testid="hit">c</mark></em>` +
      ` d</strong> e`,
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
      `<span class="${TAG_CLASS}" data-testid="tag" data-tag="#home" style="${
        tagStyle("#home")
      }">#home</span>` +
      ` is <span class="${TAG_CLASS}" data-testid="tag" data-tag="#kitchen" style="${
        tagStyle("#kitchen")
      }">#kitchen</span>`,
  )
})

// ── and nothing moves on a page nobody is filtering ─────────────────────

test("without a query these titles are written exactly as they were", () => {
  for (const title of [CODE, LINK, "a `#home` in code", "nested [`x`](https://x.test)"]) {
    expect(lit(title, "zzzz"), title).toBe(lit(title))
    expect(lit(title), title).not.toContain("olai-hit")
  }
})
