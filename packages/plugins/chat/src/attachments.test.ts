/**
 * The conversation's tmp directory: what lands in it, what cannot, and what is
 * left of it afterwards.
 *
 * Against the real filesystem, because every claim here is about one — a path
 * that resolves outside the directory, a symlink that points out of it, a name
 * that would have been a path. A fake would be a second implementation of the
 * thing being checked.
 */

import { expect, test } from "bun:test"
import type { AttachChunk } from "olai-plugin-chat/wire"
import { Effect, Result } from "effect"
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"

import { chunkBase64 } from "@kolu/surface/frame-chunking"
import { MAX_ATTACHMENT_BYTES } from "@olai/surface"

import { make, promptWith, safeName } from "./attachments.ts"

/** Run one, and answer with the value or the refusal — the two things a caller
 *  of these verbs can get. A PROMISE: the writes are asynchronous, which is
 *  the point of them (a chunk is three megabytes and the loop underneath is
 *  the one serving every socket). */
const outcome = <A, E>(effect: Effect.Effect<A, E>) => Effect.runPromise(Effect.result(effect))

const receive = (files: ReturnType<typeof make>, chunk: AttachChunk) => outcome(files.receive(chunk))

const bytes = (size: number) =>
  Buffer.from(Array.from({ length: size }, (_, at) => (at * 31) % 256))

test("a picture arrives in chunks and is one file at the end", async () => {
  const files = make()
  const picture = bytes(4096)
  const pieces = chunkBase64(picture.toString("base64"), 64)
  expect(pieces.length).toBeGreaterThan(1)

  let at: string | undefined
  for (const data of pieces) {
    const answer = await receive(files, {
      name: "shot.png",
      data,
      ...(at === undefined ? {} : { appendTo: at }),
    })
    expect(Result.isSuccess(answer)).toBe(true)
    if (!Result.isSuccess(answer)) return
    // Every chunk answers with the SAME path — which is what makes it usable
    // as the next chunk's continuation token. It disagreed once, on macOS,
    // where `/tmp` is a symlink: the file appeared to be renamed mid-upload.
    if (at !== undefined) expect(answer.success.path).toBe(at)
    at = answer.success.path
  }

  expect(readFileSync(at!).equals(picture)).toBe(true)
  // Not under the served directory, and not readable by anyone else on the
  // host: this is whatever was on somebody's clipboard.
  expect(statSync(at!).mode & 0o777).toBe(0o600)
  // ... and this conversation will have it named on a prompt.
  expect(Result.isSuccess(await outcome(files.claim(at!)))).toBe(true)

  await Effect.runPromise(files.discard)
  expect(existsSync(at!)).toBe(false)
  // ... and the directory with it, so nothing is left behind.
  expect(existsSync(dirname(at!))).toBe(false)
})

test("two pictures of the same name are two files", async () => {
  const files = make()
  const first = await receive(files, { name: "shot.png", data: bytes(8).toString("base64") })
  const second = await receive(files, { name: "shot.png", data: bytes(8).toString("base64") })
  expect(Result.isSuccess(first) && Result.isSuccess(second)).toBe(true)
  if (!Result.isSuccess(first) || !Result.isSuccess(second)) return
  expect(second.success.path).not.toBe(first.success.path)
  // ... and the ANSWER says so. The name a caller keeps is this one and never
  // the one it sent: a tab that kept `shot.png` for both would draw the second
  // picture on the first message's row.
  expect(first.success.name).toBe("shot.png")
  expect(second.success.name).toBe("shot-1.png")
  await Effect.runPromise(files.discard)
})

test("`appendTo` is a continuation token, not a capability", async () => {
  const files = make()
  const started = await receive(files, { name: "shot.png", data: bytes(8).toString("base64") })
  expect(Result.isSuccess(started)).toBe(true)
  if (!Result.isSuccess(started)) return
  const dir = dirname(started.success.path)

  // Somewhere else entirely, and the climb that reaches it.
  const outside = join(mkdtempSync(join(tmpdir(), "olai-elsewhere-")), "victim.png")
  writeFileSync(outside, "before")
  // A symlink PLANTED INSIDE the directory is the interesting one: the name is
  // ours, the file is not, and only resolving both sides catches it.
  const planted = join(dir, "planted.png")
  symlinkSync(outside, planted)

  for (const appendTo of [outside, planted, join(dir, "..", "escape.png")]) {
    const refused = await receive(files, {
      name: "shot.png",
      data: bytes(8).toString("base64"),
      appendTo,
    })
    expect(Result.isFailure(refused)).toBe(true)
  }
  expect(readFileSync(outside, "utf8")).toBe("before")
  await Effect.runPromise(files.discard)
  rmSync(dirname(outside), { recursive: true, force: true })
})

