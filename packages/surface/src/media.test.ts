/**
 * The traversal guard, on its own.
 *
 * `mediaTarget` is the whole of what `/media/*` will answer, and a guard whose
 * only test is a browser opening a page is a guard nobody has tried to get
 * past. These are the ways past it that a URL can spell.
 */

import { expect, test } from "bun:test"

import { mediaHref, mediaTarget } from "./media.ts"

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
  expect(mediaTarget("/media/shot.png%00.jsonl")).toBeNull()
  // A malformed escape names nothing at all.
  expect(mediaTarget("/media/%zz.png")).toBeNull()
})

// Only pictures, and the list is `@olai/format`'s — the same one the renderer
// rewrites a relative `src` against.
test("anything that is not a picture is not served", () => {
  expect(mediaTarget("/media/plan.jsonl")).toBeNull()
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
