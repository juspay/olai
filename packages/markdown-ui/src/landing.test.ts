import { expect, test } from "bun:test"
import { installPipeline } from "./chunk.ts"
import * as pipeline from "./pipeline.ts"
import { renderLineLanding } from "./render.ts"

installPipeline(pipeline)

test("source landings light a phrase across tags and code with the existing walk", () => {
  const html = renderLineLanding("# Top\n\nFind #garden and `code` here.\n\nOther garden.", "a.md", 3, ["garden", "code"])
  expect(html).toContain('data-search-landing="true"')
  expect(html).toContain('data-tag="#garden"')
  expect(html.match(/<mark /g)).toHaveLength(2)
})

test("blank lines and opening fence markers land on the previous rendered block", () => {
  const source = "First paragraph.\n\n```text\ncode here\n```\n"
  for (const line of [2, 3]) {
    const html = renderLineLanding(source, "a.md", line, ["first"])
    expect(html).toContain('<p data-search-landing="true">')
  }
  expect(renderLineLanding(source, "a.md", 999, ["first"])).not.toContain("data-search-landing")
  expect(renderLineLanding(source, "a.md", 0, ["first"])).not.toContain("data-search-landing")
})
