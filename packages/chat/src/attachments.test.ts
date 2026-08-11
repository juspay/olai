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

import { chunkBase64, MAX_ATTACHMENT_BYTES } from "@olai/surface"

import { make, promptWith, safeName } from "./attachments.ts"

/** Run one, and answer with the value or the refusal — the two things a caller
 *  of these verbs can get. */
const outcome = <A, E>(effect: Effect.Effect<A, E>) => Effect.runSync(Effect.result(effect))

const receive = (files: ReturnType<typeof make>, chunk: {
  name: string
  data: string
  appendTo?: string
}) => outcome(files.receive(chunk))

const bytes = (size: number) =>
  Buffer.from(Array.from({ length: size }, (_, at) => (at * 31) % 256))

test("a picture arrives in chunks and is one file at the end", () => {
  const files = make()
  const picture = bytes(4096)
  const pieces = chunkBase64(picture.toString("base64"), 64)
  expect(pieces.length).toBeGreaterThan(1)

  let at: string | undefined
  for (const data of pieces) {
    const answer = receive(files, {
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
  expect(files.holds(at!)).toBe(true)

  Effect.runSync(files.discard)
  expect(existsSync(at!)).toBe(false)
  // ... and the directory with it, so nothing is left behind.
  expect(existsSync(dirname(at!))).toBe(false)
})

test("two pictures of the same name are two files", () => {
  const files = make()
  const first = receive(files, { name: "shot.png", data: bytes(8).toString("base64") })
  const second = receive(files, { name: "shot.png", data: bytes(8).toString("base64") })
  expect(Result.isSuccess(first) && Result.isSuccess(second)).toBe(true)
  if (!Result.isSuccess(first) || !Result.isSuccess(second)) return
  expect(second.success.path).not.toBe(first.success.path)
  // ... and the ANSWER says so. The name a caller keeps is this one and never
  // the one it sent: a tab that kept `shot.png` for both would draw the second
  // picture on the first message's row.
  expect(first.success.name).toBe("shot.png")
  expect(second.success.name).toBe("shot-1.png")
  Effect.runSync(files.discard)
})

test("`appendTo` is a continuation token, not a capability", () => {
  const files = make()
  const started = receive(files, { name: "shot.png", data: bytes(8).toString("base64") })
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
    const refused = receive(files, {
      name: "shot.png",
      data: bytes(8).toString("base64"),
      appendTo,
    })
    expect(Result.isFailure(refused)).toBe(true)
  }
  expect(readFileSync(outside, "utf8")).toBe("before")
  Effect.runSync(files.discard)
  rmSync(dirname(outside), { recursive: true, force: true })
})

test("a file that is not a picture is refused, whatever it is called", () => {
  const files = make()
  // The name is sanitized BEFORE it is judged, so a name that would have been
  // a path cannot smuggle a picture extension past the gate either.
  for (const name of ["notes.txt", "shot.png/../notes.txt", "logo.svg"]) {
    expect(Result.isFailure(receive(files, { name, data: "AAAA" }))).toBe(true)
  }
  // Nothing was created, so there is nothing to clean up.
  Effect.runSync(files.discard)
})

test("the cap is on the FILE, so a chunk is judged against the total", () => {
  const files = make()
  const started = receive(files, {
    name: "shot.png",
    data: bytes(1024).toString("base64"),
  })
  expect(Result.isSuccess(started)).toBe(true)
  if (!Result.isSuccess(started)) return

  // Legal on its own — it is the cap exactly — and illegal as a CONTINUATION
  // of a file that already has bytes in it. Judging each chunk alone is how a
  // capped upload becomes an uncapped one nobody refused.
  const overflowing = Buffer.alloc(MAX_ATTACHMENT_BYTES).toString("base64")
  const refused = receive(files, {
    name: "shot.png",
    data: overflowing,
    appendTo: started.success.path,
  })
  expect(Result.isFailure(refused)).toBe(true)
  // Refused BEFORE the write, so the file is what it was.
  expect(statSync(started.success.path).size).toBe(1024)
  Effect.runSync(files.discard)
})

test("a name is a label, never a path", () => {
  expect(safeName("../../etc/passwd.png")).toBe("passwd.png")
  expect(safeName("/tmp/shot.png")).toBe("shot.png")
  expect(safeName("shot; rm -rf ~.png")).toBe("shot__rm_-rf__.png")
  // Unicode survives — a name is for a person to read.
  expect(safeName("bildschirmfoto_märz.png")).toBe("bildschirmfoto_märz.png")
  // Never empty, and never hidden.
  expect(safeName("...")).toBe("attachment")
  expect(safeName("")).toBe("attachment")
})

test("what the agent is asked is the path, as text", () => {
  expect(promptWith("what is this", [])).toBe("what is this")
  expect(promptWith("what is this", ["/tmp/olai-chat-x/shot.png"])).toBe(
    "what is this\n\nAttached image: /tmp/olai-chat-x/shot.png",
  )
  // A picture on its own is a message: no leading blank line, nothing else.
  expect(promptWith("", ["/tmp/olai-chat-x/shot.png"])).toBe(
    "Attached image: /tmp/olai-chat-x/shot.png",
  )
})
