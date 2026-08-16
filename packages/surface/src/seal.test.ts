import { expect, test } from "bun:test"

import { reported, SEAL, sealedHello, sealPolicy } from "./seal.ts"

/** The host a served page was asked for on — the only thing the policy is
 *  built out of, and the value a request's `Host` header carries. */
const HOST = "127.0.0.1:4173"

/** The policy that host gets, read back the way a browser reads it: every
 *  directive, with its source list. Parsed rather than matched, because what
 *  the assertion below is about is the SET — a directive nobody looked for is
 *  the thing a substring test cannot see. */
const policy = (host: string = HOST): Record<string, ReadonlyArray<string>> => {
  const directives: Record<string, ReadonlyArray<string>> = {}
  for (const one of sealPolicy(host).split(";")) {
    const [name, ...sources] = one.trim().split(/\s+/)
    if (name !== undefined && name !== "") directives[name] = sources
  }
  return directives
}

/** The one route a sealed page may fetch from, as the policy spells it: the
 *  same host under both schemes, because the process answering cannot see
 *  which one the browser used (`./seal.ts` argues it). */
const VAULT = [`http://${HOST}/media/`, `https://${HOST}/media/`]

/**
 * Every script element the seal carries, found the way a BROWSER finds them.
 *
 * Three ways a tag can be spelled, and a parser accepts all three:
 *
 *   - CASE. `<SCRIPT>` is a script element; so is `<ScRiPt>`. Hence `i`.
 *   - ATTRIBUTES on the open tag: `<script type="module">`, `<script defer>`.
 *   - JUNK ON THE CLOSE TAG, which is the surprising one. After `</script` the
 *     tokeniser consumes anything up to the `>` as ignored attributes, so
 *     `</script foo="bar">` and `</script\t\n bar>` both END the script — while
 *     `</scriptish>` does not, which is why the junk has to begin with
 *     whitespace rather than being any run of non-`>`.
 *
 * The seal no longer pins its script by hash — the file's own scripts run, so
 * there is nothing left for a hash to protect — but COUNTING the ones olai
 * prepends is still worth doing: this prefix goes in front of somebody else's
 * page, and a second program in it would be one nobody argued for. CodeQL's
 * `js/bad-tag-filter` flagged the case blindness on PR #197 and then the
 * close-tag one; this is both fixes, and the test below is what stops either
 * coming back.
 *
 * Nothing in the APP does this, and that is worth saying because it is the
 * stronger answer to the same question: the seal never parses or filters
 * markup — it is a PREFIX, and the file is handed over after it byte for byte —
 * and the markdown side allowlists on a parsed tree (`@olai/web`'s
 * `markdown/sanitise.ts` through `rehype-sanitize`), where the parser has
 * already normalised case. This matcher exists so that a test can read back
 * what this module built, and nowhere else.
 */
const scriptsIn = (markup: string): ReadonlyArray<string> =>
  [...markup.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script(?:\s[^>]*)?>/gi)]
    .map((found) => found[1]!)

// THE POLICY, as the whole set of directives rather than as tokens it must not
// contain, and the difference is the hazard: the tempting edits are all one
// word — a host added to `default-src` for a font the page "needs", a
// `frame-src` for an embed, `data:` for a saved page whose pictures are inlined
// — and forbidding the words one thinks of catches only the ones one thinks of.
// Asserted as an equality, so ANY directive added, removed or re-sourced fails
// here and has to be argued for.
//
// Read it as the two decisions `sealPolicy` says it is: WHOSE ORIGIN (nobody's,
// even outside a frame) and WHERE BYTES COME FROM (one route on one host).
// Nothing in here decides what may RUN — that is the ruling this seal was
// rewritten for, and the keywords that carry it are in plain sight below.
test("the seal is one route, one host, and an origin that is nobody's", () => {
  expect(policy()).toEqual({
    // The mechanism that decides the CONSEQUENCE of running, said on the
    // response so it holds for a reader who types the address instead of
    // opening the preview. It intersects with the frame element's own sandbox
    // rather than fighting it, and the token that must never join it is
    // `allow-same-origin`.
    "sandbox": ["allow-scripts"],
    // Everything a page may fetch, at one address: the media route on the host
    // the reader asked for. Every directive with no line of its own — the
    // pictures, the fonts, `fetch`, the manifest — falls back to this one.
    "default-src": VAULT,
    // The two lines that add KEYWORDS rather than sources, and that is the
    // whole of the rule that changed: a page's own inline script runs, and its
    // own inline style paints. Neither reaches the network, which is what makes
    // them free to grant — and `'unsafe-eval'` beside them for the same reason,
    // since a page that computes is not a page that tells anybody anything.
    "script-src": [...VAULT, "'unsafe-inline'", "'unsafe-eval'"],
    "style-src": [...VAULT, "'unsafe-inline'"],
    // A preview is ONE frame, and one frame is what the component counts.
    "frame-src": ["'none'"],
    // The two outgoing paths `default-src` does not cover. `form-action` does
    // not fall back — a `<form action="https://collector/">` would otherwise be
    // refused by the sandbox alone, which is a fact about the element rather
    // than about the markup. `base-uri` is what keeps a saved page's own
    // `<base href>` from moving every relative address in it to the server it
    // was saved from.
    "form-action": ["'none'"],
    "base-uri": ["'none'"],
  })
})

