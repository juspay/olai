/**
 * Where an attached file lands: one tmp directory per conversation.
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
 * the server down takes the files with it. Nothing here persists across a
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

import { base64DecodedLength } from "@kolu/surface/frame-chunking"
import { type OpFailure, UsageFailure } from "@olai/format"
import { type Attached, type AttachChunk, attachmentRejection } from "@olai/surface"
import { Effect } from "effect"
import { appendFile, mkdtemp, realpath, rm, stat, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { basename, join, parse, sep } from "node:path"

import { annotated } from "./prompt.ts"

export interface Attachments {
  /** Write one chunk, and answer with where the whole file is and what it
   *  ended up being called. The first chunk (no `appendTo`) creates it; every
   *  later one appends. */
  readonly receive: (chunk: AttachChunk) => Effect.Effect<Attached, OpFailure>
  /** Refuse a path that is not a file in this conversation's own directory —
   *  what a continuation goes through, and what every attachment on a prompt
   *  goes through before it reaches the agent. The predicate and the sentence
   *  it fails with are ONE thing, so its two callers cannot come to answer
   *  differently. */
  readonly claim: (path: string) => Effect.Effect<void, OpFailure>
  /** Everything, gone. A conversation was left, or the server is stopping. */
  readonly discard: Effect.Effect<void>
}

export const make = (): Attachments => {
  /** Made on first use rather than on boot: a conversation that never has a
   *  file attached to it should leave nothing behind at all. */
  let dir: string | null = null

  /** `mkdtemp` mints it, which is also what makes it owner-only: POSIX says
   *  the directory is created with mode 0700, and the name is unpredictable —
   *  two olai servers on one host never share one. The temp root is resolved
   *  ONCE, here, so the directory is canonical BY CONSTRUCTION and nothing
   *  below re-resolves it. That matters on a host where `/tmp` is a symlink,
   *  which is every macOS. */
  const directory = async (): Promise<string> => {
    if (dir === null) dir = await mkdtemp(join(await realpath(tmpdir()), "olai-chat-"))
    return dir
  }

  const refuse = (reason: string) => Effect.fail(new UsageFailure({ reason }))

  /** The path, resolved, if this conversation will have it — and `null` for
   *  every other path there is. Answering with the RESOLVED one is what keeps
   *  a caller from resolving it a second time and getting a second spelling of
   *  the same file. */
  const resolved = async (path: string): Promise<string | null> => {
    if (dir === null) return null
    try {
      const real = await realpath(path)
      // `sep`-terminated, so `/tmp/olai-chat-a` does not match
      // `/tmp/olai-chat-ab`. Both sides resolved, so a symlink planted inside
      // the directory cannot point an append out of it.
      if (!real.startsWith(`${dir}${sep}`)) return null
      return (await stat(real)).isFile() ? real : null
    } catch {
      // A path that does not resolve is not one of ours.
      return null
    }
  }

  const claim = (path: string): Effect.Effect<string, OpFailure> =>
    Effect.flatMap(
      Effect.promise(() => resolved(path)),
      (real) => (real === null ? refuse(NOT_OURS) : Effect.succeed(real)),
    )

  /** Where a chunk's bytes end up. One path out of both branches, so
   *  {@link named} is the only place a path becomes an answer. */
  const stored = (chunk: AttachChunk): Effect.Effect<string, OpFailure> =>
    Effect.gen(function*() {
      const name = safeName(chunk.name)
      const bytes = base64DecodedLength(chunk.data)
      const continuing = chunk.appendTo

      if (continuing === undefined) {
        // The AUTHORITATIVE gate. The browser runs the same one before it
        // encodes anything, which makes a refusal here a caller that is not
        // the browser — and either way it is refused.
        const rejection = attachmentRejection(name, bytes)
        if (rejection !== null) return yield* refuse(rejection)
        return yield* Effect.promise(async () =>
          create(await directory(), name, chunk.data)
        )
      }

      const at = yield* claim(continuing)
      // The cap is on the FILE, so a continuation is judged against what is
      // already on disk PLUS what it carries. Judging the chunk alone would
      // make fifty legal chunks an illegal file nobody refused.
      const already = yield* Effect.promise(() => stat(at))
      const rejection = attachmentRejection(name, already.size + bytes)
      if (rejection !== null) return yield* refuse(rejection)
      return yield* Effect.promise(() => append(at, chunk.data))
    })

  return {
    receive: (chunk) => Effect.map(stored(chunk), named),
    claim: (path) => Effect.asVoid(claim(path)),
    discard: Effect.promise(async () => {
      const going = dir
      dir = null
      if (going !== null) await rm(going, { recursive: true, force: true })
    }),
  }
}

/** What this conversation says about a path that is not its own. One sentence,
 *  because it is one refusal: a chunk continuing somebody else's file and an
 *  attachment on a prompt fail the same check. */
const NOT_OURS = "that attachment is not part of this conversation"

