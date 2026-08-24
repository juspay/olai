/**
 * The traversal guard, on its own.
 *
 * `mediaTarget` is the whole of what `/media/*` will answer, and a guard whose
 * only test is a browser opening a page is a guard nobody has tried to get
 * past. These are the ways past it that a URL can spell.
 */

import { pictureOf } from "@olai/format"
import { expect, test } from "bun:test"

import { mediaHref, mediaPath, mediaTarget } from "./media.ts"

test("a file under the root is what the route names", () => {
  expect(mediaTarget("/media/shot.png")).toBe("shot.png")
  expect(mediaTarget("/media/notes/art/shot.JPEG")).toBe("notes/art/shot.JPEG")
  // The query and the fragment are not part of the name — which is also what
  // makes the preview frame's own visit counter (`Hypertext.tsx`) invisible
  // here: it names no file and reaches no guard.
  expect(mediaTarget("/media/shot.png?v=2")).toBe("shot.png")
  expect(mediaTarget("/media/report.html?olai-visit=3")).toBe("report.html")
  expect(mediaTarget("/media/shot.png#top")).toBe("shot.png")
})

// Percent-escapes are decoded FIRST and judged after, so a climbing segment is
// refused however it was spelled — the guard never sees a `..` it has to
// resolve.
test("a path that climbs is refused, however it is spelled", () => {
  expect(mediaTarget("/media/../secret.png")).toBeNull()
  expect(mediaTarget("/media/%2e%2e/secret.png")).toBeNull()
  expect(mediaTarget("/media/%2E%2E%2Fsecret.png")).toBeNull()
  expect(mediaTarget("/media/notes/../../secret.png")).toBeNull()
  expect(mediaTarget("/media/a/./shot.png")).toBeNull()
  expect(mediaTarget("/media//shot.png")).toBeNull()
  // A separator smuggled in as an escape is one segment claiming to be two.
  expect(mediaTarget("/media/a%2fb.png")).toBeNull()
  expect(mediaTarget("/media/a%5cb.png")).toBeNull()
  expect(mediaTarget("/media/shot.png%00.olai")).toBeNull()
  // A malformed escape names nothing at all.
  expect(mediaTarget("/media/%zz.png")).toBeNull()
})

// WHAT A PAGE IS MADE OF is what this route answers, and the list is
// `@olai/format`'s `isAsset`: the page itself (a preview frame's `src`), the
// pictures it draws, the stylesheet it was saved beside, the script it was
// built with, the font it embeds. One address space, the vault's own directory
// shape, which is what makes a saved page's relative addresses correct without
// anything of the file being rewritten.
test("a page and the parts it draws with are served", () => {
  expect(mediaTarget("/media/report.html")).toBe("report.html")
  expect(mediaTarget("/media/notes/dashboard.html")).toBe("notes/dashboard.html")
  expect(mediaTarget("/media/notes/page.css")).toBe("notes/page.css")
  expect(mediaTarget("/media/notes/chart.js")).toBe("notes/chart.js")
  expect(mediaTarget("/media/notes/chart.MJS")).toBe("notes/chart.MJS")
  expect(mediaTarget("/media/fonts/text.woff2")).toBe("fonts/text.woff2")
  // The three kinds whose PAGE is drawn by pointing at the file — a picture
  // (every spelling, `.svg` included) and a `.pdf` beside the saved page that
  // was here first. What each of them is drawn IN is the client's
  // (`@olai/web`'s faces); that they are fetched from here is this route's.
  expect(mediaTarget("/media/art/handle.png")).toBe("art/handle.png")
  expect(mediaTarget("/media/logo.svg")).toBe("logo.svg")
  expect(mediaTarget("/media/reports/q3.pdf")).toBe("reports/q3.pdf")
})

// …and everything else is not. A file whose page is handed its CONTENT — an
// outline's records, a document's text, a `.csv`'s rows — has a page of its
// own, so a route handing it over raw would be a second way to read it with no
// argument for the first. Data nothing has a page for is nobody's, and a
// directory is not a file.
test("anything that is not fetched by a page is not served", () => {
  expect(mediaTarget("/media/plan.olai")).toBeNull()
  expect(mediaTarget("/media/notes.md")).toBeNull()
  expect(mediaTarget("/media/data/sales.csv")).toBeNull()
  expect(mediaTarget("/media/data.json")).toBeNull()
  expect(mediaTarget("/media/notes/.env")).toBeNull()
  expect(mediaTarget("/media/")).toBeNull()
  expect(mediaTarget("/media/art/")).toBeNull()
})

// ── the same address, asked the other question ─────────────────────────

/**
 * THE DECODER WITHOUT THE ALLOWLIST, which is the whole difference between the
 * two exports and the reason the split exists.
 *
 * A click inside a preview asks which FILE OF THE VAULT an address names, not
 * what the route may answer, and the two are deliberately not the same list: a
 * `.md` has a page of its own and is never served raw, so the route refuses it
 * and a reader following a link to it should still land on that page
 * (`./seal.ts`'s `FOLLOW`). Every other line of the guard is shared, which is
 * the point of it being one function — so the cases below are the same climbs
 * as above, asked of the caller that has no allowlist behind it.
 */
