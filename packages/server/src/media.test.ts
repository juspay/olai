/**
 * The route, over a real socket.
 *
 * `@olai/surface`'s `media.test.ts` is the guard on its own — every way a URL
 * can spell a climb — and `seal.test.ts` beside it is the policy as a set of
 * directives. What neither can say is what a BROWSER is actually handed, and
 * that is this file: the status, the headers and the first bytes of a response,
 * asked of a server that is really listening.
 *
 * It matters most for the `.html` arm, which is the one thing in this route
 * that is not the platform's file engine. A preview is a frame pointed at one
 * of these responses, so everything that makes the frame safe rides on them:
 * the sandbox that is stated on the RESPONSE rather than only on the element
 * (so a reader who types the address is in an opaque origin too), the sources
 * that keep the page's fetches inside this vault, and the tape measure in front
 * of the file's own bytes.
 */

import { BODY_REFUSED } from "@olai/surface"
import { expect, test } from "bun:test"
import * as fs from "node:fs"
import * as path from "node:path"

import { served, withServing } from "./serve.testlib.ts"

/** A one-pixel PNG, so "a picture is served" is a real decode rather than a
 *  file with a picture's name. */
const PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
)

/** The page every assertion below is about: it carries a script and a `<base>`
 *  of its own, because those are the two things the seal has to leave alone in
 *  the bytes and answer for in the headers. */
const PAGE = `<!doctype html>
<html lang="en"><head><base href="https://example.invalid/vault/"></head>
<body><h1>Report</h1><script>document.title = "ran"</script></body></html>
`

/** A served directory with one of everything this route decides about. */
const vault = (): string => {
  const root = served()
  fs.mkdirSync(path.join(root, "notes", "art"), { recursive: true })
  fs.writeFileSync(path.join(root, "notes", "report.html"), PAGE)
  fs.writeFileSync(path.join(root, "notes", "art", "shot.png"), PIXEL)
  fs.writeFileSync(path.join(root, "notes", "page.css"), "h1 { color: red }\n")
  fs.writeFileSync(path.join(root, "notes", "chart.js"), "window.drew = true\n")
  fs.writeFileSync(path.join(root, "notes", "finishes.md"), "# Finishes\n")
  fs.writeFileSync(path.join(root, "notes", "secret.env"), "TOKEN=hunter2\n")
  // The three the viewers added: a `.pdf` a page points an `<object>` at, an
  // `.svg` a page points an `<img>` at — carrying a script, because the whole
  // question about an SVG is what happens when somebody reaches it as a
  // DOCUMENT instead — and a `.csv`, which has a page and is deliberately not
  // answered here.
  fs.writeFileSync(path.join(root, "notes", "q3.pdf"), "%PDF-1.4\n")
  fs.writeFileSync(
    path.join(root, "notes", "art", "diagram.svg"),
    `<svg xmlns="http://www.w3.org/2000/svg"><script>top.x=1</script></svg>\n`,
  )
  fs.writeFileSync(path.join(root, "notes", "sales.csv"), "region,units\nnorth,12\n")
  return root
}

/** A real server over that directory, and its address — the package's own
 *  helper (`./serve.testlib.ts`), which is where "stand a server up and find
 *  out where it bound" is spelled for every test that needs it. */
const withVault = (body: (url: string) => Promise<void>): Promise<void> =>
  withServing({ root: vault() }, (url) => body(url))

// THE PAGE, as the browser gets it: the seal in front, the file after it, and
// the policy on the response. Every line here is one of the mechanisms
// `@olai/surface`'s `seal.ts` argues for, read where a browser reads it.
test("a served page arrives sealed, with the file's own bytes after the seal", async () => {
  await withVault(async (url) => {
    const answer = await fetch(`${url}/media/notes/report.html`)
    expect(answer.status).toBe(200)
    expect(answer.headers.get("content-type")).toBe("text/html; charset=utf-8")

    const policy = answer.headers.get("content-security-policy") ?? ""
    // The origin, on the response, so it holds for a reader who types this
    // address instead of opening the preview — and `allow-same-origin` is the
    // token that must never be in there.
    expect(policy).toContain("sandbox allow-scripts")
    expect(policy).not.toContain("allow-same-origin")
    // The sources, named at the host the request asked for, which is the only
    // host the browser will compare them against.
    const host = new URL(url).host
    expect(policy).toContain(`default-src http://${host}/media/ https://${host}/media/`)
    // The page's own scripts run. That is the ruling this route was rewritten
    // for, and it is the one line here whose absence would be the old
    // behaviour.
    expect(policy).toContain("'unsafe-inline'")
    // …and the two outgoing paths `default-src` does not cover.
    expect(policy).toContain("form-action 'none'")
    expect(policy).toContain("base-uri 'none'")

    const body = await answer.text()
    // The seal is a PREFIX: a doctype of ours so the frame is in standards
    // mode, the tape measure, and then the file exactly as it is on disk —
    // its own `<base>` and its own `<script>` included, because a preview that
    // edited the file to make itself work would be lying about what is there.
    expect(body.startsWith("<!doctype html>")).toBe(true)
    expect(body.indexOf("olai:page-sealed")).toBeLessThan(body.indexOf("<html"))
    expect(body.endsWith(PAGE)).toBe(true)
  })
})

