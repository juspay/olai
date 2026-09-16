import { mkdir, mkdtemp, rm, stat } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Effect } from "effect"
import type { Himalaya } from "./himalaya/run.ts"
import { GMAIL } from "./himalaya/verbs.ts"
import { MailRefusal } from "./wire.ts"

export const MAX_ATTACHMENT = 50 * 1024 * 1024
export const safeFilename = (name: string): string => name.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 120) || "attachment"
export interface Attachment { readonly id: string; readonly filename: string; readonly mime: string; readonly bytes: number }
/** Acquired before tool registration; withdrawn calls finish before this directory closes. */
export const openAttachments = (runtime: string | undefined, run: Himalaya["run"]) => Effect.gen(function*() {
  const root = yield* Effect.acquireRelease(
    Effect.promise(() => mkdtemp(join(runtime?.trim() || tmpdir(), "olai-mail-attachments-"))),
    root => Effect.promise(() => rm(root, { recursive: true, force: true })),
  )
  const known = new Map<string, Attachment>()
  return {
    root,
    remember: (message: string, attachments: ReadonlyArray<Attachment>) => { for (const a of attachments) known.set(`${message}/${a.id}`, a) },
    clear: () => known.clear(),
    get: (message: string, attachment: string, filename?: string) => Effect.gen(function*() {
      if (!/^[0-9a-f]+$/i.test(message) || !/^[A-Za-z0-9_][A-Za-z0-9_-]*$/.test(attachment)) return yield* Effect.fail(new MailRefusal({ reason: "invalid Gmail message or attachment id" }))
      const a = known.get(`${message}/${attachment}`)
      if (!a) return yield* Effect.fail(new MailRefusal({ reason: "read the mail thread first so this serve can check the attachment's size" }))
      if (a.bytes > MAX_ATTACHMENT) return yield* Effect.fail(new MailRefusal({ reason: "this attachment is over 50 MB" }))
      const name = safeFilename(filename ?? a.filename)
      // IDs are untrusted input as well. Encoding is injective and cannot contain a slash.
      const directory = join(root, encodeURIComponent(message))
      const path = join(directory, `${encodeURIComponent(attachment)}-${name}`)
      yield* Effect.tryPromise({ try: () => mkdir(directory, { recursive: true, mode: 0o700 }), catch: e => new MailRefusal({ reason: String(e) }) })
      yield* run({ verb: GMAIL.attachmentsGet, args: [message, attachment, "-o", path] })
      const file = yield* Effect.tryPromise({ try: () => stat(path), catch: e => new MailRefusal({ reason: String(e) }) })
      return { path, filename: name, bytes: file.size, mime: a.mime }
    }),
  }
})
