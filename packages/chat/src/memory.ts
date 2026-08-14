/**
 * WHICH conversation the panel was in, remembered across a restart.
 *
 * Boot used to answer that question by guessing: the newest stored session in
 * the served directory was adopted as the panel's own, on the reasonable-looking
 * argument that the last thing to be written to is the last thing you were in.
 * It is a guess about IDENTITY made from a TIMESTAMP, and everything fresher
 * steals the panel from you — a terminal `claude` run in the same directory
 * (which the resumable-from-terminal design invites), a `/clear` sibling that
 * shares its predecessor's name, an adapter whose `updatedAt` moved for a
 * reason of its own. The panel came back in somebody else's conversation and
 * nothing on screen said it had.
 *
 * So olai writes down which one it is in. That is the whole of this file, and
 * the fallback the guess used to be is still there for the case it is actually
 * an answer to: a remembered conversation that is GONE ({@link ../agent.ts}'s
 * `adopt`).
 *
 * ## Where it goes, and why not in the two obvious places
 *
 * Not under the served directory: everything under there is the outline set —
 * the store probes it, the sidebar lists it, a commit would commit it — and
 * "which chat this laptop had open" is none of those things. Not in the agent's
 * own store either: this is olai's fact about olai's panel, and an ACP agent
 * carries no field for it (`session/list` answers with an id, a cwd, a title and
 * a timestamp, and that is the whole vocabulary). It goes where a program keeps
 * state that should survive a restart and means nothing to anybody else: the XDG
 * state directory, `$XDG_STATE_HOME` or `~/.local/state` after it.
 *
 * ONE FILE PER SERVED DIRECTORY, named by a digest of the path rather than by
 * the path itself — an encoded path is a filename that can outgrow the 255 bytes
 * a component gets, and a single index file shared by every directory is a
 * read-modify-write two olai servers can lose an update through. The path is
 * written INSIDE the file, which is what makes a state directory readable by the
 * person whose state it is, and is read back as a guard: a file that is about
 * some other directory is not this panel's memory.
 *
 * ## What it does with a failure
 *
 * Nothing here is load-bearing enough to stop a boot, and none of it is quiet
 * either (HACKING.md: never silently ignore an error). Both verbs FAIL with a
 * reason, and the one caller turns each into a row in the transcript and carries
 * on: a memory that cannot be read means the panel opens the newest conversation
 * — the old behaviour, exactly — and says why; a memory that cannot be written
 * means this conversation will not come back after a restart, which is a thing a
 * person can be told before they find out the hard way.
 *
 * A missing file is NOT a failure. It is the answer on the first serve of a
 * directory, and the answer after the state directory has been cleaned out.
 *
 * ## Two things this deliberately is not
 *
 * **Not `FileSystem` from `effect`**, which is what `@olai/store` reads a
 * directory through and would otherwise be the house answer: asking for that
 * service puts it in the REQUIREMENTS of every effect that touches it, and this
 * one is reached from `agent.ts`, whose verbs are `Effect<A, AgentGone>` with
 * nothing to provide them — so adopting it here means threading a layer through
 * the chat package, the composition root and back, to write eighty bytes.
 * `attachments.ts`, the sibling that owns this conversation's other directory
 * on disk, reaches for `node:fs/promises` for the same reason.
 *
 * **Not a receptacle for "where this machine keeps olai's state"**, though that
 * is what it would be at population two: the state home resolved once, and the
 * files under it named in one place, rather than a second module doing this
 * again for a semantic index's cache or a window's last size. Population is ONE
 * — recorded here rather than extracted, which is the rule (prove, then
 * extract), and named so the second one is a move rather than a rediscovery.
 */

import { reasonOf } from "@olai/log"
import { Data, Effect } from "effect"
import { createHash } from "node:crypto"
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { dirname, join } from "node:path"

/** Remembering, or reading back, went wrong. Reported to a person and never
 *  fatal — see the header. */
export class MemoryFailure extends Data.TaggedError("MemoryFailure")<{
  readonly why: string
}> {
  override get message(): string {
    return this.why
  }
}

export interface Memory {
  /** The conversation this directory's panel was last in, or `null` when
   *  nothing has been written down yet. */
  readonly recall: Effect.Effect<string | null, MemoryFailure>
  /** ... and writing one down. Called whenever the panel enters a
   *  conversation, which is the only moment the answer changes. */
  readonly remember: (id: string) => Effect.Effect<void, MemoryFailure>
}