test("a kind the gate does not take is refused, whatever it is called", async () => {
  const files = make()
  // `.svg` is the one that surprises: a picture to a clipboard, a document
  // that can script to this app. The middle name is the reason this test
  // exists at all — the name is sanitized BEFORE it is judged, so a name that
  // would have been a path cannot smuggle an allowed extension past the gate.
  for (const name of ["archive.zip", "shot.png/../archive.zip", "logo.svg"]) {
    expect(Result.isFailure(await receive(files, { name, data: "AAAA" }))).toBe(true)
  }
  // Nothing was created, so there is nothing to clean up.
  await Effect.runPromise(files.discard)
})

test("a document is taken and lands whole, exactly as a picture does", async () => {
  const files = make()
  // The widening, at the end of the wire it is enforced on: the server's gate
  // is the same function the browser's is, so a PDF that passed up there
  // reaches disk down here.
  const stored = await receive(files, {
    name: "Type 04-C.pdf",
    data: bytes(64).toString("base64"),
  })
  expect(Result.isSuccess(stored)).toBe(true)
  if (!Result.isSuccess(stored)) return
  // Sanitized into one safe basename — the space goes, the extension stays,
  // because the extension is what the agent reads the kind from.
  expect(stored.success.name).toBe("Type_04-C.pdf")
  expect(readFileSync(stored.success.path).length).toBe(64)
  await Effect.runPromise(files.discard)
})

test("the cap is on the FILE, so a chunk is judged against the total", async () => {
  const files = make()
  const started = await receive(files, {
    name: "shot.png",
    data: bytes(1024).toString("base64"),
  })
  expect(Result.isSuccess(started)).toBe(true)
  if (!Result.isSuccess(started)) return

  // Legal on its own — it is the cap exactly — and illegal as a CONTINUATION
  // of a file that already has bytes in it. Judging each chunk alone is how a
  // capped upload becomes an uncapped one nobody refused.
  const overflowing = Buffer.alloc(MAX_ATTACHMENT_BYTES).toString("base64")
  const refused = await receive(files, {
    name: "shot.png",
    data: overflowing,
    appendTo: started.success.path,
  })
  expect(Result.isFailure(refused)).toBe(true)
  // Refused BEFORE the write, so the file is what it was.
  expect(statSync(started.success.path).size).toBe(1024)
  await Effect.runPromise(files.discard)
})

// The server end of the in-flight-attach race: a conversation can be left
// while an upload is still running, and the chunk that arrives afterwards
// names a file in a directory that no longer exists. It is REFUSED rather
// than recreated — a continuation is only ever a continuation — and the path
// stops being claimable, which is what keeps it out of a prompt.
test("a chunk continuing a conversation that has been left is refused", async () => {
  const files = make()
  const started = await receive(files, {
    name: "shot.png",
    data: bytes(8).toString("base64"),
  })
  expect(Result.isSuccess(started)).toBe(true)
  if (!Result.isSuccess(started)) return

  await Effect.runPromise(files.discard)

  const refused = await receive(files, {
    name: "shot.png",
    data: bytes(8).toString("base64"),
    appendTo: started.success.path,
  })
  expect(Result.isFailure(refused)).toBe(true)
  // ... and a prompt cannot name it either, which is the same check.
  expect(Result.isFailure(await outcome(files.claim(started.success.path)))).toBe(true)

  // A FIRST chunk after the same discard is fine: it belongs to whatever
  // conversation is current now, and gets a directory of its own.
  const next = await receive(files, {
    name: "shot.png",
    data: bytes(8).toString("base64"),
  })
  expect(Result.isSuccess(next)).toBe(true)
  if (!Result.isSuccess(next)) return
  expect(dirname(next.success.path)).not.toBe(dirname(started.success.path))
  await Effect.runPromise(files.discard)
})

