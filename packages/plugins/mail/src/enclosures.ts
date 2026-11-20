import { readFile, realpath, stat } from "node:fs/promises"
import { basename, extname, isAbsolute } from "node:path"

import { Effect, Result } from "effect"

import { MailRefusal } from "./wire.ts"

export const MAX_ENCLOSURES = 10
// Google refuses a draft whose attachments pass Gmail's 25 MB ceiling after
// the upload rather than before it.
export const MAX_ENCLOSED_BYTES = 25 * 1024 * 1024

export interface EnclosureArgs {
  readonly path: string
  readonly filename?: string
  readonly type?: string
}
export interface Enclosure {
  readonly filename: string
  readonly type: string
  readonly data: Buffer
}
export interface NamedEnclosure {
  readonly path: string
  readonly filename: string
  readonly type: string
}

const refuse = (reason: string) => Result.fail(new MailRefusal({ reason }))
export const CONTROL = /[\r\n\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/
const TOKEN = /^[A-Za-z0-9!#$%&'*+.^_`|~-]+$/
export const contentType = (value: string): boolean => {
  const parts = value.split("/")
  return parts.length === 2 && parts.every(part => TOKEN.test(part))
}

const TYPES: Readonly<Record<string, string>> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  bmp: "image/bmp",
  txt: "text/plain",
  md: "text/markdown",
  csv: "text/csv",
  json: "application/json",
  html: "text/html",
  xml: "application/xml",
  zip: "application/zip",
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  m4v: "video/x-m4v",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
}
const suffix = (name: string): string => extname(name).slice(1).toLowerCase()
export const typeOf = (filename: string, path: string): string =>
  TYPES[suffix(filename)] ?? TYPES[suffix(path)] ?? "application/octet-stream"

const nameOf = (one: EnclosureArgs): string => [...basename(one.filename ?? one.path).trim()].slice(0, 120).join("")

export const validateEnclosures = (list: ReadonlyArray<EnclosureArgs> = []): Result.Result<ReadonlyArray<NamedEnclosure>, MailRefusal> => Result.gen(function*() {
  if (list.length > MAX_ENCLOSURES) return yield* refuse(`mail drafts carry at most ${MAX_ENCLOSURES} attachments`)
  const named: NamedEnclosure[] = []
  for (const one of list) {
    if (CONTROL.test(one.path)) return yield* refuse("mail attachment paths cannot contain CR, LF or control characters")
    if (!one.path.trim() || !isAbsolute(one.path)) return yield* refuse(`mail attachments need an absolute path: ${one.path}`)
    if (one.filename !== undefined && CONTROL.test(one.filename)) return yield* refuse("mail attachment filenames cannot contain CR, LF or control characters")
    const filename = nameOf(one)
    if (!filename || filename === "." || filename === "..") return yield* refuse(`this attachment has no filename to arrive under: ${one.path}`)
    if (one.type !== undefined && !contentType(one.type)) return yield* refuse(`malformed mail attachment content type: ${JSON.stringify(one.type)}`)
    if (named.some(other => other.filename === filename)) return yield* refuse(`two mail attachments would arrive as ${filename}; give one of them its own filename`)
    named.push({ path: one.path, filename, type: one.type ?? typeOf(filename, one.path) })
  }
  return named
})

export const withinCap = (sized: ReadonlyArray<{ readonly filename: string; readonly bytes: number }>): Result.Result<void, MailRefusal> => Result.gen(function*() {
  let total = 0
  for (const one of sized) {
    if (one.bytes > MAX_ENCLOSED_BYTES) return yield* refuse(`${one.filename} is over 25 MB, which is more than Gmail takes`)
    total += one.bytes
    if (total > MAX_ENCLOSED_BYTES) return yield* refuse("these attachments come to more than 25 MB together, which is more than Gmail takes")
  }
})

export const readEnclosures = (list: ReadonlyArray<EnclosureArgs> = []): Effect.Effect<ReadonlyArray<Enclosure>, MailRefusal> => Effect.gen(function*() {
  const named = yield* Effect.fromResult(validateEnclosures(list))
  if (!named.length) return []
  const missing = (one: NamedEnclosure) => new MailRefusal({ reason: `there is no file to attach at ${one.path}` })
  const sized: Array<NamedEnclosure & { readonly real: string; readonly bytes: number }> = []
  for (const one of named) {
    const real = yield* Effect.tryPromise({ try: () => realpath(one.path), catch: () => missing(one) })
    const file = yield* Effect.tryPromise({ try: () => stat(real), catch: () => missing(one) })
    if (!file.isFile()) return yield* Effect.fail(new MailRefusal({ reason: `${one.path} is not a file, so it cannot be attached` }))
    sized.push({ ...one, real, bytes: file.size })
  }
  yield* Effect.fromResult(withinCap(sized))
  const read = yield* Effect.forEach(sized, one => Effect.tryPromise({
    try: () => readFile(one.real),
    catch: error => new MailRefusal({ reason: `could not read ${one.path}: ${String(error)}` }),
  }).pipe(Effect.map(data => ({ filename: one.filename, type: one.type, data }))))
  yield* Effect.fromResult(withinCap(read.map(one => ({ filename: one.filename, bytes: one.data.length }))))
  return read
})
