/**
 * Where a pasted picture lands: one tmp directory per conversation.
 *
 * The agent is handed a PATH and reads the file itself, so the bytes have to
 * be somewhere on this disk — and the one place they must NOT be is under the
 * served directory. Everything under there is the outline set: the store
 * probes it, the sidebar lists it, and a commit feature would commit it. A
 * screenshot pasted into chat is none of those things. So it goes to a
 * directory of the system's own tmp, made with owner-only permissions
 * (0700/0600) because it holds whatever somebody just had on their clipboard
 * and the agent that reads it runs as this same user.
 *
 * Its LIFETIME is the conversation's. {@link Attachments.discard} is called
 * when a session is left — a new conversation, or another one loaded — and
 * when the chat stops, which is a finalizer of the serve scope, so shutting
 * the server down takes the pictures with it. Nothing here persists across a
 * restart, and nothing is meant to: the file exists so that one prompt can
 * name it.
 *
 * ## What is validated, and why `appendTo` is not trusted
 *
 * A chunked upload's later calls hand back the path the first one answered
 * with. That path arrives over the wire, so it is CHECKED rather than
 * believed: it must resolve, through symlinks, to somewhere inside this
 * conversation's own directory. That check is the whole of the authority —
 * `..`, an absolute path elsewhere and a symlink planted in the directory are
 * all refused by it — which is what makes `appendTo` a continuation token that
 * happens to be readable rather than a capability.
 *
 * Both sides of that comparison are REALPATHS, and the answered path is
 * canonicalised too, for a reason macOS taught kolu: `/tmp` there is a symlink
 * to `/private/tmp`, so a create that answered `join(dir, name)` and an append
 * that answered `realpath(...)` disagreed about what one file is called, and
 * the file appeared to be renamed mid-upload.
 */