/**
 * What the agent is actually asked, once a message has files on it.
 *
 * The whole transport, in one line: the prompt NAMES the files and the agent
 * reads them itself. Claude Code does that with a path in the text, so nothing
 * here depends on the session's `promptCapabilities.image` and no base64 rides
 * the prompt into the session the agent persists. Moving to ACP's `image`
 * content block later is a change to this function and to nothing else.
 *
 * One path per line, labelled, after a blank line — so a message that also has
 * words keeps them intact, and one that has none is just the files.
 *
 * The label says FILE rather than image, and that is not cosmetic: this line
 * carries PDFs and text as well as pictures now, and an agent told a `.pdf`
 * was an image has been told something wrong about a file it is about to
 * open. The fake ACP agent reads this same label back (`packages/tests`), so
 * the two spellings cannot drift.
 */
export const promptWith = (
  said: string,
  paths: ReadonlyArray<string>,
): string => annotated(said, paths.map((path) => `Attached file: ${path}`))

/** What a stored attachment is CALLED — the one rule, so the answer `attach`
 *  gives and the name the transcript row carries cannot come apart. Derived
 *  from the path rather than carried beside it, because the path is the half
 *  the disk agrees with: the collision suffix happens down here. */
export const nameOf = (path: string): string => basename(path)

/** A path, as the answer a caller keeps. */
const named = (path: string): Attached => ({ path, name: nameOf(path) })

/** A first chunk: mint a file nobody else in this conversation is using, and
 *  answer with its path.
 *
 *  Every write here is ASYNCHRONOUS, and the size is why: one chunk is three
 *  megabytes, and the loop this server runs is also the one serving every open
 *  websocket, the store's probe and the MCP route. A synchronous write would
 *  stop all of them, seventeen times, for one large file. */
const create = async (dir: string, name: string, data: string): Promise<string> => {
  const path = await free(dir, name)
  // Owner-only, like the directory holding it: this is clipboard content, and
  // the only reader that needs it is the agent running as this same user.
  await writeFile(path, Buffer.from(data, "base64"), { mode: 0o600 })
  // The directory is canonical already, and the name is ours, so the path is
  // too — nothing here has to be resolved a second time.
  return path
}

/** A later chunk. The path came back resolved from `claim`. */
const append = async (path: string, data: string): Promise<string> => {
  await appendFile(path, Buffer.from(data, "base64"), { mode: 0o600 })
  return path
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
 * takes the file's kind from it.
 */
export const safeName = (raw: string): string => {
  const trimmed = basename(raw)
    .normalize("NFC")
    .replace(/[^\p{L}\p{N}\p{M}._-]/gu, "_")
    .replace(/^\.+/, "")
  return trimmed === "" ? "attachment" : shortened(trimmed)
}

/** What a file name may weigh. Every filesystem this runs on stops somewhere
 *  near 255 BYTES for one component; 200 leaves room for the collision suffix
 *  and for the difference between a byte and a character. */
const MAX_NAME_BYTES = 200

/**
 * ... and short enough to be one.
 *
 * A three-hundred-character name is still a name — it passes the kind
 * allowlist, and the size gate has nothing to say about it — and then the
 * write fails with `ENAMETOOLONG`, which reaches a person as a transport
 * failure rather than as a sentence about their file. So the label is cut
 * rather than refused, which is what this whole function does to a name.
 *
 * The EXTENSION is what survives the cut: the agent reads the file's kind
 * from it, and a name truncated through it would be a different kind or none.
 * Cut by BYTES and never mid-character, because the limit is bytes and a
 * name may be entirely three-byte ones.
 */
const shortened = (name: string): string => {
  if (weight(name) <= MAX_NAME_BYTES) return name
  const { name: stem, ext } = parse(name)
  const room = MAX_NAME_BYTES - weight(ext)
  // An extension that will not fit is not one — cut the whole thing, and let
  // the gate say what it now is (a name with no attachable extension left).
  return room <= 0 ? cut(name, MAX_NAME_BYTES) : `${cut(stem, room)}${ext}`
}

const weight = (text: string): number => Buffer.byteLength(text, "utf8")

const cut = (text: string, room: number): string => {
  let kept = text
  // By CHARACTER, so a multi-byte one is dropped whole rather than halved.
  while (weight(kept) > room) kept = kept.slice(0, -1)
  return kept
}

/** A path in `dir` that no file has yet, suffixing `-1`, `-2`, … before the
 *  extension. Two files attached before the agent has read the first must
 *  not be one file. */
const free = async (dir: string, name: string): Promise<string> => {
  const { name: stem, ext } = parse(name)
  let candidate = join(dir, name)
  for (let at = 1; await taken(candidate); at++) {
    candidate = join(dir, `${stem}-${at}${ext}`)
  }
  return candidate
}

/** Is there something there already? `stat` rather than an existence check,
 *  because the answer this asks for is the one `stat` throws about. */
const taken = async (path: string): Promise<boolean> => {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}