test("a name is a label, never a path", async () => {
  expect(safeName("../../etc/passwd.png")).toBe("passwd.png")
  expect(safeName("/tmp/shot.png")).toBe("shot.png")
  expect(safeName("shot; rm -rf ~.png")).toBe("shot__rm_-rf__.png")
  // Unicode survives — a name is for a person to read.
  expect(safeName("bildschirmfoto_märz.png")).toBe("bildschirmfoto_märz.png")
  // Never empty, and never hidden.
  expect(safeName("...")).toBe("attachment")
  expect(safeName("")).toBe("attachment")
})

// A name no filesystem will take is still a NAME — cutting it is what this
// function does to every other kind of unusable one. Left whole, the write
// fails with ENAMETOOLONG, and a person reads that as the connection breaking
// rather than as something about their file.
test("a name too long for a filesystem is cut, not carried to the write", async () => {
  const long = safeName(`${"a".repeat(300)}.png`)
  expect(Buffer.byteLength(long)).toBeLessThanOrEqual(200)
  // The extension survives the cut: the agent reads the picture's kind from it.
  expect(long.endsWith(".png")).toBe(true)

  // Cut by BYTES and never through a character — a name can be entirely
  // three-byte ones, and half of one is not a character at all.
  const wide = safeName(`${"ä".repeat(300)}.png`)
  expect(Buffer.byteLength(wide)).toBeLessThanOrEqual(200)
  expect(wide.normalize("NFC")).toBe(wide)

  // ... and it is a name the disk actually takes, which is the whole point.
  const files = make()
  const stored = await receive(files, {
    name: `${"a".repeat(300)}.png`,
    data: bytes(8).toString("base64"),
  })
  expect(Result.isSuccess(stored)).toBe(true)
  await Effect.runPromise(files.discard)
})

test("what the agent is asked is the path, as text", async () => {
  expect(promptWith("what is this", [])).toBe("what is this")
  expect(promptWith("what is this", ["/tmp/olai-chat-x/shot.png"])).toBe(
    "what is this\n\nAttached file: /tmp/olai-chat-x/shot.png",
  )
  // A file on its own is a message: no leading blank line, nothing else.
  expect(promptWith("", ["/tmp/olai-chat-x/shot.png"])).toBe(
    "Attached file: /tmp/olai-chat-x/shot.png",
  )
  // FILE, not image, and this is the assertion that says so: the line carries
  // PDFs and text too, and an agent told a `.pdf` is an image has been told
  // something wrong about a file it is about to open.
  expect(promptWith("what is this", ["/tmp/olai-chat-x/Type 04-C.pdf"])).toBe(
    "what is this\n\nAttached file: /tmp/olai-chat-x/Type 04-C.pdf",
  )
})

test("an upload cannot cross a discarded lifetime even before its first chunk", async () => {
  const files = make()
  const old = files.scope()
  await Effect.runPromise(files.discard)
  expect(files.scope()).not.toBe(old)
  const refused = await receive(files, { name: "notes.txt", data: bytes(5).toString("base64"), uploadScope: old })
  expect(Result.isFailure(refused)).toBe(true)
  const accepted = await receive(files, { name: "notes.txt", data: bytes(5).toString("base64"), uploadScope: files.scope() })
  expect(Result.isSuccess(accepted)).toBe(true)
  await Effect.runPromise(files.discard)
})

for (const initial of [true, false]) {
  test(`simultaneous same-name uploads share one ${initial ? "new" : "existing"} directory without overwriting`, async () => {
    const files = make()
    const paths: string[] = []
    try {
      if (!initial) {
        const warm = await Effect.runPromise(files.receive({ name: "warm.txt", data: "eA==" }))
        paths.push(warm.path)
      }
      const texts = Array.from({ length: 12 }, (_, i) => `independent upload ${i}`)
      const results = await Promise.all(texts.map((text) => Effect.runPromise(files.receive({
        name: "collision.txt", data: Buffer.from(text).toString("base64"),
      }))))
      paths.push(...results.map((one) => one.path))
      expect(new Set(paths.map(dirname)).size).toBe(1)
      expect(new Set(results.map((one) => one.path)).size).toBe(texts.length)
      for (const [i, result] of results.entries()) {
        expect(readFileSync(result.path, "utf8")).toBe(texts[i]!)
        expect(Result.isSuccess(await outcome(files.claim(result.path)))).toBe(true)
      }
      await Effect.runPromise(files.discard)
      expect(paths.every((path) => !existsSync(path))).toBe(true)
    } finally {
      await Effect.runPromise(files.discard)
      for (const dir of new Set(paths.map(dirname))) rmSync(dir, { recursive: true, force: true })
    }
  })
}
