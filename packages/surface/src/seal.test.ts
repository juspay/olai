import { FILE_EXTS } from "@olai/format"
import { expect, test } from "bun:test"

import { mediaHref } from "./media.ts"
import { ours, type Press } from "./press.ts"
import { heard, SEAL, sealPolicy } from "./seal.ts"

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
// constant here is: the producer is text no compiler reads.
const HELLO = ((): string => {
  const found = /parent\.postMessage\("([^"]*)", "\*"\)/.exec(SEAL)
  if (found === null) throw new Error(`the measure sends no greeting: ${SEAL}`)
  return found[1]!
})()

// It is the FIRST thing the measure does — before the listeners, before any
// layout — because what asks for it is the frame's `load`, and a greeting that
// waited for a picture to arrive would be a greeting nobody heard in time.
test("a sealed document greets its embedder before it does anything else", () => {
  expect(heard(HELLO)).toEqual({ kind: "hello" })
  // …first, and only then the listeners that do the measuring.
  expect(SEAL.indexOf(`parent.postMessage("${HELLO}", "*")`))
    .toBeLessThan(SEAL.indexOf("addEventListener"))
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
    expect(heard(said)).not.toEqual({ kind: "hello" })
  }
})

// TWO READINGS, and the frame's height arrives as one of them. A settled
// reading is the one taken after the page's pictures have landed, and
// `Hypertext.tsx` files its accepted widths under that name.
test("the frame's two height messages are the two the parser recognises", () => {
  expect(heard(`${ARRIVING}640`)).toEqual({ kind: "reading", reading: "arriving", height: 640 })
  expect(heard(`${SETTLED}940`)).toEqual({ kind: "reading", reading: "settled", height: 940 })
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
    expect(heard(said)).toBeUndefined()
  }
})

// ── the click a page hands out ─────────────────────────────────────────

/**
 * The prefix the link handler posts, taken out of the SCRIPT rather than
 * written here — the same discipline the two height prefixes are read under and
 * for the same reason: the producer is text no compiler reads, so a literal
 * copied into this file would drift with it and go on passing.
 */
const OPEN = ((): string => {
  const found = /parent\.postMessage\("([^"]*)" \+ path \+ at\.hash, "\*"\)/.exec(SEAL)
  if (found === null) throw new Error(`the seal's link handler posts nothing: ${SEAL}`)
  return found[1]!
})()

/**
 * WHICH FILES THE HANDLER CLAIMS A CLICK ON, read the same way: the list is
 * interpolated from the registry (`@olai/format`'s `FILE_EXTS`), and this is
 * what says it still is. A `.html` written out over there would pass every
 * other test in this file and quietly stop following the table the day a fourth
 * kind of bodied file is added — which is the exact failure the repository's own
 * suffix sweep exists to prevent, asked here of a list that lives inside a
 * string where that sweep cannot see it.
 */
test("the handler claims the kinds the registry says have pages", () => {
  const found = /var pages = (\[[^\]]*\])/.exec(SEAL)
  if (found === null) throw new Error(`the seal's link handler names no pages: ${SEAL}`)
  expect(JSON.parse(found[1]!)).toEqual([...FILE_EXTS])
})

/**
 * THE PRESS RULE IS SHIPPED, NOT RETYPED — and this is what says so.
 *
 * `./press.ts`'s `ours` is the app's one answer to what a reader meant by a
 * press, and the injected handler gets it by having its SOURCE interpolated
 * (`Function.prototype.toString`), because a frame with no module system cannot
 * import a function. That is one definition rather than two, which is the point
 * — but it moves the risk rather than deleting it: what ships is now the source
 * as the BUILD left it, and a bundler that inlined a helper into this function,
 * or renamed something it closed over, would emit a guard referring to a name
 * the frame does not have. The failure would be a click that silently stops
 * working inside a sandbox.
 *
 * So the shipped text is lifted back out of `SEAL` and RUN, against the
 * function it came from, over every combination of the facts a press has. It
 * is not a text comparison: a build that reformats passes, and a build that
 * changes the meaning fails and names the press.
 */
