import { TEST_CLAIMS } from "@olai/format/testlib"
import { expect, test } from "bun:test"

import { installPipeline } from "./chunk.ts"
import * as pipeline from "./pipeline.ts"
import { plainTitle } from "./plain.ts"
import { TAG_CLASS } from "./tags.ts"
import { tagStyle } from "@olai/appearance/tagInk.ts"
import { renderTitle } from "./title.ts"

installPipeline(pipeline)

const NOTE = "house.olai"

const lit = (title: string, ...needles: string[]): string =>
  renderTitle(TEST_CLAIMS, title, NOTE, { needles }).html

const CODE = "run `just check` before pushing"
const LINK = "see the [cabinet spec](https://example.com/spec#home) first"

test("the fast path never answers these, so the pipeline is what is under test", () => {
  for (const title of [CODE, LINK]) expect(plainTitle(title), title).toBeNull()
})

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
  expect(lit(LINK, "spec")).toContain(`href="https://example.com/spec#home"`)
  expect(lit(LINK, "example")).toBe(lit(LINK))
})

test("a needle inside a code span nested in a link is lit too", () => {
  expect(lit("nested [`#home`](https://x.test) link", "home")).toContain(
    `<code>#<mark class="olai-hit" data-testid="hit">home</mark></code>`,
  )
})

test("a needle at a span's edges, and one that is the whole span", () => {
  const hit = (text: string) =>
    `<mark class="olai-hit" data-testid="hit">${text}</mark>`
  expect(lit(CODE, "just")).toContain(`<code>${hit("just")} check</code>`)
  expect(lit(CODE, "check")).toContain(`<code>just ${hit("check")}</code>`)
  expect(lit(CODE, "just check")).toContain(`<code>${hit("just check")}</code>`)
})

test("a phrase spanning two rendered pieces lights both", () => {
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
  expect(lit("**urgent** #home", "urgent #home")).toBe(
    `<strong>${hit("urgent")}</strong>${hit(" ")}` +
      `<span class="${TAG_CLASS}" data-testid="tag" data-tag="#home" style="${
        tagStyle("#home")
      }">${hit("#home")}</span>`,
  )
})

test("unwrapping a spanning link still lights both pieces", () => {
  const hit = (text: string) =>
    `<mark class="olai-hit" data-testid="hit">${text}</mark>`
  const html = renderTitle(TEST_CLAIMS, LINK, NOTE, { needles: ["spec first"], links: false }).html
  expect(html).not.toContain("<a")
  expect(html).toBe(`see the cabinet ${hit("spec")}${hit(" first")}`)
})

test("a lost-text fallback does not light", () => {
  const html = lit("Use <Component> here", "Component")
  expect(html).toContain("Component")
  expect(html).not.toContain(`data-testid="hit"`)
})

test("a phrase that crosses an unwrapped fence into trailing prose lights neither", () => {
  expect(lit("```js\nconst x = 1\n``` after", "1 after")).not.toContain(
    `data-testid="hit"`,
  )
  expect(lit("```js\nconst x = 1\n```\nafter", "1 after")).not.toContain(
    `data-testid="hit"`,
  )
})

test("a needle inside nested emphasis is lit where it sits", () => {
  expect(lit("a **b *c* d** e", "c")).toBe(
    `a <strong>b <em><mark class="olai-hit" data-testid="hit">c</mark></em>` +
      ` d</strong> e`,
  )
})

test("a `#…` inside a code span is code, not a tag", () => {
  expect(lit("a `#home` in code")).toBe("a <code>#home</code> in code")
})

test("a `#…` in a link is not a tag — a URL fragment is the sharpest case", () => {
  expect(lit(LINK)).not.toContain("data-tag")
  expect(lit("the [#home](https://x.test/a#home) link")).not.toContain("data-tag")
})

test("...and lighting one does not turn it into a tag either", () => {
  const html = lit("a `#home` in code", "#home")
  expect(html).toBe(
    `a <code><mark class="olai-hit" data-testid="hit">#home</mark></code> in code`,
  )
  expect(lit("the [#home](https://x.test/a#home) link", "#home"))
    .not.toContain("data-tag")
})

test("a tag OUTSIDE the code span in the same title is still a pill", () => {
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

test("without a query these titles are written exactly as they were", () => {
  for (const title of [CODE, LINK, "a `#home` in code", "nested [`x`](https://x.test)"]) {
    expect(lit(title, "zzzz"), title).toBe(lit(title))
    expect(lit(title), title).not.toContain("olai-hit")
  }
})
