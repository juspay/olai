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
// pictures: a stylesheet and a script beside the file are addresses too.
test("a page's pictures, stylesheet and script are served", async () => {
  await withVault(async (url) => {
    for (
      const [at, type] of [
        ["/media/notes/art/shot.png", "image/png"],
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