// The parts a page draws with, which is what widened this route beyond
// pictures: a stylesheet and a script beside the file are addresses too — and
// the kinds whose own PAGE is drawn by pointing an element here, which is what
// widened it again.
test("a page's parts, and every file drawn by pointing at it, are served", async () => {
  await withVault(async (url) => {
    for (
      const [at, type] of [
        ["/media/notes/art/shot.png", "image/png"],
        ["/media/notes/art/diagram.svg", "image/svg+xml"],
        ["/media/notes/q3.pdf", "application/pdf"],
        ["/media/notes/page.css", "text/css"],
        ["/media/notes/chart.js", "javascript"],
      ] as const
    ) {
      const answer = await fetch(`${url}${at}`)
      expect(answer.status).toBe(200)
      expect(answer.headers.get("content-type")).toContain(type)
    }
  })
})

// …and everything else is one 404, whichever way it is not there. The set's own
// files have pages of their own, a file with no claimed suffix is nobody's, and
// a climb is refused before anything is opened.
test("the vault's other files are not served, however they are asked for", async () => {
  await withVault(async (url) => {
    for (
      const at of [
        "/media/notes/finishes.md",
        // A `.csv` has a page and its page is handed the TEXT on the wire, so
        // raw bytes here would be a second way to read a file that already has
        // one — the same argument the set's own files get.
        "/media/notes/sales.csv",
        "/media/a.olai",
        "/media/notes/secret.env",
        "/media/notes/nothing.html",
        "/media/../../etc/hostname",
        "/media/%2e%2e/%2e%2e/etc/hostname",
        "/media/notes/",
      ]
    ) {
      const answer = await fetch(`${url}${at}`, { redirect: "manual" })
      expect([answer.status, at]).toEqual([404, at])
    }
  })
})

/**
 * AN `.svg` COMES BACK DEFANGED, which is the other half of a picture's
 * promise and the reason `.svg` could join the picture kind at all.
 *
 * A picture's page draws one in an `<img>`, which will not run it. This route
 * is a URL, though, and a URL can be typed into an address bar, followed from a
 * link, or pulled into a frame by a previewed `.html` next door — and reached
 * that way an SVG is a DOCUMENT OF THIS ORIGIN, with this app's storage and
 * this app's cookies in reach. The route's answer is on the RESPONSE, exactly
 * as the saved page's seal is: `sandbox` with nothing granted (an opaque
 * origin, and no `allow-scripts`, so nothing in it runs at all) and
 * `default-src 'none'` behind it.
 *
 * A CSP header on a response a browser is loading as an IMAGE is ignored, which
 * is what makes this free: the picture page is unaffected.
 */
test("an svg is served with a policy that makes it inert as a document", async () => {
  await withVault(async (url) => {
    const answer = await fetch(`${url}/media/notes/art/diagram.svg`)
    expect(answer.status).toBe(200)
    const policy = answer.headers.get("content-security-policy")
    expect(policy).toContain("sandbox")
    expect(policy).not.toContain("allow-scripts")
    expect(policy).toContain("default-src 'none'")
    expect(answer.headers.get("x-content-type-options")).toBe("nosniff")
    // The BYTES are the file's own, untouched — this route defangs by saying
    // what the file may do, never by editing it.
    expect(await answer.text()).toContain("<script>top.x=1</script>")
  })
})

