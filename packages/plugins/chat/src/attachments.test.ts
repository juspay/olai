import { expect, test } from "bun:test"
import type { AttachChunk } from "olai-plugin-chat/wire"
import { Effect, Result } from "effect"
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  truncateSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"

import { chunkBase64 } from "@kolu/surface/frame-chunking"
import { MAX_ATTACHMENT_BYTES, MAX_VIDEO_ATTACHMENT_BYTES } from "@olai/surface"

import { make, promptWith, safeName } from "./attachments.ts"

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
    if (at !== undefined) expect(answer.success.path).toBe(at)
    at = answer.success.path
  }

  expect(readFileSync(at!).equals(picture)).toBe(true)
  expect(statSync(at!).mode & 0o777).toBe(0o600)
  expect(Result.isSuccess(await outcome(files.claim(at!)))).toBe(true)

  await Effect.runPromise(files.discard)
  expect(existsSync(at!)).toBe(false)
  expect(existsSync(dirname(at!))).toBe(false)
})

test("two pictures of the same name are two files", async () => {
  const files = make()
  const first = await receive(files, { name: "shot.png", data: bytes(8).toString("base64") })
  const second = await receive(files, { name: "shot.png", data: bytes(8).toString("base64") })
  expect(Result.isSuccess(first) && Result.isSuccess(second)).toBe(true)
  if (!Result.isSuccess(first) || !Result.isSuccess(second)) return
  expect(second.success.path).not.toBe(first.success.path)
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

  const outside = join(mkdtempSync(join(tmpdir(), "olai-elsewhere-")), "victim.png")
  writeFileSync(outside, "before")
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
  for (const name of ["archive.zip", "shot.png/../archive.zip", "logo.svg"]) {
    expect(Result.isFailure(await receive(files, { name, data: "AAAA" }))).toBe(true)
  }
  await Effect.runPromise(files.discard)
})

test("a document is taken and lands whole, exactly as a picture does", async () => {
  const files = make()
  const stored = await receive(files, {
    name: "Type 04-C.pdf",
    data: bytes(64).toString("base64"),
  })
  expect(Result.isSuccess(stored)).toBe(true)
  if (!Result.isSuccess(stored)) return
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

  const overflowing = Buffer.alloc(MAX_ATTACHMENT_BYTES).toString("base64")
  const refused = await receive(files, {
    name: "shot.png",
    data: overflowing,
    appendTo: started.success.path,
  })
  expect(Result.isFailure(refused)).toBe(true)
  expect(statSync(started.success.path).size).toBe(1024)
  await Effect.runPromise(files.discard)
})

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
  expect(Result.isFailure(await outcome(files.claim(started.success.path)))).toBe(true)

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
  expect(safeName("bildschirmfoto_märz.png")).toBe("bildschirmfoto_märz.png")
  expect(safeName("...")).toBe("attachment")
  expect(safeName("")).toBe("attachment")
})

test("a name too long for a filesystem is cut, not carried to the write", async () => {
  const long = safeName(`${"a".repeat(300)}.png`)
  expect(Buffer.byteLength(long)).toBeLessThanOrEqual(200)
  expect(long.endsWith(".png")).toBe(true)

  const wide = safeName(`${"ä".repeat(300)}.png`)
  expect(Buffer.byteLength(wide)).toBeLessThanOrEqual(200)
  expect(wide.normalize("NFC")).toBe(wide)

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
  expect(promptWith("", ["/tmp/olai-chat-x/shot.png"])).toBe(
    "Attached file: /tmp/olai-chat-x/shot.png",
  )
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

test("append caps follow the stored kind and accumulated bytes", async () => {
  const files = make()
  try {
    for (const [name, cap, claimed] of [
      ["notes.txt", MAX_ATTACHMENT_BYTES, "clip.mp4"],
      ["clip.mp4", MAX_VIDEO_ATTACHMENT_BYTES, "notes.txt"],
    ] as const) {
      const stored = await Effect.runPromise(files.receive({ name, data: "" }))
      truncateSync(stored.path, cap - 1)
      const last = await receive(files, { name: claimed, data: "YQ==", appendTo: stored.path })
      expect(Result.isSuccess(last)).toBe(true)
      const refused = await receive(files, { name: claimed, data: "Yg==", appendTo: stored.path })
      expect(Result.isFailure(refused)).toBe(true)
      if (Result.isFailure(refused)) expect(refused.failure.reason).toContain(`over the ${cap / 1024 / 1024} MB limit`)
      expect(statSync(stored.path).size).toBe(cap)
    }
  } finally {
    await Effect.runPromise(files.discard)
  }
})