// FAIL CLOSED, and the shape of the failure is the point. The host comes off a
// request header, so it is somebody else's string landing unescaped inside a
// policy — where a `;` would open a directive of their choosing. Anything that
// is not exactly a host gets `'none'` in every source: a page that draws
// nothing, which is the direction this has to fail in.
test("a host that is not one gets no sources at all", () => {
  for (
    const host of [
      // The exit, spelled.
      "a; img-src *",
      `a" onload="alert(1)`,
      // Not a host: a scheme, a path, credentials, a query, a trailing slash.
      "http://host",
      "host/media",
      "user:pw@host",
      "host?x=1",
      "host/",
      "",
    ]
  ) {
    const directives = policy(host)
    // Nothing may be fetched at all…
    expect(directives["default-src"]).toEqual(["'none'"])
    // …while inline scripts still run, and that is not an oversight: what fails
    // closed here is the NETWORK, and what may compute was settled by the
    // sandbox. The vault is LEFT OUT of these two rather than replaced by
    // `'none'`, which is a source a browser IGNORES beside another one — a
    // policy that would read as a refusal and behave as a permission.
    expect(directives["script-src"]).toEqual(["'unsafe-inline'", "'unsafe-eval'"])
    expect(directives["style-src"]).toEqual(["'unsafe-inline'"])
    // The whole string is the one every refused host gets, which is the
    // assertion a directive set alone cannot make: nothing of the host survived
    // anywhere in it, in any directive, escaped or otherwise.
    expect(sealPolicy(host)).toBe(sealPolicy("not a host"))
  }
})

// …and the ordinary hosts, which have to keep working: a port, a host name, an
// IPv6 literal, a bare name.
test("the hosts this app is actually served on are spelled", () => {
  for (const host of ["127.0.0.1:4173", "localhost:8080", "olai.example.com", "[::1]:3000"]) {
    expect(policy(host)["default-src"]).toEqual([
      `http://${host}/media/`,
      `https://${host}/media/`,
    ])
  }
})

// ── what goes in front of the file ─────────────────────────────────────

// The ORDER, which is what makes the frame's measurement mean anything: the
// doctype is first, so the document is in standards mode and the root box is
// auto-height. The file's own doctype arrives a few characters later and is
// ignored as a stray token.
test("the seal opens with a doctype and carries exactly one script", () => {
  expect(SEAL.startsWith("<!doctype html>")).toBe(true)
  expect(scriptsIn(SEAL)).toHaveLength(1)
  // Case, on both tags.
  expect(scriptsIn("<SCRIPT>alert(1)</SCRIPT>")).toEqual(["alert(1)"])
  expect(scriptsIn("<ScRiPt>alert(1)</sCrIpT>")).toEqual(["alert(1)"])
  // Attributes on the open tag.
  expect(scriptsIn(`<script type="module">a</script>`)).toEqual(["a"])
  // …and junk on the CLOSE tag, which a tokeniser eats and a careless pattern
  // does not: each of these ends the script.
  expect(scriptsIn("<script>a</script >")).toEqual(["a"])
  expect(scriptsIn("<script>a</script\t\n bar>")).toEqual(["a"])
  expect(scriptsIn(`<script>a</script foo="bar">`)).toEqual(["a"])
  // …while neither of these is a script at all, so neither is invented out of
  // something that merely starts the same way.
  expect(scriptsIn("<scriptish>a</scriptish>")).toEqual([])
  expect(scriptsIn("<script>a</scriptish>")).toEqual([])
})

// WHAT IS NOT IN IT ANY MORE, asserted because both absences are load-bearing
// and a reader will look for them. There is no policy in the markup — a
// `<meta>` cannot carry `sandbox`, which is the directive that makes a
// top-level visit safe, so the policy is a header. And there is no `<base>` —
// the document has a real URL now, and re-basing it would put every relative
// link back where PR #201 had to leave them.
test("the seal carries no policy and no base of its own", () => {
  expect(SEAL).not.toContain("Content-Security-Policy")
  expect(SEAL).not.toContain("<base")
})

// ── the message ────────────────────────────────────────────────────────

