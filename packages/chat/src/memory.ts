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
 * ## And which AGENT it was talking to
 *
 * A conversation belongs to ONE agent, chosen when it was created (the human's
 * ruling, 2026-08-21) — so "which conversation" is only half an answer, and the
 * other half is not something the wire can give back: an agent's
 * `session/list` is its own, and asking the wrong one about a session id gets
 * you a refusal rather than a correction. The id is written down here beside
 * the session for the same reason the session is written down at all, and it is
 * read FIRST: it decides which subprocess this panel starts, and everything
 * else in this file is about a conversation that agent has.
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
 * state that should survive a restart and means nothing to anybody else — the
 * XDG state directory, one file per served directory, named by a digest of the
 * path and carrying that path inside it as a guard.
 *
 * ALL OF THAT IS `@olai/state`'s NOW, which is the module this file predicted
 * by name ("not a receptacle for where this machine keeps olai's state, though
 * that is what it would be at population two"). Chat is the remaining tenant of
 * the state home (a git policy used to live there too), so it is a leaf package,
 * and what is left here is the only part that was ever this package's: what one
 * of these records SAYS.
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
 * on disk, reaches for `node:fs/promises` for the same reason, and `@olai/state`
 * reaches for it below this file.
 *
 * **Not a second failure vocabulary.** {@link MemoryFailure} stays this
 * package's own — its one caller renders it as a row in the transcript — and is
 * a rewrap of `@olai/state`'s, which says the same thing about a file without
 * knowing it is a conversation.
 */

import { canonical, fileFor, readHeld, writeHeld } from "@olai/state"
import { Data, Effect } from "effect"

import { BEFORE_THE_ROSTER } from "./agents/roster.ts"

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
  /** Which agent the conversation is with ({@link ./agents/roster.ts}). */
  readonly agent: string
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
// ── what one of these files IS ─────────────────────────────────────────
//
// The two halves of one fact, side by side: what it looks like written, and
// what a read makes of it. Split across the writer and the reader they were two
// places that had to agree about two field names, by nothing stronger than both
// being short. WHERE it is written, that it is written atomically, and that a
// file about some other directory is not this panel's are `@olai/state`'s.

/** The `kind` this package's files live under in the state home — one
 *  subdirectory beside the git policy's. */
const CHAT = "chat"

/** What is written down. The `model` is optional ON DISK: a file written before
 *  olai remembered one says nothing about it, which is what `null` means
 *  everywhere else here. The AGENT is optional too, for a sharper version of
 *  the same reason — a file written before olai had a roster names no agent,
 *  and there was exactly one it could have been ({@link BEFORE_THE_ROSTER}). */
interface Written {
  readonly agent?: string
  readonly session: string
  readonly model?: string
}

/**
 * What a read makes of one — or the reason it is not one.
 *
 * The SESSION is the load-bearing half and a file without one is damage; the
 * MODEL is read leniently — anything that is not a non-empty string reads as
 * "nothing says", the same as an absent field. A file whose model went strange
 * is one the panel opens on whatever the agent offers, which is the behaviour
 * of every olai before this one; refusing the whole memory over it would cost
 * the conversation too. The AGENT is read leniently too, and lands on
 * {@link BEFORE_THE_ROSTER} when nothing readable says — which is not a default
 * standing in for a choice, it is the only agent a file that names none can be
 * about.
 */
const parsed = (
  at: string,
  held: Record<string, unknown>,
): Effect.Effect<Held, MemoryFailure> => {
  const written = held as Partial<Written>
  if (typeof written.session !== "string" || written.session === "") {
    return Effect.fail(new MemoryFailure({ why: `\`${at}\` names no conversation` }))
  }
  return Effect.succeed({
    agent: word(written.agent) ?? BEFORE_THE_ROSTER,
    session: written.session,
    model: word(written.model) ?? null,
  })
}

/**
 * A non-empty string, or `null` for everything else — including an absent
 * field, which is what "nothing says" is on disk.
 *
 * THE LENIENCY RULE BOTH OF THIS PACKAGE'S RECORDS READ BY, and that is why it
 * is exported rather than kept to this file. The note here and the picks in
 * {@link ./scopes.ts} are the two things olai writes down per directory, and
 * both of them come back field by field: neither refuses a whole file over one
 * unreadable value, so both need one answer to "what counts as a legible field
 * on the way in". One function is that answer.
 *
 * IT USED TO BE TWO — this one, and a character-for-character copy in
 * {@link ./scopes.ts} — which meant a change to leniency made in either place
 * left the other record still admitting rows under the old rule, silently and
 * in the direction nobody would look. There is nothing to be gained by two
 * spellings of one predicate in one package.
 */
export const word = (value: unknown): string | null =>
  typeof value === "string" && value !== "" ? value : null

export const forDirectory = (spelling: string): Memory => {
  // ONE spelling from here down — the name of the file and what a read is
  // checked against — and it is `@olai/state`'s, which is the same answer the
  // one-brain lock is named by. It resolves symlinks, where this package's own
  // `normalDirectory` only strips a trailing slash: a vault reached two ways is
  // one lock and should be one memory. (A stored session's `cwd` is still
  // matched with `sameDirectory`, which is a question about what an AGENT
  // reported rather than about where olai keeps a file.)
  const cwd = canonical(spelling)
  const at = fileFor(CHAT, cwd)

  const recall: Effect.Effect<Held | null, MemoryFailure> = Effect.flatMap(
    Effect.mapError(readHeld(at, cwd), (failure) => new MemoryFailure(failure)),
    (held) => held === null ? Effect.succeed(null) : parsed(at, held),
  )

  const remember = (held: Held): Effect.Effect<void, MemoryFailure> =>
    Effect.mapError(
      // `undefined` is how `JSON.stringify` spells a field that is not there,
      // which is what a model nothing has said about IS on disk. The AGENT is
      // always written: a note this olai wrote knows which agent it was talking
      // to, and an absent one means something else entirely on the way back in.
      writeHeld(at, {
        cwd,
        agent: held.agent,
        session: held.session,
        model: held.model ?? undefined,
      }),
      (failure) => new MemoryFailure(failure),
    )

  return { recall, remember }
}
