/**
 * The traversal guard, on its own.
 *
 * `mediaTarget` is the whole of what `/media/*` will answer, and a guard whose
 * only test is a browser opening a page is a guard nobody has tried to get
 * past. These are the ways past it that a URL can spell.
 */

import { pictureOf } from "@olai/format"
import { expect, test } from "bun:test"

import { mediaBase, mediaHref, mediaTarget } from "./media.ts"

test("a picture under the root is what the route names", () => {
  expect(mediaTarget("/media/shot.png")).toBe("shot.png")
  expect(mediaTarget("/media/notes/art/shot.JPEG")).toBe("notes/art/shot.JPEG")
  // The query and the fragment are not part of the name.
  expect(mediaTarget("/media/shot.png?v=2")).toBe("shot.png")
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

// Only pictures, and the list is `@olai/format`'s — the same one the renderer
// rewrites a relative `src` against.
test("anything that is not a picture is not served", () => {
  expect(mediaTarget("/media/plan.olai")).toBeNull()
  expect(mediaTarget("/media/notes.md")).toBeNull()
  // An SVG is a document that can script.
  expect(mediaTarget("/media/logo.svg")).toBeNull()
  expect(mediaTarget("/media/")).toBeNull()
  expect(mediaTarget("/media/art/")).toBeNull()
})

test("a request that is not this route's is not this route's", () => {
  expect(mediaTarget("/n/kitchen")).toBeNull()
  expect(mediaTarget("/mediashot.png")).toBeNull()
})

// The client builds this URL and the server takes it apart; the round trip is
// the only thing that says the two agree.
test("the href a picture is fetched from reads back as the picture", () => {
  for (const file of ["shot.png", "notes/art/a b.png", "a#b.png", "a?b.png"]) {
    expect(mediaTarget(mediaHref(file))).toBe(file)
  }
})

// ── the base a sealed preview resolves against ─────────────────────────

test("a file's base is its own directory, and a root file's is the route", () => {
  expect(mediaBase("report.html")).toBe("/media/")
  expect(mediaBase("notes/report.html")).toBe("/media/notes/")
  expect(mediaBase("a/b/c/deep.html")).toBe("/media/a/b/c/")
  // A directory name is somebody's, and it lands in an HTML attribute at the
  // other end (`sealed.ts`): the same per-segment encoding the whole route is
  // built on is what makes that safe as well as correct.
  expect(mediaBase(`he said "hi"/report.html`)).toBe("/media/he%20said%20%22hi%22/")
})

/**
 * THE TWO WRITERS AGREE, which is the claim the preview is built on.
 *
 * A picture beside a `.md` is REWRITTEN — `@olai/format` resolves the address
 * and {@link mediaHref} spells the URL. A picture beside a `.html` is not
 * touched at all; the browser resolves it against {@link mediaBase}. Two
 * mechanisms, and the promise is that they land on the same byte — so it is
 * asserted here, against the browser's own resolver, rather than described in
 * a PR.
 */
test("a preview's base lands where the markdown rewrite would have", () => {
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
    const resolved = new URL(src, HOST + mediaBase(from))
    expect(resolved.href).toBe(HOST + rewritten)
  }
})

// …and the ONE address where they do not, named rather than left to be
// discovered: a `..` that climbs past the served root is CLAMPED for a
// document (`resolveRelative` drops it, so the root's own file is drawn) and
// REFUSED for a preview (the URL parser normalises the climb out of `/media/`,
// which is outside the seal's `img-src` and outside this route). Both stay
// inside the vault; the preview simply draws a subset of what the document
// beside it may. It is asserted so that a change to either side has to come
// past this test and say which answer it meant.
test("a climb past the root is clamped for a document and refused for a preview", () => {
  expect(mediaHref(pictureOf("report.html", "../outside.png")!)).toBe("/media/outside.png")
  expect(new URL("../outside.png", `http://olai.test${mediaBase("report.html")}`).pathname)
    .toBe("/outside.png")
  expect(mediaTarget("/outside.png")).toBeNull()
})