test("a path is decoded and guarded whether or not the route would answer it", () => {
  // The route's own answer, unchanged, and the same one this gives.
  expect(mediaPath("/media/report.html")).toBe("report.html")
  expect(mediaPath("/media/notes/art/shot.png")).toBe("notes/art/shot.png")
  // …and the files the ROUTE refuses, which a click may still name. This is the
  // one divergence, and it is the reason for the split.
  expect(mediaPath("/media/notes.md")).toBe("notes.md")
  expect(mediaTarget("/media/notes.md")).toBeNull()
  expect(mediaPath("/media/plan.olai")).toBe("plan.olai")
  // The guard itself is not relaxed by an inch: every climb, every smuggled
  // separator and every malformed escape falls the same way it does above.
  for (
    const url of [
      "/media/../secret.md",
      "/media/%2e%2e/secret.md",
      "/media/notes/../../secret.md",
      "/media/a/./notes.md",
      "/media//notes.md",
      "/media/a%2fb.md",
      "/media/a%5cb.md",
      "/media/notes.md%00.olai",
      "/media/%zz.md",
      "/media/",
      "/notes.md",
      "",
    ]
  ) {
    expect(mediaPath(url)).toBeNull()
  }
})

test("a request that is not this route's is not this route's", () => {
  expect(mediaTarget("/#kitchen")).toBeNull()
  expect(mediaTarget("/mediashot.png")).toBeNull()
})

// The client builds this URL and the server takes it apart; the round trip is
// the only thing that says the two agree. Both writers are here: the markdown
// renderer rewriting a picture's `src`, and the preview frame pointing itself
// at a page.
test("the href a file is fetched from reads back as the file", () => {
  for (
    const file of [
      "shot.png",
      "notes/art/a b.png",
      "a#b.png",
      "a?b.png",
      "report.html",
      `he said "hi"/report.html`,
    ]
  ) {
    expect(mediaTarget(mediaHref(file))).toBe(file)
  }
})

// ── what a relative address in a previewed page resolves to ────────────

/**
 * THE TWO WRITERS AGREE, which is the claim the preview is built on.
 *
 * A picture beside a `.md` is REWRITTEN — `@olai/format` resolves the address
 * and {@link mediaHref} spells the URL. A picture beside a `.html` is not
 * touched at all; the browser resolves it against the page's OWN URL, which is
 * {@link mediaHref} of the page. Two mechanisms, and the promise is that they
 * land on the same byte — so it is asserted here, against the browser's own
 * resolver, rather than described in a PR.
 *
 * This is where the seal's `<base>` used to be tested, and its absence is the
 * point: the page has a real address now, so there is nothing to re-base and
 * nothing that could be re-based wrongly.
 */
test("a picture beside a previewed page lands where the markdown rewrite would have", () => {
  const HOST = "http://olai.test"
  for (
    const [from, src] of [
      ["report.html", "art/shot.png"],
      ["notes/report.html", "art/shot.png"],
      ["notes/report.html", "./shot.png"],
      ["notes/deep/report.html", "../art/shot.png"],
      ["notes/report.html", "art/a b.png"],
    ] as const
  ) {
    const rewritten = mediaHref(pictureOf(from, src)!)
    const resolved = new URL(src, HOST + mediaHref(from))
    expect(resolved.href).toBe(HOST + rewritten)
  }
})

// A RELATIVE LINK lands on the file beside it, which is the whole of what
// giving the page a real URL bought (`html-preview-relative-links`). Under the
// seal's old `<base>` at the media route's DIRECTORY this was the same
// arithmetic and it worked for pictures; what it could not do was answer a
// link, because the address it produced was a page the route did not serve.
// Both halves are read here: the URL a click produces, and that the route
// recognises it as the file next door.
test("a relative link in a page lands on the page beside it", () => {
  const HOST = "http://olai.test"
  for (
    const [from, href, landing] of [
      ["report.html", "other.html", "other.html"],
      ["notes/report.html", "other.html", "notes/other.html"],
      ["notes/report.html", "../top.html", "top.html"],
      ["notes/deep/report.html", "../other.html", "notes/other.html"],
    ] as const
  ) {
    const clicked = new URL(href, HOST + mediaHref(from))
    expect(clicked.href).toBe(HOST + mediaHref(landing))
    expect(mediaTarget(clicked.pathname)).toBe(landing)
  }
})

// …and the ONE address where the two writers do not agree, named rather than
// left to be discovered: a `..` that climbs past the served root is CLAMPED for
// a document (`resolveRelative` drops it, so the root's own file is drawn) and
// REFUSED for a preview (the URL parser normalises the climb out of `/media/`,
// where this route cannot follow). Both stay inside the vault; the preview is
// the stricter of the two. It is asserted so that a change to either side has
// to come past this test and say which answer it meant.
test("a climb past the root is clamped for a document and refused for a preview", () => {
  expect(mediaHref(pictureOf("report.html", "../outside.png")!)).toBe("/media/outside.png")
  expect(new URL("../outside.png", `http://olai.test${mediaHref("report.html")}`).pathname)
    .toBe("/outside.png")
  expect(mediaTarget("/outside.png")).toBeNull()
})
