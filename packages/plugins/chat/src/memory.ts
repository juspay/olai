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
 * conversation's own model, every time (0.73.0, `getAvailableModels`: env, then
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
 * state directory. Core owns that place and hands chat one `LocalState` door;
 * this module sees only chat's `memory` section and owns what it SAYS.
 *
 * ## What it does with a failure
 *
 * A missing section is the ordinary first-serve answer. A section that names
 * no session fails with {@link MemoryFailure}; a filesystem write failure comes
 * through the door as the same word, without making this plugin own a path.
 *
 * ## Two things this deliberately is not
 *
 * **Not a filesystem client.** The plugin receives one keyed door and never
 * imports the state leaf. That is what keeps paths, permissions, migration and
 * atomic replacement in core.
 *
 * **Not a second failure vocabulary.** {@link MemoryFailure} stays this
 * package's own — its caller renders it as a row in the transcript — and is the
 * one word for a malformed section or a write that did not land.
 */

import { Effect } from "effect"

import { type ChatLocalState, MemoryFailure } from "./local.ts"

export { MemoryFailure } from "./local.ts"

/**
 * What a boot needs to know about the boot before it: which conversation, and
 * the model it was running.
 *
 * ONE record rather than two verbs' worth of fields, because the model is only
 * ever meaningful ABOUT a conversation: re-asserting the model of a session the
 * panel is no longer in would put somebody else's conversation on it.
 */
export interface MemorySnapshot {
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
  readonly recall: Effect.Effect<MemorySnapshot | null, MemoryFailure>
  /** ... and writing it down. Called whenever the panel enters a conversation
   *  or learns that the model under it has moved, which are the only two
   *  moments the answer changes. */
  readonly remember: (held: MemorySnapshot) => Effect.Effect<void, MemoryFailure>
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
// the document's path, atomic replacement, and `cwd` guard are core's.

/** This state machine's section in chat's one machine-local document. */
const CHAT = "memory"

/** What is written down. The `model` is optional ON DISK: a file written before
 *  olai remembered one says nothing about it, which is what `null` means
 *  everywhere else here. The AGENT is optional too, for a sharper version of
 *  the same reason — a file written before olai had a roster names no agent,
 *  and there was exactly one it could have been ({@link forDirectory}'s
 *  `before`). */
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
 * the conversation too. The AGENT is read leniently too, and lands on `before`
 * when nothing readable says — which is not a default standing in for a choice,
 * it is the only agent a file that names none can be about.
 */
const parsed = (
  at: string,
  held: Record<string, unknown>,
  before: string,
): Effect.Effect<MemorySnapshot, MemoryFailure> => {
  const written = held as Partial<Written>
  if (typeof written.session !== "string" || written.session === "") {
    return Effect.fail(new MemoryFailure({ why: `\`${at}\` names no conversation` }))
  }
  return Effect.succeed({
    agent: word(written.agent) ?? before,
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

/**
 * A directory's memory — and the agent a note that names none is about.
 *
 * `before` IS AN ARGUMENT and used to be a constant in this package
 * (`BEFORE_THE_ROSTER = "claude"`). It could not stay one: an engine is a plugin
 * now, and `olai-plugin-chat` may not spell one. What replaces it is the FIRST ENGINE
 * THE BUILD LISTS, handed in by {@link ./chat.ts} off the same ordered list the
 * picker is drawn from — which is the honest reading of the same fact rather
 * than a fallback standing in for a choice. A note written before olai
 * remembered which agent a conversation belonged to was written by an olai that
 * had exactly ONE: the ACP agent `OLAI_ACP_AGENT` names, which is the row
 * `olai.yml` puts first and says so.
 *
 * A build whose first row is some other engine reads such a note as that engine's
 * — which is a build that never wrote one, since the note predates the roster
 * and the roster predates every engine but the first.
 */
export const forLocalState = (local: ChatLocalState, before: string): Memory => {
  const recall: Effect.Effect<MemorySnapshot | null, MemoryFailure> = Effect.suspend(() => {
    const remembered = local.load(CHAT)
    return remembered === null
      ? Effect.succeed(null)
      : parsed("chat's machine-local memory", remembered, before)
  })

  const remember = (held: MemorySnapshot): Effect.Effect<void, MemoryFailure> =>
    local.save(CHAT, {
      agent: held.agent,
      session: held.session,
      model: held.model ?? undefined,
    })

  return { recall, remember }
}