// THE MESSAGE, from both ends, and the prefixes taken from the SCRIPT rather
// than written out here — which is the whole point of the exercise. The
// producer is text in a template literal that no compiler reads, so the one
// thing no type can catch is the two ends drifting apart; a literal copied into
// this file would drift with them and go on passing. Everything below is built
// from what the seal actually says.
const [ARRIVING, SETTLED] = ((): readonly [string, string] => {
  const found = [...SEAL.matchAll(/\bpost\(\s*"([^"]*)"\s*\)/g)].map(
    (one) => JSON.parse(`"${one[1]!}"`) as string,
  )
  if (found.length !== 2) {
    throw new Error(`the measure posts ${found.length} kinds of message, not two: ${SEAL}`)
  }
  return [found[0]!, found[1]!]
})()

// THE HELLO, read out of the script that sends it for the reason every other
// constant here is: the producer is text no compiler reads. It is the FIRST
// thing the measure does — before the listeners, before any layout — because
// what asks for it is the frame's `load`, and a greeting that waited for a
// picture to arrive would be a greeting nobody heard in time.
test("a sealed document greets its embedder before it does anything else", () => {
  const greeting = /parent\.postMessage\("([^"]*)", "\*"\)/.exec(SEAL)
  if (greeting === null) throw new Error(`the measure sends no greeting: ${SEAL}`)
  expect(sealedHello(greeting[1]!)).toBe(true)
  // …first, and only then the listeners that do the measuring.
  expect(SEAL.indexOf(greeting[0])).toBeLessThan(SEAL.indexOf("addEventListener"))
})

// …and nothing else is that greeting. The receiver keeps a whole page in the
// frame on the strength of this string, so every near miss is a case: another
// app's message, a height reading, the shape of an object, a prefix of it.
test("only the greeting is the greeting", () => {
  for (
    const said of [
      undefined,
      null,
      42,
      "olai:page-sealed:",
      "olai:page-seal",
      "olai:page-height:640",
      { olai: "page-sealed" },
      "",
    ]
  ) {
    expect(sealedHello(said)).toBe(false)
  }
})

// TWO READINGS, and neither prefix is the other's — which is what lets the
// receiver decide which it is exactly once and then carry the NAME. A settled
// reading is the one taken after the page's pictures have landed, and
// `Hypertext.tsx` files its accepted widths under that name.
test("the frame's two messages are the two the parser recognises", () => {
  expect(reported(`${ARRIVING}640`)).toEqual({ height: 640, reading: "arriving" })
  expect(reported(`${SETTLED}940`)).toEqual({ height: 940, reading: "settled" })
  expect(SETTLED.startsWith(ARRIVING)).toBe(false)
  expect(ARRIVING.startsWith(SETTLED)).toBe(false)
})

// …and everything else is nothing. A sandboxed frame is an opaque origin and a
// message from one is a claim, so the cases below are not exotic — they are
// what a receiver that skipped a check would let through: a message that is not
// a string at all, the object shape this used to send, a height that is not a
// number, a page that measured itself as nothing, the two numeric values that
// are not lengths, and somebody else's message that happens to be well formed.
test("anything else the frame could say is not a height", () => {
  for (
    const said of [
      undefined,
      null,
      42,
      { olai: "page-height", height: 640 },
      ARRIVING,
      SETTLED,
      `${ARRIVING}tall`,
      `${SETTLED}tall`,
      `${ARRIVING}0`,
      `${ARRIVING}-40`,
      `${ARRIVING}Infinity`,
      // Literal on purpose: being the WRONG prefix is what this case is.
      "some-other-app:page-height:640",
      "olai:page-settled:640",
    ]
  ) {
    expect(reported(said)).toBeUndefined()
  }
})

// Rounded UP, and it matters at the last line: a browser lays out in fractions,
// and a frame truncated to the pixel below its content clips a descender and
// grows a scrollbar to show it.
test("a fractional page gets the pixel it needs", () => {
  expect(reported(`${ARRIVING}640.2`)?.height).toBe(641)
})

// WHAT `Number` LETS THROUGH, pinned rather than assumed — opencode's review of
// PR #197 asked for the stray-space case on the belief that it would be `NaN`
// and fall out with the rest. It does not: `Number` trims, so a space is a
// height, and `0x100` is 256. Written down because the surprise is worth one
// test, and left LENIENT rather than tightened to a decimal regex: every
// spelling that gets through is a number on its way into a CSS `clamp` between
// a heading and two screens, which is the same place an honest height lands.
// The gate that matters is the one above it — `event.source` — and it is
// identity, not syntax.
test("a slack spelling of a number is still a number", () => {
  expect(reported(`${ARRIVING} 640`)?.height).toBe(640)
  expect(reported(`${ARRIVING}0x100`)?.height).toBe(256)
})
