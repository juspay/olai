import { TEST_CLAIMS } from "@olai/format/testlib"
import { pictureOf } from "@olai/format"
import { expect, test } from "bun:test"

import { mediaHref, mediaPath, mediaTarget } from "./media.ts"

test("a file under the root is what the route names", () => {
  expect(mediaTarget(TEST_CLAIMS, "/media/shot.png")).toBe("shot.png")
  expect(mediaTarget(TEST_CLAIMS, "/media/notes/art/shot.JPEG")).toBe("notes/art/shot.JPEG")
  expect(mediaTarget(TEST_CLAIMS, "/media/shot.png?v=2")).toBe("shot.png")
  expect(mediaTarget(TEST_CLAIMS, "/media/report.html?olai-visit=3")).toBe("report.html")
  expect(mediaTarget(TEST_CLAIMS, "/media/shot.png#top")).toBe("shot.png")
})

test("a path that climbs is refused, however it is spelled", () => {
  expect(mediaTarget(TEST_CLAIMS, "/media/../secret.png")).toBeNull()
  expect(mediaTarget(TEST_CLAIMS, "/media/%2e%2e/secret.png")).toBeNull()
  expect(mediaTarget(TEST_CLAIMS, "/media/%2E%2E%2Fsecret.png")).toBeNull()
  expect(mediaTarget(TEST_CLAIMS, "/media/notes/../../secret.png")).toBeNull()
  expect(mediaTarget(TEST_CLAIMS, "/media/a/./shot.png")).toBeNull()
  expect(mediaTarget(TEST_CLAIMS, "/media//shot.png")).toBeNull()
  expect(mediaTarget(TEST_CLAIMS, "/media/a%2fb.png")).toBeNull()
  expect(mediaTarget(TEST_CLAIMS, "/media/a%5cb.png")).toBeNull()
  expect(mediaTarget(TEST_CLAIMS, "/media/shot.png%00.olai")).toBeNull()
  expect(mediaTarget(TEST_CLAIMS, "/media/%zz.png")).toBeNull()
})

test("a page and the parts it draws with are served", () => {
  expect(mediaTarget(TEST_CLAIMS, "/media/report.html")).toBe("report.html")
  expect(mediaTarget(TEST_CLAIMS, "/media/notes/dashboard.html")).toBe("notes/dashboard.html")
  expect(mediaTarget(TEST_CLAIMS, "/media/notes/page.css")).toBe("notes/page.css")
  expect(mediaTarget(TEST_CLAIMS, "/media/notes/chart.js")).toBe("notes/chart.js")
  expect(mediaTarget(TEST_CLAIMS, "/media/notes/chart.MJS")).toBe("notes/chart.MJS")
  expect(mediaTarget(TEST_CLAIMS, "/media/fonts/text.woff2")).toBe("fonts/text.woff2")
  expect(mediaTarget(TEST_CLAIMS, "/media/art/handle.png")).toBe("art/handle.png")
  expect(mediaTarget(TEST_CLAIMS, "/media/logo.svg")).toBe("logo.svg")
  expect(mediaTarget(TEST_CLAIMS, "/media/reports/q3.pdf")).toBe("reports/q3.pdf")
})

test("anything that is not fetched by a page is not served", () => {
  expect(mediaTarget(TEST_CLAIMS, "/media/plan.olai")).toBeNull()
  expect(mediaTarget(TEST_CLAIMS, "/media/notes.md")).toBeNull()
  expect(mediaTarget(TEST_CLAIMS, "/media/data/sales.csv")).toBeNull()
  expect(mediaTarget(TEST_CLAIMS, "/media/data.json")).toBeNull()
  expect(mediaTarget(TEST_CLAIMS, "/media/notes/.env")).toBeNull()
  expect(mediaTarget(TEST_CLAIMS, "/media/")).toBeNull()
  expect(mediaTarget(TEST_CLAIMS, "/media/art/")).toBeNull()
})

test("a path is decoded and guarded whether or not the route would answer it", () => {
  expect(mediaPath("/media/report.html")).toBe("report.html")
  expect(mediaPath("/media/notes/art/shot.png")).toBe("notes/art/shot.png")
  expect(mediaPath("/media/notes.md")).toBe("notes.md")
  expect(mediaTarget(TEST_CLAIMS, "/media/notes.md")).toBeNull()
  expect(mediaPath("/media/plan.olai")).toBe("plan.olai")
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
  expect(mediaTarget(TEST_CLAIMS, "/#kitchen")).toBeNull()
  expect(mediaTarget(TEST_CLAIMS, "/mediashot.png")).toBeNull()
})

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
    expect(mediaTarget(TEST_CLAIMS, mediaHref(file))).toBe(file)
  }
})

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
    const rewritten = mediaHref(pictureOf(TEST_CLAIMS, from, src)!)
    const resolved = new URL(src, HOST + mediaHref(from))
    expect(resolved.href).toBe(HOST + rewritten)
  }
})

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
    expect(mediaTarget(TEST_CLAIMS, clicked.pathname)).toBe(landing)
  }
})

test("a climb past the root is clamped for a document and refused for a preview", () => {
  expect(mediaHref(pictureOf(TEST_CLAIMS, "report.html", "../outside.png")!)).toBe("/media/outside.png")
  expect(new URL("../outside.png", `http://olai.test${mediaHref("report.html")}`).pathname)
    .toBe("/outside.png")
  expect(mediaTarget(TEST_CLAIMS, "/outside.png")).toBeNull()
})