import { type OpFailure, UsageFailure } from "@olai/format"
import { attachmentRejection, base64DecodedLength } from "@olai/surface"
import { Effect } from "effect"
import {
  appendFileSync,
  existsSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { basename, join, parse, sep } from "node:path"

/** One chunk on its way in — the wire's `AttachChunk`, spelled without a
 *  dependency on the wire: this module is about a directory. */
export interface Chunk {
  readonly name: string
  readonly data: string
  readonly appendTo?: string | undefined
}

export interface Attachments {
  /** Write one chunk, and answer with the path the whole file is at. The
   *  first chunk (no `appendTo`) creates it; every later one appends. */
  readonly receive: (chunk: Chunk) => Effect.Effect<string, OpFailure>
  /** Is this path one of ours — the check a prompt's attachment list goes
   *  through before it reaches the agent. */
  readonly holds: (path: string) => boolean
  /** Everything, gone. A conversation was left, or the server is stopping. */
  readonly discard: Effect.Effect<void>
}

export const make = (): Attachments => {
  /** Made on first use rather than on boot: a conversation that never has a
   *  picture pasted into it should leave nothing behind at all. */
  let dir: string | null = null

  /** `mkdtemp` mints it, which is also what makes it owner-only: POSIX says
   *  the directory is created with mode 0700, and the name is unpredictable —
   *  two olai servers on one host never share one. The temp root is resolved
   *  first so every path this module answers with is already canonical on a
   *  host where `/tmp` is a symlink, which is every macOS. */
  const directory = (): string => {
    if (dir === null) dir = mkdtempSync(join(realpathSync(tmpdir()), "olai-chat-"))
    return dir
  }

  const refuse = (reason: string) => Effect.fail(new UsageFailure({ reason }))

  return {
    receive: (chunk) =>
      Effect.suspend(() => {
        const name = safeName(chunk.name)
        const bytes = base64DecodedLength(chunk.data)

        if (chunk.appendTo === undefined) {
          // The AUTHORITATIVE gate. The browser runs the same one before it
          // encodes anything, which is what makes a refusal here a caller
          // that is not the browser — and either way it is refused.
          const rejection = attachmentRejection(name, bytes)
          if (rejection !== null) return refuse(rejection)
          return Effect.sync(() => create(directory(), name, chunk.data))
        }

        const at = chunk.appendTo
        if (!holds(dir, at)) {
          return refuse("that attachment is not part of this conversation")
        }
        // The cap is on the FILE, so a continuation is judged against what is
        // already on disk PLUS what it carries. Judging the chunk alone would
        // make fifty legal chunks an illegal file nobody refused.
        const rejection = attachmentRejection(name, statSync(at).size + bytes)
        if (rejection !== null) return refuse(rejection)
        return Effect.sync(() => append(at, chunk.data))
      }),
    holds: (path) => holds(dir, path),
    discard: Effect.sync(() => {
      if (dir === null) return
      rmSync(dir, { recursive: true, force: true })
      dir = null
    }),
  }
}

/**
 * What the agent is actually asked, once a message has pictures on it.
 *
 * The whole transport, in one line: the prompt NAMES the files and the agent
 * reads them itself. Claude Code does that with a path in the text, so nothing
 * here depends on the session's `promptCapabilities.image` and no base64 rides
 * the prompt into the session the agent persists. Moving to ACP's `image`
 * content block later is a change to this function and to nothing else.
 *
 * One path per line, labelled, after a blank line — so a message that also has
 * words keeps them intact, and one that has none is just the pictures.
 */
export const promptWith = (
  said: string,
  paths: ReadonlyArray<string>,
): string => {
  if (paths.length === 0) return said
  const attached = paths.map((path) => `Attached image: ${path}`).join("\n")
  return said === "" ? attached : `${said}\n\n${attached}`
}

/** A first chunk: mint a file nobody else in this conversation is using, and
 *  answer with its canonical path. */
const create = (dir: string, name: string, data: string): string => {
  const path = free(dir, name)
  // Owner-only, like the directory holding it: this is clipboard content, and
  // the only reader that needs it is the agent running as this same user.
  writeFileSync(path, Buffer.from(data, "base64"), { mode: 0o600 })
  // After the write: realpath needs the file to exist.
  return realpathSync(path)
}

/** A later chunk. The path was checked by {@link holds} before we got here. */
const append = (path: string, data: string): string => {
  appendFileSync(path, Buffer.from(data, "base64"), { mode: 0o600 })
  return path
}

/** Is `path` a file inside `dir`? Both sides resolved, so a symlink cannot
 *  point out of it, and `sep`-terminated so `/tmp/olai-chat-a` does not match
 *  `/tmp/olai-chat-ab`. */
const holds = (dir: string | null, path: string): boolean => {
  if (dir === null || !existsSync(path)) return false
  try {
    return realpathSync(path).startsWith(`${realpathSync(dir)}${sep}`) &&
      statSync(path).isFile()
  } catch {
    // A path that cannot be resolved is not one of ours.
    return false
  }
}

/**
 * The name as a name: its basename, with anything that is not a letter, a
 * number, a mark or one of `._-` collapsed to `_`, and no leading dots.
 *
 * Unicode-aware, so `bildschirmfoto_märz.png` survives as itself — what is
 * being stripped is the set that would let a name mean something other than
 * one file here: separators, control characters, and the shell metacharacters
 * that would bite whoever pastes the resulting path into a terminal. Never
 * empty, and the extension is preserved because the agent reading the file
 * takes the picture's kind from it.
 */
export const safeName = (raw: string): string => {
  const trimmed = basename(raw)
    .normalize("NFC")
    .replace(/[^\p{L}\p{N}\p{M}._-]/gu, "_")
    .replace(/^\.+/, "")
  return trimmed === "" ? "attachment" : trimmed
}

/** A path in `dir` that no file has yet, suffixing `-1`, `-2`, … before the
 *  extension. Two pictures pasted before the agent has read the first must
 *  not be one file. */
const free = (dir: string, name: string): string => {
  const { name: stem, ext } = parse(name)
  let candidate = join(dir, name)
  for (let at = 1; existsSync(candidate); at++) {
    candidate = join(dir, `${stem}-${at}${ext}`)
  }
  return candidate
}
