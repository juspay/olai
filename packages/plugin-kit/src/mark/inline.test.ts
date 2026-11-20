import { expect, test } from "bun:test"

import { inlineMark, MARK_TOKEN } from "./inline.ts"

const doc = (body: string, viewBox = "70 108 372 340"): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" role="img">${body}</svg>`

const SRC = "/nix/store/fake-source/logo.svg"

test("the viewBox travels out and the root tag does not", () => {
  const { viewBox, body } = inlineMark(doc(`<rect x="1" y="2" width="3" height="4"/>`), SRC)
  expect(viewBox).toBe("70 108 372 340")
  expect(body).not.toContain("<svg")
  expect(body).not.toContain("role=")
  expect(body).toContain("<rect")
})

test("a declaration and the url(#…) that reads it are tokenised together", () => {
  const { body } = inlineMark(
    doc(
      `<defs><linearGradient id="topStep"><stop stop-color="#F59E0B"/></linearGradient></defs>` +
        `<rect x="1" y="2" width="3" height="4" fill="url(#topStep)"/>`,
    ),
    SRC,
  )
  expect(body).toContain(`id="${MARK_TOKEN}topStep"`)
  expect(body).toContain(`url(#${MARK_TOKEN}topStep)`)
  expect(body).not.toContain(`id="topStep"`)
})

test("quoted url references and href references are tokenised too", () => {
  const { body } = inlineMark(
    doc(`<defs><path id="edge" d="M0 0h1"/></defs><use href="#edge"/><g filter="url('#edge')"><rect/></g>`),
    SRC,
  )
  expect(body).toContain(`href="#${MARK_TOKEN}edge"`)
  expect(body).toContain(`url('#${MARK_TOKEN}edge')`)
})

test("<title> and <desc> are gone, and their ids with them", () => {
  const { body } = inlineMark(
    doc(`<title id="title">Kolu logo</title><desc id="desc">Three steps.</desc><rect/>`),
    SRC,
  )
  expect(body).not.toContain("<title")
  expect(body).not.toContain("<desc")
  expect(body).not.toContain("title")
  expect(body).not.toContain("desc")
})

test("a hex colour survives the final #-sweep untouched", () => {
  const { body } = inlineMark(doc(`<rect fill="#F59E0B" stroke="#020617"/>`), SRC)
  expect(body).toContain(`fill="#F59E0B"`)
  expect(body).toContain(`stroke="#020617"`)
})

test.each([
  ["a <script> element", doc(`<script>alert(1)</script><rect/>`), "<script>"],
  ["a <style> element", doc(`<style>#topStep{fill:red}</style><rect/>`), "<style>"],
  ["a <foreignObject>", doc(`<foreignObject><div/></foreignObject><rect/>`), "<foreignObject>"],
  ["an inline handler", doc(`<rect onclick="steal()"/>`), "inline event handler"],
  ["an off-document href", doc(`<image href="https://example.com/x.png"/><rect/>`), "outside the document"],
])("it refuses %s", (_what: string, input: string, says: string) => {
  expect(() => inlineMark(input, SRC)).toThrow(says)
  expect(() => inlineMark(input, SRC)).toThrow(SRC)
})

test("a dangling url(#…) fails the build rather than half-painting the logo", () => {
  expect(() => inlineMark(doc(`<rect fill="url(#gone)"/>`), SRC)).toThrow(
    "references #gone, which it does not declare",
  )
})

test("a root without a viewBox throws, because the nested viewport needs one", () => {
  expect(() => inlineMark(`<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>`, SRC)).toThrow(
    "root <svg> has no viewBox",
  )
})

test("a duplicate id throws", () => {
  expect(() => inlineMark(doc(`<rect id="a"/><rect id="a"/>`), SRC)).toThrow(`declares the id "a" twice`)
})

test("an input already carrying the sentinel throws, so the sentinel stays unambiguous", () => {
  expect(() => inlineMark(doc(`<rect id="${MARK_TOKEN}a"/>`), SRC)).toThrow("already contains the sentinel")
})

test("an asset that draws nothing throws rather than emitting an empty box", () => {
  expect(() => inlineMark(doc(`<defs><linearGradient id="a"/></defs>`), SRC)).toThrow(
    "no drawing element left",
  )
})

test("a SINGLE-QUOTED id is collected, rewritten and re-scanned like any other", () => {
  const out = inlineMark(
    doc(`<defs><filter id='lift'><feDropShadow dy='2'/></filter></defs><rect filter='url(#lift)'/>`),
    SRC,
  )
  expect(out.body).toContain(`id='${MARK_TOKEN}lift'`)
  expect(out.body).toContain(`url(#${MARK_TOKEN}lift)`)
  expect(out.body).not.toContain(`id='lift'`)
})

test("... and a single-quoted reference to an id nothing declares still fails the build", () => {
  expect(() =>
    inlineMark(doc(`<rect filter='url(#gone)'/>`), SRC)
  ).toThrow("#gone")
})

test("a `#` in a COMMENT is prose, not a broken reference", () => {
  const out = inlineMark(doc(`<!-- see #4312 for why the lift is 13 --><rect fill="#F59E0B"/>`), SRC)
  expect(out.body).not.toContain("4312")
  expect(out.body).toContain(`fill="#F59E0B"`)
})

test("... and so is a `#` in text content", () => {
  const out = inlineMark(doc(`<text>step #1</text><rect fill="#14B8A6"/>`), SRC)
  expect(out.body).toContain("step #1")
})

test("a SPLICED comment cannot survive the strip — the fixpoint closes it", () => {
  const spliced = `<!-<!-- -->- still a comment --><rect fill="#F59E0B"/>`
  const out = inlineMark(doc(spliced), SRC)
  expect(out.body).not.toContain("<!--")
  expect(out.body).not.toContain("-->")
  expect(out.body).toContain(`fill="#F59E0B"`)
})

test("... and a delimiter left standing after the fixpoint is REFUSED, never passed through", () => {
  expect(() =>
    inlineMark(doc(`<rect fill="#F59E0B"/><!-- never closed`), SRC)
  ).toThrow("<!")
  expect(() => inlineMark(doc(`<rect fill="#F59E0B"/>--><g/>`), SRC)).toThrow("-->")
})

test("`--!>` closes a comment too, so the strip takes the whole of it", () => {
  const out = inlineMark(doc(`<!-- see #4312 --!><rect fill="#F59E0B"/>`), SRC)
  expect(out.body).not.toContain("4312")
  expect(out.body).not.toContain("--!>")
  expect(out.body).toContain(`fill="#F59E0B"`)
})

test("a DECLARATION or a processing instruction is refused, whatever kind it is", () => {
  expect(() => inlineMark(doc(`<![CDATA[ x ]]><rect fill="#F59E0B"/>`), SRC)).toThrow("<!")
  expect(() => inlineMark(doc(`<?xml-stylesheet href="x"?><rect fill="#F59E0B"/>`), SRC)).toThrow("<?")
  expect(() => inlineMark(doc(`<rect fill="#F59E0B"/><!-- never closed`), SRC)).toThrow("<!")
  expect(() => inlineMark(doc(`<rect fill="#F59E0B"/>--!><g/>`), SRC)).toThrow("--!>")
})