/** What one of these files holds. The `cwd` is not redundant with the name: the
 *  name is a digest, and this is what makes the file say whose it is. */
interface Remembered {
  readonly cwd: string
  readonly session: string
}

export const forDirectory = (spelling: string): Memory => {
  // ONE spelling from here down — the name of the file, what goes in it, and
  // what a read is checked against. Two spellings of one directory are one
  // memory, and the two places that would otherwise decide that separately are
  // the digest and the guard.
  const cwd = spelling.replace(/\/+$/, "")
  const at = fileFor(cwd)
  const home = dirname(at)

  const recall: Effect.Effect<string | null, MemoryFailure> = Effect.flatMap(
    Effect.tryPromise({
      // ENOENT is the ordinary answer rather than a fault — nothing has been
      // written down for this directory yet — so it is answered INSIDE the
      // promise, where the file's own reason is. Every other way a read fails
      // (a state directory whose permissions moved, a disk that will not
      // answer) is news, and comes out the error channel.
      try: async (): Promise<string | null> => {
        try {
          return await readFile(at, "utf8")
        } catch (cause) {
          if (isMissing(cause)) return null
          throw cause
        }
      },
      catch: (cause) =>
        new MemoryFailure({ why: `\`${at}\` could not be read: ${reasonOf(cause)}` }),
    }),
    (text) => text === null ? Effect.succeed(null) : read(at, cwd, text),
  )

  const remember = (session: string): Effect.Effect<void, MemoryFailure> =>
    Effect.tryPromise({
      try: async () => {
        await mkdir(home, { recursive: true, mode: 0o700 })
        // Written beside its destination and renamed onto it, the way every
        // other file olai writes is: a half-written memory read by the next
        // boot would be a parse failure reported to somebody who did nothing
        // wrong. `rename` within one directory is atomic.
        const staged = `${at}.${process.pid}.tmp`
        const held: Remembered = { cwd, session }
        try {
          await writeFile(staged, `${JSON.stringify(held)}\n`, { mode: 0o600 })
          await rename(staged, at)
        } catch (cause) {
          await rm(staged, { force: true })
          throw cause
        }
      },
      catch: (cause) =>
        new MemoryFailure({ why: `\`${at}\` could not be written: ${reasonOf(cause)}` }),
    })

  return { recall, remember }
}

/** The text as what it is meant to be — or the reason it is not. A file that is
 *  about a DIFFERENT directory is answered `null` rather than refused: it is not
 *  damage, it is somebody else's note, and the honest answer to "what was this
 *  panel in" is that nothing here says. */
const read = (
  at: string,
  cwd: string,
  text: string,
): Effect.Effect<string | null, MemoryFailure> =>
  Effect.flatMap(
    Effect.try({
      try: () => JSON.parse(text) as unknown,
      catch: (cause) =>
        new MemoryFailure({ why: `\`${at}\` is not readable JSON: ${reasonOf(cause)}` }),
    }),
    (value) => {
      const held = value as Partial<Remembered> | null
      if (typeof held?.session !== "string" || held.session === "") {
        return Effect.fail(
          new MemoryFailure({ why: `\`${at}\` names no conversation` }),
        )
      }
      if (held.cwd !== cwd) return Effect.succeed(null)
      return Effect.succeed(held.session)
    },
  )

/** ENOENT, whatever wrapped it. A missing file is the ordinary answer here and
 *  the one thing that must not read as a fault. */
const isMissing = (cause: unknown): boolean =>
  (cause as { readonly code?: unknown } | null)?.code === "ENOENT"

/** Where this directory's memory lives — a digest of the path it is about, for
 *  the reason the header gives. Takes the normalised spelling: the trailing
 *  slash was stripped by {@link forDirectory}, for the reason
 *  {@link ./agent.ts}'s `sameDirectory` exists. */
const fileFor = (cwd: string): string => {
  const digest = createHash("sha256").update(cwd).digest("hex")
  return join(stateHome(), "olai", "chat", `${digest.slice(0, 16)}.json`)
}

/** `$XDG_STATE_HOME`, or the default the spec names. Read at call time rather
 *  than at import, so a test can point a server somewhere of its own. */
const stateHome = (): string => {
  const set = process.env["XDG_STATE_HOME"]
  return set !== undefined && set !== "" ? set : join(homedir(), ".local", "state")
}
