import { mkdtempSync, rmSync, symlinkSync, truncateSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, expect, test } from "bun:test"
import { Effect, Result } from "effect"
import { MAX_ENCLOSED_BYTES, readEnclosures, typeOf, validateEnclosures, withinCap } from "./enclosures.ts"

const root = mkdtempSync(join(tmpdir(), "mail-enclosures-"))
afterAll(() => rmSync(root, { recursive: true, force: true }))
const file = (name: string, contents: string | Buffer = "hello") => {
  const path = join(root, name)
  writeFileSync(path, contents)
  return path
}
const read = (list: Parameters<typeof readEnclosures>[0]) => Effect.runPromise(Effect.result(readEnclosures(list)))

test("an argument list is refused for everything a caller can get wrong about it", () => {
  const reasons = (list: Parameters<typeof validateEnclosures>[0]) => {
    const result = validateEnclosures(list)
    expect(result._tag).toBe("Failure")
    return result._tag === "Failure" ? result.failure.reason : ""
  }
  expect(reasons([{ path: "invoice.pdf" }])).toBe("mail attachments need an absolute path: invoice.pdf")
  expect(reasons([{ path: "~/invoice.pdf" }])).toContain("absolute path")
  expect(reasons([{ path: "  " }])).toContain("absolute path")
  expect(reasons([{ path: "/tmp/in\nvoice.pdf" }])).toBe("mail attachment paths cannot contain CR, LF or control characters")
  expect(reasons([{ path: "/tmp/invoice.pdf", filename: "in\r\nvoice.pdf" }])).toBe("mail attachment filenames cannot contain CR, LF or control characters")
  expect(reasons([{ path: "/tmp/invoice.pdf", type: "application" }])).toBe('malformed mail attachment content type: "application"')
  expect(reasons([{ path: "/tmp/invoice.pdf", type: "application/pdf; name=x" }])).toContain("malformed")
  expect(reasons([{ path: "/" }])).toBe("this attachment has no filename to arrive under: /")
  expect(reasons([{ path: "/tmp/a.pdf", filename: "  " }])).toContain("no filename to arrive under")
  expect(reasons([{ path: "/tmp/a.pdf", filename: ".." }])).toContain("no filename to arrive under")
  expect(reasons([{ path: "/tmp/a.pdf" }, { path: "/elsewhere/a.pdf" }])).toBe("two mail attachments would arrive as a.pdf; give one of them its own filename")
  expect(reasons(Array.from({ length: 11 }, (_, i) => ({ path: `/tmp/a${i}.pdf` })))).toBe("mail drafts carry at most 10 attachments")
  expect(validateEnclosures(Array.from({ length: 10 }, (_, i) => ({ path: `/tmp/a${i}.pdf` })))._tag).toBe("Success")
  expect(validateEnclosures()._tag).toBe("Success")
})

test("names default to the file's own, overrides are basenames, and long names are capped", () => {
  const named = Result.getOrThrow(validateEnclosures([
    { path: "/tmp/reports/Q3 invoice.pdf" },
    { path: "/tmp/reports/x.bin", filename: "../../etc/passwd" },
    { path: "/tmp/reports/y.bin", filename: `${"é".repeat(200)}.txt` },
    { path: "/tmp/reports/z.bin", filename: "Café ☕.txt" },
  ]))
  expect(named.map(one => one.filename)).toEqual(["Q3 invoice.pdf", "passwd", "é".repeat(120), "Café ☕.txt"])
  expect([...named[2]!.filename].length).toBe(120)
})

test("content types come from the caller, then the extension table, then octet-stream", () => {
  const named = Result.getOrThrow(validateEnclosures([
    { path: "/tmp/a.pdf" },
    { path: "/tmp/b.PNG" },
    { path: "/tmp/c.jpeg" },
    { path: "/tmp/d.docx" },
    { path: "/tmp/e.bin" },
    { path: "/tmp/f.pdf", type: "application/x-invoice" },
    { path: "/tmp/g.bin", filename: "g.csv" },
    { path: "/tmp/h.txt", filename: "h" },
  ]))
  expect(named.map(one => one.type)).toEqual([
    "application/pdf", "image/png", "image/jpeg", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/octet-stream", "application/x-invoice", "text/csv", "text/plain",
  ])
  expect(typeOf("notes.md", "/tmp/notes.md")).toBe("text/markdown")
  expect(typeOf("clip.mov", "/tmp/clip.mov")).toBe("video/quicktime")
})

