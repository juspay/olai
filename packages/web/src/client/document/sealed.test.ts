import { createHash } from "node:crypto"

import { expect, test } from "bun:test"

import { MEASURE, MEASURE_SHA256, SEAL, sealed } from "./sealed.ts"

/** The policy the seal carries, read back the way a browser reads it: every
 *  directive, with its source list. Parsed rather than matched, because what
 *  the assertion below is about is the SET — a directive nobody looked for is
 *  the thing a substring test cannot see. */
const policy = (): Record<string, ReadonlyArray<string>> => {
  const written = /content="([^"]*)"/.exec(SEAL)
  if (written === null) throw new Error(`no policy in the seal: ${SEAL}`)
  const directives: Record<string, ReadonlyArray<string>> = {}
  for (const one of written[1]!.split(";")) {
    const [name, ...sources] = one.trim().split(/\s+/)
    if (name !== undefined && name !== "") directives[name] = sources
  }
  return directives
}

// THE POLICY, as the whole set of directives rather than as tokens it must not
// contain, and the difference is the hazard: the tempting edits are all one
// word — `default-src 'self'` to make an image work, `'unsafe-inline'` added to
// the `script-src` for a page that "needs" its own script, a `frame-src` for an
// embed, `img-src data:` for a saved page whose pictures are inlined — and
// forbidding the words one thinks of catches only the ones one thinks of.
// `data:` in an `img-src` is exactly the widening that reads as harmless, and
// it slipped past a first draft of this test that banned `'self'` and `*` by
// substring (opencode's review of this PR found that). Asserted as an equality,
// so ANY directive added, removed or re-sourced fails here and has to be argued
// for.
test("the seal is the strictest policy there is, plus inline styles and one hash", () => {
  expect(policy()).toEqual({
    // Nothing loads, nothing is framed, nothing is fetched: every directive
    // that has no line of its own falls back to this one.
    "default-src": ["'none'"],
    // The one appearance exception, and the whole of what makes a preview worth
    // having: a saved page's look IS its own `<style>` and `style=` attributes.
    // Safe under the line above — a `url()` in that CSS is an image request,
    // and image requests have no source to come from.
    "style-src": ["'unsafe-inline'"],
    // The one execution exception, and it is a HASH rather than a source: the
    // only script this admits is the tape measure in `./sealed.ts`, because the
    // only way to match a hash is to be the bytes it was taken over. A
    // `'unsafe-inline'` or a `'self'` in here would be the whole difference
    // between "one script of ours" and "whatever the file brought".
    "script-src": [`'sha256-${MEASURE_SHA256}'`],
  })
})

// THE HASH ITSELF, recomputed. The constant is written down because the seal
// has to be a string the parser reads immediately and Web Crypto's digest is a
// promise — so the one thing that can go wrong is the two drifting: an editor
// tidies a space in the measure, the browser refuses a script that no longer
// matches, and the only symptom out there is a preview quietly back on its
// fallback height. This is the assertion that turns that into a failing test.
test("the policy admits the measure by its own hash", () => {
  expect(createHash("sha256").update(MEASURE, "utf8").digest("base64")).toBe(MEASURE_SHA256)
})

// …and that the script the hash covers is the one the seal actually carries,
// byte for byte. Hashing the constant proves the constant; this proves the
// markup, which is what the browser sees.
test("the seal carries exactly the script it hashed", () => {
  expect(SEAL).toContain(`<script>${MEASURE}</script>`)
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