// …and no other file picks that policy up. A picture is a picture, and a
// response that sandboxed every one of them would be a claim this route cannot
// support about files it has not read. What every answer DOES carry is
// `nosniff`: the engine named a type from the suffix, and a sniffer is a second
// reader of the same bytes that may reach the answer an attacker chose.
test("a raster picture is answered without the svg's policy, and with nosniff", async () => {
  await withVault(async (url) => {
    for (const at of ["/media/notes/art/shot.png", "/media/notes/q3.pdf", "/media/notes/page.css"]) {
      const answer = await fetch(`${url}${at}`)
      expect([at, answer.status]).toEqual([at, 200])
      expect([at, answer.headers.get("content-security-policy")]).toEqual([at, null])
      expect([at, answer.headers.get("x-content-type-options")]).toEqual([at, "nosniff"])
    }
  })
})

/**
 * A `.html` UNDER A FILE, which is a miss the platform reports as something
 * other than "not found" — and BOTH halves of what this route owes for one.
 *
 * `mediaTarget` claims it: the guard is lexical and the suffix is right, so
 * `notes/finishes.md/x.html` reaches the read, where the platform answers
 * `BadResource` (`ENOTDIR`) rather than `NotFound`. The reader gets the 404
 * every other miss gets. The LOG gets nothing, and that is the half worth a
 * test of its own: the path in that URL is the caller's to choose and the
 * request costs them nothing, so a line about it would let anybody who can
 * reach the port write to this server's log at will, with their own text in it.
 *
 * The collector is what makes the negative assertable at all — `withServing`
 * hands over everything the server said, so "it said nothing about this" is a
 * fact here rather than a claim in a comment.
 */
test("a `.html` under a file is a 404 and is not in the log", async () => {
  await withServing({ root: vault() }, async (url, said) => {
    const at = "/media/notes/finishes.md/x.html"
    const answer = await fetch(`${url}${at}`)
    expect(answer.status).toBe(404)
    expect(said.filter((line) => JSON.stringify(line).includes("x.html"))).toEqual([])
  })
})

// THE HOST IS NOT TRUSTED, and the shape of the mistrust is the point: a
// request that names a host this app will not spell gets a policy with no
// sources in it at all. Fail-closed — a page that fetches nothing — rather than
// a policy carrying somebody else's directive.
test("a request whose host is not a host gets a policy that fetches nothing", async () => {
  await withVault(async (url) => {
    const answer = await fetch(`${url}/media/notes/report.html`, {
      headers: { host: "olai.test; img-src *" },
    })
    const policy = answer.headers.get("content-security-policy") ?? ""
    expect(policy).toContain("default-src 'none'")
    expect(policy).not.toContain("img-src *")
  })
})

// A `.html` THAT IS THERE AND WILL NOT OPEN, which is a different failure from
// a file that is not there and is now this route's alone to answer for. The
// preview stopped asking for the body over the wire (`@olai/surface`'s `Head`),
// so nothing else in this process ever opens a saved page for a person: what a
// reader gets is a sealed page that says the file could not be read — not the
// 404 a miss gets, which is the wrong sentence over a heading that already
// named the file — and what an OPERATOR gets is a line in the log, because a
// permission bit nobody can see is exactly what the never-silently-ignore
// rule is about. The sentence on the page is `bodies.ts`'s sentence: one
// story, told the same way.
//
// Root can read a 0000 file, so the assertion is skipped there rather than
// inverted (`@olai/chat`'s `memory.test.ts` makes the same call).
test("a page that cannot be read says so, and IS in the log", async () => {
  if (typeof process.getuid === "function" && process.getuid() === 0) return
  const root = vault()
  const shut = path.join(root, "notes", "shut.html")
  fs.writeFileSync(shut, "<h1>Shut</h1>\n")
  fs.chmodSync(shut, 0o000)
  try {
    await withServing({ root }, async (url, said) => {
      const answer = await fetch(`${url}/media/notes/shut.html`)
      expect(answer.status).toBe(200)
      const body = await answer.text()
      expect(body).toContain(BODY_REFUSED)
      expect(body.indexOf("olai:page-sealed")).toBeLessThan(body.indexOf("<body"))
      // The pair the test above asserts the other way round. A file the
      // directory really holds and this process cannot open is bounded by the
      // disk rather than by what a stranger asks for, so it is exactly what the
      // line is for — and the path is on the ANNOTATION, which is the field a
      // structured reader uses, rather than only in the sentence.
      const complaint = said.find((line) => line.annotations["file"] === "notes/shut.html")
      expect(complaint?.level).toBe("Warn")
      expect(complaint?.message).toContain("notes/shut.html")
    })
  } finally {
    fs.chmodSync(shut, 0o600)
  }
})