const shipped = ((): ((press: Press) => boolean) => {
  const found = /\n  var ours = ([\s\S]*?)\n  addEventListener/.exec(SEAL)
  if (found === null) {
    throw new Error(`the seal ships no press rule — this test has nothing to check:\n${SEAL}`)
  }
  return new Function(`return (${found[1]!})`)() as (press: Press) => boolean
})()

/** Every combination of the six facts: 64 presses, which is small enough to
 *  take all of rather than sample. `BOTH` is named once rather than spelled at
 *  each level — the shape is a product, and the only thing that varies between
 *  the levels is which field is being fixed. */
const BOTH = [false, true] as const
const PRESSES: ReadonlyArray<Press> = BOTH.flatMap((defaultPrevented) =>
  ([0, 1] as const).flatMap((button) =>
    BOTH.flatMap((metaKey) =>
      BOTH.flatMap((ctrlKey) =>
        BOTH.flatMap((shiftKey) =>
          BOTH.map((altKey) => ({
            defaultPrevented,
            button,
            metaKey,
            ctrlKey,
            shiftKey,
            altKey,
          }))
        )
      )
    )
  )
)

test("the press rule the seal ships is the press rule this app applies", () => {
  // A BARE `return` is what the handler does with a press it refuses, so what
  // comes back for one is `undefined` rather than `false` — but that is the
  // handler's shape, not this function's: `ours` returns a boolean either way,
  // and any disagreement here is a real one.
  expect(PRESSES.filter((press) => shipped(press) !== ours(press))).toEqual([])
  // …and the agreement is over presses of both kinds: a rule that claimed
  // everything, or nothing, would agree with a broken `ours` and pass above.
  expect(PRESSES.filter(ours)).toHaveLength(1)
})

// THE ADDRESS, from both ends: what the frame posts is the pathname the browser
// resolved, and what comes back is the file of this vault it named. Built with
// `mediaHref` rather than spelled, so this reads the same bijection the frame's
// own `src` and every rewritten picture are built from.
test("a page of this vault, clicked, arrives as the file it is", () => {
  expect(heard(`${OPEN}${mediaHref("notes/second.html")}`))
    .toEqual({ kind: "open", file: "notes/second.html" })
  // A `.md` is on the list on purpose: the ROUTE refuses one (it is not an
  // asset), and a reader clicking a link to a note beside the page still means
  // that note's page. The two questions are different and this is the one about
  // where a reader may be taken.
  expect(heard(`${OPEN}${mediaHref("notes/second.md")}`))
    .toEqual({ kind: "open", file: "notes/second.md" })
  // A name that needs escaping survives the trip, which is the whole reason the
  // pathname travels escaped rather than the frame decoding it first.
  expect(heard(`${OPEN}${mediaHref("he said \"hi\"/a b.html")}`))
    .toEqual({ kind: "open", file: `he said "hi"/a b.html` })
})

/**
 * …and everything else is nothing at all.
 *
 * The sender runs somebody else's JavaScript, so none of these is exotic: they
 * are what a receiver that skipped a check would let through. The climbs are the
 * ones `./media.ts` refuses and are here anyway, because the promise this
 * parser makes is that it refuses them — a future edit that decoded the path
 * itself "to save an import" would pass the tests above this line.
 *
 * What is NOT in this list, and cannot be, is the hostile message that is
 * perfectly well formed: `${OPEN}/media/secrets.md` names a path this returns.
 * Stopping that is not this function's job and is not attempted here — it is a
 * lookup in the app's own file list, and `html_previews.feature` is where a
 * page posting exactly that is watched failing to move anything.
 */
test("anything else a frame could say is not a page to open", () => {
  for (
    const said of [
      undefined,
      null,
      42,
      { olai: "open-page", file: "notes/second.html" },
      OPEN,
      `${OPEN}/media/`,
      // Not this route's URL space at all — the app's own addresses included,
      // which is the shape a page would reach for to name a page directly.
      `${OPEN}/doc/second.html`,
      `${OPEN}second.html`,
      `${OPEN}https://olai.test/media/second.html`,
      // The climbs, refused by the one decoder rather than by a second one.
      `${OPEN}/media/../../etc/hostname`,
      `${OPEN}/media/%2e%2e/secret.html`,
      `${OPEN}/media/a%2fb.html`,
      `${OPEN}/media/second.html%00.olai`,
      // Ours, and not this message — heard as what they ARE, never as an open.
      "olai:page-sealed",
      "olai:page-height:640",
      // Somebody else's message that happens to be well formed.
      "some-other-app:open-page:/media/second.html",
    ]
  ) {
    expect(heard(said)?.kind).not.toBe("open")
  }
})

