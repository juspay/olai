/**
 * WHICH conversation the panel was in — and which model it was running —
 * remembered across a restart.
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
 * ## And which MODEL it was running
 *
 * The second fact is here because it is the same fact's other half — "the panel
 * was in THIS conversation, on THIS model" — and it is written down for a bug
 * with the same shape as the one above: a `/model` chosen in the panel did not
 * survive a restart, because the agent's own answer at every boot is a static
 * one. The pinned Claude Code adapter reads `settings.json`, and a container
 * whose settings pin `"model": "sonnet"` RE-ASSERTS that pin over the resumed
 * conversation's own model, every time (0.66.0, `getAvailableModels`: env, then
 * settings, then the transcript). The conversation was on Fable; it came back
 * on Sonnet; nothing on screen said why.
 *
 * A model is not something an ACP session carries for us either — the picker
 * reports what the agent decided, and a `/model` typed into the wrapped CLI
 * never reaches the picker at all — so remembering it is olai's job for exactly
 * the reason remembering the session id is. What the panel does with it after a
 * load is {@link ./agent.ts}'s (`restore`).
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

import { normalDirectory } from "./directory.ts"

/** Remembering, or reading back, went wrong. Reported to a person and never
 *  fatal — see the header. */
export class MemoryFailure extends Data.TaggedError("MemoryFailure")<{
  readonly why: string
}> {
  override get message(): string {
    return this.why
  }
}

/**
 * What a boot needs to know about the boot before it: which conversation, and
 * the model it was running.
 *
 * ONE record rather than two verbs' worth of fields, because the model is only
 * ever meaningful ABOUT a conversation: re-asserting the model of a session the
 * panel is no longer in would put somebody else's conversation on it.
 */
export interface Held {
  readonly session: string
  /** `null` for "nothing says" — a conversation entered but never heard of
   *  again, a file written by an olai that only remembered sessions, or a
   *  panel that has not yet been told which model it is on. */
  readonly model: string | null
}

/**
 * Two verbs and a record: the socket, and everything volatile is behind it.
 *
 * What CHANGES back there is where the file lives, what is in it, whether it is
 * one file or a row of an index, and whether a machine keeps this at all. What
 * does not is the pair below — the panel says where it is and what it is on,
 * and a boot asks what that was. That asymmetry is the whole reason this is an
 * interface with one implementation rather than two `fs` calls in `agent.ts`.
 */
export interface Memory {
  /** What this directory's panel was last in and on, or `null` when nothing
   *  has been written down yet. */
  readonly recall: Effect.Effect<Held | null, MemoryFailure>
  /** ... and writing it down. Called whenever the panel enters a conversation
   *  or learns that the model under it has moved, which are the only two
   *  moments the answer changes. */
  readonly remember: (held: Held) => Effect.Effect<void, MemoryFailure>
}

// ── what one of these files IS ─────────────────────────────────────────
//
// The two halves of one fact, side by side: the shape, what it looks like
// written, and what a read makes of it. Split across the writer and the reader
// they were two places that had to agree about two field names and a guard, by
// nothing stronger than both being short.

/** The `cwd` is not redundant with the file's name: the name is a digest, and
 *  this is what makes the file say whose it is — to a person reading their own
 *  state directory, and to {@link parsed}. The `model` is optional ON DISK: a
 *  file written before olai remembered one is a file that says nothing about
 *  it, which is what `null` means everywhere else here. */
interface Written {
  readonly cwd: string
  readonly session: string
  readonly model?: string
}

const printed = (cwd: string, held: Held): string =>
  // `undefined` is how `JSON.stringify` spells a field that is not there, which
  // is what a model nothing has said about IS on disk.
  `${JSON.stringify({ cwd, session: held.session, model: held.model ?? undefined })}\n`

/** The text as what it is meant to be — or the reason it is not. A file that is
 *  about a DIFFERENT directory is answered `null` rather than refused: it is not
 *  damage, it is somebody else's note, and the honest answer to "what was this
 *  panel in" is that nothing here says.
 *
 * The SESSION is the load-bearing half and a file without one is damage; the
 * MODEL is read leniently — anything that is not a non-empty string reads as
 * "nothing says", the same as an absent field. A file whose model went strange
 * is one the panel opens on whatever the agent offers, which is the behaviour
 * of every olai before this one; refusing the whole memory over it would cost
 * the conversation too. */
const parsed = (
  at: string,
  cwd: string,
  text: string,
): Effect.Effect<Held | null, MemoryFailure> =>
  Effect.flatMap(
    Effect.try({
      try: () => JSON.parse(text) as unknown,
      catch: (cause) =>
        new MemoryFailure({ why: `\`${at}\` is not readable JSON: ${reasonOf(cause)}` }),
    }),
    (value) => {
      const held = value as Partial<Written> | null
      if (typeof held?.session !== "string" || held.session === "") {
        return Effect.fail(new MemoryFailure({ why: `\`${at}\` names no conversation` }))
      }
      const model = typeof held.model === "string" && held.model !== "" ? held.model : null
      return Effect.succeed(held.cwd === cwd ? { session: held.session, model } : null)
    },
  )

export const forDirectory = (spelling: string): Memory => {
  // ONE spelling from here down — the name of the file, what goes in it, and
  // what a read is checked against — and it is the package's own spelling
  // ({@link ./directory.ts}), the same one a stored session's `cwd` is matched
  // against. Two spellings of one directory would be two memories.
  const cwd = normalDirectory(spelling)
  const at = fileFor(cwd)
  const home = dirname(at)

  const recall: Effect.Effect<Held | null, MemoryFailure> = Effect.flatMap(
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
    (text) => text === null ? Effect.succeed(null) : parsed(at, cwd, text),
  )

  const remember = (held: Held): Effect.Effect<void, MemoryFailure> =>
    Effect.tryPromise({
      try: async () => {
        await mkdir(home, { recursive: true, mode: 0o700 })
        // Written beside its destination and renamed onto it, the way every
        // other file olai writes is: a half-written memory read by the next
        // boot would be a parse failure reported to somebody who did nothing
        // wrong. `rename` within one directory is atomic.
        const staged = `${at}.${process.pid}.tmp`
        try {
          await writeFile(staged, printed(cwd, held), { mode: 0o600 })
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

/** ENOENT, whatever wrapped it. A missing file is the ordinary answer here and
 *  the one thing that must not read as a fault. */
const isMissing = (cause: unknown): boolean =>
  (cause as { readonly code?: unknown } | null)?.code === "ENOENT"

/** Where this directory's memory lives — a digest of the path it is about, for
 *  the reason the header gives. Takes the spelling {@link ./directory.ts}
 *  settled on, never a raw one. */
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
