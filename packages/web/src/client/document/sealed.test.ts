import { expect, test } from "bun:test"

import { SEAL, sealed } from "./sealed.ts"

// The POLICY, asserted as the string it is, because every part of it is load
// bearing and the tempting edits are all one word: `default-src 'self'` to make
// an image work, a `script-src` for a page that "needs" one, a `frame-src` for
// an embed. Each of those is somebody's file reaching the network or the
// runtime from inside this app, and each is a one-word diff to this line — so
// the line is the assertion, and widening it means arguing with this test.
test("the seal is the strictest policy there is, plus inline styles", () => {
  expect(SEAL).toContain(`content="default-src 'none'; style-src 'unsafe-inline'"`)
  expect(SEAL).not.toContain("script-src")
  expect(SEAL).not.toContain("'self'")
  expect(SEAL).not.toContain("*")
})

// The ORDER, which is the whole of whether the policy binds: a `<meta>` CSP is
// honoured when it is the first thing in the head, so the seal has to be in
// front of every byte of the file — including its doctype, which is why one of
// ours goes first rather than being left to whatever the file starts with.
test("the seal is in front of the file, doctype first", () => {
  const out = sealed("<!doctype html><html><body>hi</body></html>")
  expect(out.startsWith("<!doctype html>")).toBe(true)
  expect(out.indexOf("Content-Security-Policy")).toBeLessThan(out.indexOf("<html>"))
  expect(out.indexOf("Content-Security-Policy")).toBeLessThan(out.indexOf("hi"))
})

// VERBATIM after that, and this is the promise a preview makes: what is drawn
// is the file. Nothing is stripped — a `<script>` is left exactly where the
// author put it, because what makes it inert is the frame and the policy rather
// than an edit to their file, and a preview that quietly rewrote its input
// would be lying about what is on disk.
test("the file's own markup is carried through untouched", () => {
  const markup = "<h1>Report</h1><script>alert(1)</script><p style='color:red'>x</p>"
  expect(sealed(markup).endsWith(markup)).toBe(true)
})

// The empty file, which a vault has more of than anyone expects (a `touch`, a
// build that wrote nothing): still a sealed document rather than a blank string
// the parser would take as "no policy".
test("an empty file is still sealed", () => {
  expect(sealed("")).toBe(SEAL)
})