/**
 * THE WHOLE VOCABULARY IS DISJOINT, which is the invariant that used to live
 * nowhere.
 *
 * When the three kinds were three exported parsers, this was a rule the one
 * receiver kept by trying them in an order it was trusted to remember: nothing
 * held it, and a fourth message could have quietly begun with one of the three
 * and been classified by whichever arm was written first. `heard` decides once,
 * so what has to be true is a property of the STRINGS — no one of them begins
 * another — and that is what this asserts, over every pair, in both directions.
 *
 * Every constant is read out of the seal itself for the reason each of them is
 * above: the producer is text no compiler reads.
 */
test("no one of the things a frame can say begins another", () => {
  const vocabulary = { HELLO, ARRIVING, SETTLED, OPEN }
  const overlaps: Array<string> = []
  for (const [name, one] of Object.entries(vocabulary)) {
    for (const [other, another] of Object.entries(vocabulary)) {
      if (name === other) continue
      if (one.startsWith(another)) overlaps.push(`${name} begins with ${other}`)
    }
  }
  expect(overlaps).toEqual([])
})

// Rounded UP, and it matters at the last line: a browser lays out in fractions,
// and a frame truncated to the pixel below its content clips a descender and
// grows a scrollbar to show it.
test("a fractional page gets the pixel it needs", () => {
  expect(heard(`${ARRIVING}640.2`)).toEqual({ kind: "reading", reading: "arriving", height: 641 })
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
  expect(heard(`${ARRIVING} 640`)).toMatchObject({ height: 640 })
  expect(heard(`${ARRIVING}0x100`)).toMatchObject({ height: 256 })
})

// THE PLACE INSIDE THE PAGE, carried on the same message as the file. A link at
// `other.html#beds` names two things — which file, and where in it — and both
// have to survive the trip, because the app can land on a section now and a
// fragment dropped in transit is a reader put at the top of a document they
// were sent into the middle of.
test("a clicked link's fragment arrives beside the file it names", () => {
  expect(heard(`${OPEN}${mediaHref("notes/second.html")}#beds`))
    .toEqual({ kind: "open", file: "notes/second.html", at: "beds" })
  // Escaped on the way out and read back as written, since an id in somebody's
  // saved page is whatever its author typed.
  expect(heard(`${OPEN}${mediaHref("notes/second.html")}#Q3%20revenue`))
    .toEqual({ kind: "open", file: "notes/second.html", at: "Q3 revenue" })
  // A fragment that names no place is no fragment: the file still opens, at its
  // top, which is what a browser does with the same address.
  expect(heard(`${OPEN}${mediaHref("notes/second.html")}#`))
    .toEqual({ kind: "open", file: "notes/second.html" })
  expect(heard(`${OPEN}${mediaHref("notes/second.html")}#%zz`))
    .toEqual({ kind: "open", file: "notes/second.html" })
  // …and a fragment cannot smuggle a second path in: the file is decided by
  // what is before the `#`, by the same decoder the route stands behind.
  expect(heard(`${OPEN}${mediaHref("notes/second.html")}#/../secrets.md`))
    .toEqual({ kind: "open", file: "notes/second.html", at: "/../secrets.md" })
})