test("files are read through realpath, and anything that is not a readable regular file refuses", async () => {
  const path = file("invoice.pdf", "%PDF-1.4 invoice")
  symlinkSync(path, join(root, "link.pdf"))
  const read1 = await read([{ path: join(root, "link.pdf"), filename: "invoice.pdf" }])
  expect(read1._tag).toBe("Success")
  if (read1._tag === "Success") {
    expect(read1.success).toHaveLength(1)
    expect(read1.success[0]!.data.toString()).toBe("%PDF-1.4 invoice")
    expect(read1.success[0]).toMatchObject({ filename: "invoice.pdf", type: "application/pdf" })
  }
  const missing = await read([{ path: join(root, "nowhere.pdf") }])
  expect(missing).toMatchObject({ _tag: "Failure", failure: { reason: `there is no file to attach at ${join(root, "nowhere.pdf")}` } })
  const directory = await read([{ path: root, filename: "root.zip" }])
  expect(directory).toMatchObject({ _tag: "Failure", failure: { reason: `${root} is not a file, so it cannot be attached` } })
  expect(await read([])).toMatchObject({ _tag: "Success", success: [] })
})

test("the cap is one rule, applied to whatever sizes are in hand", () => {
  // The reader applies this twice: to the `stat` sizes, and to the bytes it
  // actually got. A file being uploaded into a conversation grows between the
  // two, and a draft that was under the ceiling a moment ago is still over it.
  expect(withinCap([])._tag).toBe("Success")
  expect(withinCap([{ filename: "a.bin", bytes: MAX_ENCLOSED_BYTES }])._tag).toBe("Success")
  expect(withinCap([{ filename: "a.bin", bytes: MAX_ENCLOSED_BYTES - 1 }, { filename: "b.bin", bytes: 1 }])._tag).toBe("Success")
  expect(withinCap([{ filename: "a.bin", bytes: MAX_ENCLOSED_BYTES + 1 }])).toMatchObject({ _tag: "Failure", failure: { reason: "a.bin is over 25 MB, which is more than Gmail takes" } })
  expect(withinCap([{ filename: "a.bin", bytes: MAX_ENCLOSED_BYTES }, { filename: "b.bin", bytes: 1 }]))
    .toMatchObject({ _tag: "Failure", failure: { reason: "these attachments come to more than 25 MB together, which is more than Gmail takes" } })
})

test("a file that grows while the draft is being read is refused on the bytes in hand", async () => {
  // The realistic case is an upload still streaming into the conversation's
  // directory. The growth is staged on a timer rather than raced to a
  // particular await: whichever of the two checks sees it — the `stat` sizes or
  // the bytes read — the draft is refused, and with the same sentence.
  const first = file("first.bin", "")
  truncateSync(first, 20 * 1024 * 1024)
  const growing = file("growing.bin", "")
  truncateSync(growing, 8)
  const timer = setTimeout(() => truncateSync(growing, MAX_ENCLOSED_BYTES), 0)
  try {
    expect(await read([{ path: first }, { path: growing }]))
      .toMatchObject({ _tag: "Failure", failure: { reason: "these attachments come to more than 25 MB together, which is more than Gmail takes" } })
  } finally { clearTimeout(timer) }
})

test("a file over 25 MB, and a list over 25 MB together, are refused before any of it is read", async () => {
  const big = file("big.bin", "")
  truncateSync(big, MAX_ENCLOSED_BYTES + 1)
  expect(await read([{ path: big }])).toMatchObject({ _tag: "Failure", failure: { reason: "big.bin is over 25 MB, which is more than Gmail takes" } })
  truncateSync(big, MAX_ENCLOSED_BYTES)
  const half = file("half.bin", "")
  truncateSync(half, 1024)
  expect(await read([{ path: big }, { path: half }])).toMatchObject({ _tag: "Failure", failure: { reason: "these attachments come to more than 25 MB together, which is more than Gmail takes" } })
  truncateSync(big, 8)
  expect(await read([{ path: big }, { path: half }])).toMatchObject({ _tag: "Success" })
})
