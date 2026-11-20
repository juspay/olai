import { base64DecodedLength } from "@kolu/surface/frame-chunking"
import { type OpFailure, UsageFailure } from "@olai/format"
import { attachmentRejection } from "@olai/surface"
import { type Attached, type AttachChunk } from "olai-plugin-chat/wire"
import { Effect, Semaphore } from "effect"
import { randomUUID } from "node:crypto"
import { appendFile, mkdtemp, realpath, rm, stat, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { basename, join, parse, sep } from "node:path"

import { annotated } from "./prompt.ts"

export interface Attachments {
  readonly scope: () => string
  readonly receive: (chunk: AttachChunk) => Effect.Effect<Attached, OpFailure>
  readonly claim: (path: string) => Effect.Effect<void, OpFailure>
  readonly discard: Effect.Effect<void>
}

export const make = (): Attachments => {
  const writing = Semaphore.makeUnsafe(1)
  let dir: string | null = null
  let scope = randomUUID()

  const directory = async (): Promise<string> => {
    if (dir === null) dir = await mkdtemp(join(await realpath(tmpdir()), "olai-chat-"))
    return dir
  }

  const refuse = (reason: string) => Effect.fail(new UsageFailure({ reason }))

  const resolved = async (path: string): Promise<string | null> => {
    if (dir === null) return null
    try {
      const real = await realpath(path)
      if (!real.startsWith(`${dir}${sep}`)) return null
      return (await stat(real)).isFile() ? real : null
    } catch {
      return null
    }
  }

  const claim = (path: string): Effect.Effect<string, OpFailure> =>
    Effect.flatMap(
      Effect.promise(() => resolved(path)),
      (real) => (real === null ? refuse(NOT_OURS) : Effect.succeed(real)),
    )

  const stored = (chunk: AttachChunk): Effect.Effect<string, OpFailure> =>
    Effect.gen(function*() {
      if (chunk.uploadScope !== undefined && chunk.uploadScope !== scope) {
        return yield* refuse("the conversation changed while this file was uploading")
      }
      const name = safeName(chunk.name)
      const bytes = base64DecodedLength(chunk.data)
      const continuing = chunk.appendTo

      if (continuing === undefined) {
        const rejection = attachmentRejection(name, bytes)
        if (rejection !== null) return yield* refuse(rejection)
        return yield* Effect.promise(async () =>
          create(await directory(), name, chunk.data)
        )
      }

      const at = yield* claim(continuing)
      const already = yield* Effect.promise(() => stat(at))
      const rejection = attachmentRejection(nameOf(at), already.size + bytes)
      if (rejection !== null) return yield* refuse(rejection)
      return yield* Effect.promise(() => append(at, chunk.data))
    })

  return {
    scope: () => scope,
    receive: (chunk) => writing.withPermit(Effect.map(stored(chunk), named)),
    claim: (path) => writing.withPermit(Effect.asVoid(claim(path))),
    discard: writing.withPermit(Effect.promise(async () => {
      const going = dir
      dir = null
      scope = randomUUID()
      if (going !== null) await rm(going, { recursive: true, force: true })
    })),
  }
}

const NOT_OURS = "that attachment is not part of this conversation"

export const promptWith = (
  said: string,
  paths: ReadonlyArray<string>,
): string => annotated(said, paths.map((path) => `Attached file: ${path}`))

export const nameOf = (path: string): string => basename(path)

const named = (path: string): Attached => ({ path, name: nameOf(path) })

const create = async (dir: string, name: string, data: string): Promise<string> => {
  const path = await free(dir, name)
  await writeFile(path, Buffer.from(data, "base64"), { mode: 0o600 })
  return path
}

const append = async (path: string, data: string): Promise<string> => {
  await appendFile(path, Buffer.from(data, "base64"), { mode: 0o600 })
  return path
}

export const safeName = (raw: string): string => {
  const trimmed = basename(raw)
    .normalize("NFC")
    .replace(/[^\p{L}\p{N}\p{M}._-]/gu, "_")
    .replace(/^\.+/, "")
  return trimmed === "" ? "attachment" : shortened(trimmed)
}

const MAX_NAME_BYTES = 200

const shortened = (name: string): string => {
  if (weight(name) <= MAX_NAME_BYTES) return name
  const { name: stem, ext } = parse(name)
  const room = MAX_NAME_BYTES - weight(ext)
  return room <= 0 ? cut(name, MAX_NAME_BYTES) : `${cut(stem, room)}${ext}`
}

const weight = (text: string): number => Buffer.byteLength(text, "utf8")

const cut = (text: string, room: number): string => {
  let kept = text
  while (weight(kept) > room) kept = kept.slice(0, -1)
  return kept
}

const free = async (dir: string, name: string): Promise<string> => {
  const { name: stem, ext } = parse(name)
  let candidate = join(dir, name)
  for (let at = 1; await taken(candidate); at++) {
    candidate = join(dir, `${stem}-${at}${ext}`)
  }
  return candidate
}

const taken = async (path: string): Promise<boolean> => {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}