// WHERE THE ANCHOR ENDED UP, which is a number and deliberately not a height:
// zero is the ordinary answer for a page the browser scrolled to its own anchor,
// and a negative one is honest for a page scrolled past it. The height parser
// refuses both on purpose, so folding this into it would have meant widening the
// gate that exists to catch a page measuring itself as nothing.
test("a frame says where its anchor landed, zero and negative included", () => {
  const LANDED = ((): string => {
    const found = /parent\.postMessage\(\n?\s*"([^"]*)" \+ Math\.round/.exec(SEAL)
    if (found === null) throw new Error(`the measure reports no anchor: ${SEAL}`)
    return found[1]!
  })()
  expect(heard(`${LANDED}1298`)).toEqual({ kind: "landed", top: 1298 })
  expect(heard(`${LANDED}0`)).toEqual({ kind: "landed", top: 0 })
  expect(heard(`${LANDED}-40`)).toEqual({ kind: "landed", top: -40 })
  // …and nothing that is not a number is one.
  for (const said of [`${LANDED}`, `${LANDED}down`, `${LANDED}Infinity`]) {
    expect(heard(said)).toBeUndefined()
  }
  // It is its own kind, never a height: the two prefixes are near neighbours
  // (`page-landed` beside `page-loaded`) and this is what says a browser reading
  // one as the other would be caught.
  expect(heard(`${LANDED}1298`)?.kind).not.toBe("reading")
})

/**
 * A FRAME THAT HAS BEEN RESIZED SAYS WHERE THE ANCHOR IS NOW — the pin on the
 * one moment the anchor moves without the page changing at all.
 *
 * RUN rather than read, the way the press rule above is, because what is being
 * asserted is a behaviour and every cheap spelling of it is a lie: a test that
 * greps for `"resize"` passes on a listener that posts a height, and a test that
 * counts listeners passes on one registered for the wrong event.
 *
 * The world below is the failing case exactly. The page is 1550px of fixed
 * content in a frame the embedder has guessed at 70dvh, so the browser has
 * scrolled the page to its own anchor and the anchor sits 205px down the frame.
 * Then the embedder applies the measured height: the frame grows, the page stops
 * scrolling inside it, the anchor is 1195px down — and `documentElement` is
 * 1550px tall throughout, which is the trap. The root box is auto-height by
 * design ({@link SEAL}'s doctype, so a page cannot be pinned at the frame's own
 * height), so its size has not changed and a `ResizeObserver` on it says
 * nothing. Only the viewport changed.
 */
test("a frame that is resized says where the anchor is now, unasked", () => {
  const [script] = scriptsIn(SEAL)
  const said: string[] = []
  const listeners = new Map<string, () => void>()
  // Where the anchor is, in the frame's own viewport — the one thing the
  // embedder's resize moves.
  let anchor = 205
  const frame = {
    parent: { postMessage: (message: string) => said.push(message) },
    document: {
      // The CONTENT's height, and it does not move: this page is 1550px of
      // fixed boxes before the resize and 1550px of them after.
      documentElement: { offsetHeight: 1550 },
      body: { scrollHeight: 1550 },
      getElementById: (id: string) =>
        id === "beds" ? { getBoundingClientRect: () => ({ top: anchor }) } : null,
    },
    location: { hash: "#beds" },
    addEventListener: (kind: string, run: () => void) => listeners.set(kind, run),
    // Delivers its first callback the moment it starts observing, as the real
    // one does — that first callback IS the arriving measurement.
    ResizeObserver: class {
      constructor(private readonly run: () => void) {}
      observe() {
        this.run()
      }
    },
  }
  new Function(...Object.keys(frame), script!)(...Object.values(frame))

  /** …and a missing listener is NAMED, rather than arriving as a `TypeError`
   *  from a line that reads like the assertion's own bookkeeping. */
  const fire = (kind: string): void => {
    const run = listeners.get(kind)
    if (run === undefined) {
      throw new Error(
        `the measure listens for no ${kind}, so nothing it could report would ` +
          `reach the embedder: ${[...listeners.keys()].join(", ")}`,
      )
    }
    run()
  }

  fire("DOMContentLoaded")
  fire("load")
  expect(said.filter((one) => one.endsWith("205"))).not.toHaveLength(0)

  // THE RESIZE, with the page as unchanged as it really is: no ResizeObserver
  // callback, because nothing that observer can see has moved.
  anchor = 1195
  said.length = 0
  fire("resize")

  expect(said).toEqual([expect.stringContaining("1195") as unknown as string])
  // …and it reports the anchor ALONE. A height from here is the `vh` ladder the
  // receiver's per-width guard exists to refuse — the frame just got taller, and
  // a page measured against it would answer with its new box every time.
  expect(said.filter((one) => one.includes("1550"))).toEqual([])
})
