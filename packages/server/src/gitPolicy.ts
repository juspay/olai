/**
 * `--commit` and `--push`, for whichever face is asking — the git POLICY this
 * server runs under.
 *
 * Both subcommands write, so both take the flags, and what they MEAN is one
 * answer: the same modes, the same defaults, the same `--no-commit` override.
 * That much is HACKING.md's rule — "MCP and Web ops must be consistent; never
 * deviate" — and the reason this file exists at all rather than the flags being
 * declared twice in `./main.ts`.
 *
 * What differs between the faces is one clause of one sentence, and it is not a
 * deviation: it is the same rule described accurately to two audiences. `manual`
 * means "a write waits until something asks", and WHAT ASKS differs by face —
 * a terminal agent has the `commit` tool and no browser to press anything, while
 * `olai web` has the button AND hands its own panel agent the same tool, so it
 * genuinely offers both. Telling a terminal about a button sends somebody after
 * a control they have not got; telling a web serve about only the button leaves
 * out a door it really has.
 *
 * That clause is NOT spelled here. `@olai/ops`' `commitDoors` is the one table
 * of it, beside `commitDoor` — which answers the neighbouring but different
 * question of what ONE WRITER has, for the sentence its own write carries back.
 * One face may offer two doors; one writer has one. Both are built from the same
 * two phrases, so renaming the button cannot fix half the product.
 *
 * The face is a {@link CommitFace}, which is `Writer` minus the one writer that
 * is not a subcommand — derived rather than spelled again, so a second name for
 * who is asking never appears, and a new writer forces a decision about whether
 * it has a `--help`.
 *
 * **What these flags produce is a PIN, not a mode.** `vault-level-settings`:
 * whether a flag was GIVEN is a fact every browser has to be told, because a
 * given flag freezes that row in its preferences — read-only, with the flag
 * named. So {@link gitPin} answers with `null` for a flag nobody typed. A
 * single `CommitMode` here could not tell the two apart, which is exactly the
 * bug: `--commit=manual` typed out loud is a team's policy and must freeze the
 * row, while the same mode arrived at by saying nothing must leave it alone.
 *
 * **And what an unpinned half now means is a CHOICE somebody made about this
 * DIRECTORY** — not a preference in one browser. That is the second half of
 * this file ({@link openPolicy}): the pin, plus whatever was remembered for
 * this served path under the XDG state directory, plus the defaults, as the one
 * policy the ops layer obeys and every tab draws. The two preference rows set
 * it through `git.setPolicy`, and a pinned half refuses.
 *
 * Two things live here rather than in two files because they are two answers to
 * one question — what is this server's git policy — and splitting them would
 * mean the pin's reader and the choice's reader could each be right about half
 * of it.
 */

import {
  COMMIT_DEFAULT,
  COMMIT_MODES,
  type CommitMode,
  type GitPin,
  type GitPolicy,
  NO_PIN,
  policyOf,
  type PolicyRequest,
  PUSH_DEFAULT,
  PUSH_MODES,
  type PushMode,
  UsageFailure,
} from "@olai/format"
import { reasonOf } from "@olai/log"
import { type CommitFace, commitDoors, type Policy } from "@olai/ops"
import { Data, Effect, Result } from "effect"
import { Flag } from "effect/unstable/cli"
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"

import { canonical, digestOf, stateHome } from "./state.ts"

/**
 * What `--commit` says for itself on one face.
 *
 * Exported because it is the thing worth ASSERTING: `./gitPolicy.test.ts` holds
 * that both faces name every mode and the default, and that the only clause
 * that differs between them is the door. Reading it back off the built flag
 * would mean reaching into the CLI library's internals to check our own
 * sentence, which is a test of the wrong thing.
 *
 * `manual` is the default and the point of the whole thing: a write lands on
 * disk and WAITS, and a commit is something somebody asks for — which is what
 * makes a train of thought one commit instead of a dozen. `auto` is the old
 * behaviour, one commit per op, for a headless serve with nobody there to ask.
 * `off` is a directory whose history is somebody else's job.
 *
 * The last clause is the PIN, and it is on both flags' sentences because it is
 * the thing an operator most needs to know before typing one: giving the flag
 * at all is a decision about every browser, not only about this process.
 */
export const commitsSaid = (face: CommitFace): string =>
  `when to git-commit writes: manual — a write lands on disk and waits for ${
    commitDoors(face)
  } to ask for one, so a finished piece of work is ONE commit (the default); ` +
  `auto — everything waiting records itself once writes stop arriving for ` +
  `fifteen seconds, whoever made them; ` +
  `off — olai never touches git in this directory. ${PINS}`

/** ... and what `--push` says, which needs no face at all: there is one push
 *  verb, it takes nothing, and nobody has a second door to it. It governs the
 *  SERVER now, not the browsers: a settled commit is pushed whichever door made
 *  it — the Commit button, an agent's `commit` tool, or the quiet window — so a
 *  headless `--commit=auto --push=auto` really does share what it records.
 *  One round trip per commit, which is affordable exactly because the window
 *  makes a burst of writes one commit. */
export const pushesSaid = (): string =>
  `whether a settled commit is pushed to the branch's upstream: ` +
  `off — it waits for the Push button (the default); auto — every commit olai ` +
  `makes here, by whichever door, is followed by the push. ${PINS}`

/** The clause both sentences end with. Spelled once, because it is one fact
 *  about giving either flag and two copies of it is one place for it to be
 *  softened. */
const PINS =
  "Giving this flag PINS it: every browser draws that preference row in the " +
  "state named here, read-only, and says which flag set it."

/**
 * The flag SET a subcommand takes, as one thing.
 *
 * All or none: `--no-commit` is only meaningful beside `--commit`, `--commit`
 * without it would silently drop an opt-out that is in scripts and in this
 * repo's own test harness, and `--push` is the other half of the one policy
 * these flags exist to state. Handing a caller three exports to spread into its
 * own options object would make "which flags does a face take" a question
 * answered at each call site — which is one call site away from the two faces
 * taking different ones, the exact thing this module exists to prevent.
 *
 * Every one of them defaults to `null` rather than to a mode: the default is
 * `@olai/format`'s and is applied by {@link gitPin}'s readers, so "nobody said"
 * survives all the way to the browser. `--no-commit` is the exception and is a
 * boolean, because that is what it has always been.
 */
export const gitFlags = (face: CommitFace) => ({
  commits: Flag.choice("commit", COMMIT_MODES).pipe(
    Flag.withDescription(commitsSaid(face)),
    // NOT `withDefault(COMMIT_DEFAULT)`. Omission has to stay distinguishable
    // from `--commit=manual`, because the two do the same thing on this server
    // and opposite things in every browser looking at it.
    Flag.withDefault(null),
  ),
  pushes: Flag.choice("push", PUSH_MODES).pipe(
    Flag.withDescription(pushesSaid()),
    Flag.withDefault(null),
  ),
  noCommit: Flag.boolean("no-commit").pipe(
    Flag.withDescription("the same as --commit=off"),
    // Omission is false. Effect 4's boolean flags refuse to parse without a
    // fallback ("Omission fails unless the flag is made optional or given a
    // fallback"), and `--no-commit` is an opt-out: a person who wanted the
    // default, and the e2e git scenarios that start a server so it WILL
    // commit, pass nothing. `--no-commit` present is still `true`.
    Flag.withDefault(false),
  ),
})

/**
 * The flags above, as the one answer they are between them: what was PINNED.
 *
 * `--no-commit` WINS over `--commit` when both are given, because it is the one
 * that turns something off: a person who typed both said "off" once and
 * something else once, and honouring the opt-out is the reading that cannot
 * surprise them by writing to a history they asked olai to stay out of. It
 * pins, exactly as `--commit=off` does — it IS `--commit=off`, and a browser
 * told one thing by one spelling and nothing by the other would be a browser
 * whose preferences depend on how the operator likes to type.
 *
 * `null` on either half is nobody having said, and it is the arm that matters
 * now: an unpinned half is a half the READERS set, through `git.setPolicy`, and
 * what is remembered for it lives under {@link openPolicy} below. What the
 * server then DOES with the pair is `@olai/format`'s `policyOf`, which fills
 * the defaults in.
 */
export const gitPin = (
  chosen: CommitMode | null,
  off: boolean,
  pushes: PushMode | null,
): GitPin => ({ commit: off ? "off" : chosen, push: pushes })

// ── what is remembered, and what it comes to ───────────────────────────

/**
 * THE POLICY IN FORCE for one served directory, and the one way to move it.
 *
 * `@olai/ops`' `Policy` with a setter on it: that layer reads `now()` on every
 * decision it makes, and this is where the answer comes from.
 */
export interface LivePolicy extends Policy {
  /**
   * Change the halves the operator did not pin, and answer with what the
   * policy now IS.
   *
   * A REFUSAL for a pinned half rather than a silent no-op: a browser that
   * asked for something and got a cheerful answer describing the opposite is
   * the failure `vault-level-settings` shipped a read-only control to prevent,
   * and a procedure is exactly where the control could be bypassed.
   */
  readonly set: (want: PolicyRequest) => Effect.Effect<GitPolicy, UsageFailure>
}

/**
 * Open this directory's policy: the flags, plus whatever was remembered for it,
 * plus the defaults.
 *
 * WHERE IT IS REMEMBERED is the ruling this whole feature keeps being handed:
 * outside the vault, under the XDG state directory, keyed by the served path
 * ({@link ./state.ts}). A file inside the vault would travel with `git pull`,
 * so a personal clone of a team's outlines would inherit the team's auto-push.
 *
 * READ ONCE, AT BOOT, and held in memory afterwards. The file is olai's own and
 * this process holds the directory's one-brain lock ({@link ./lock.ts}), so
 * nothing else is writing it — and a policy re-read from disk on every decision
 * would put a `readFile` inside the write path for a value that moves when
 * somebody presses a toggle.
 *
 * A FAILURE IS NEVER FATAL and never silent. A state directory that cannot be
 * read leaves this server on the flags and the defaults, with a line in the log
 * saying so; a write that cannot be made comes back as a refusal the person who
 * pressed the toggle reads. Neither is worth refusing to serve a directory of
 * notes over.
 */
export const openPolicy = (
  root: string,
  pin: GitPin,
): Effect.Effect<LivePolicy> =>
  Effect.gen(function*() {
    const at = fileFor(root)
    const read = yield* Effect.result(remembered(at, canonical(root)))
    if (Result.isFailure(read)) {
      yield* Effect.annotateLogs(
        Effect.logWarning(
          "olai git: the remembered git policy could not be read, so this " +
            "directory runs on the flags and the defaults",
        ),
        { at, said: read.failure.why },
      )
    }
    let chosen: GitPin = Result.isSuccess(read) ? read.success : NO_PIN

    const set = (want: PolicyRequest): Effect.Effect<GitPolicy, UsageFailure> =>
      Effect.gen(function*() {
        for (const half of ["commit", "push"] as const) {
          if (want[half] !== undefined && pin[half] !== null) {
            return yield* new UsageFailure({
              reason:
                `this server was started with --${half}=${pin[half]}, so the git ` +
                `${half} policy is the instance's and cannot be changed from a browser`,
            })
          }
        }
        const next: GitPin = {
          commit: want.commit ?? chosen.commit,
          push: want.push ?? chosen.push,
        }
        yield* write(at, canonical(root), next)
        chosen = next
        return policyOf(pin, chosen)
      })

    return { pin, now: () => policyOf(pin, chosen), set }
  })

/** Where this directory's remembered choice lives — the state home, and the
 *  same digest the lock is named by ({@link ./state.ts}). */
const fileFor = (root: string): string =>
  join(stateHome(), "git", `${digestOf(root)}.json`)

/** Reading, or writing, the remembered choice went wrong. Reported and never
 *  fatal — see {@link openPolicy}. */
class PolicyUnreadable extends Data.TaggedError("PolicyUnreadable")<{
  readonly why: string
}> {}

/**
 * What is written down, and what a read makes of it.
 *
 * The `cwd` is not redundant with the file's name: the name is a digest, and
 * this is what makes the file say whose it is — to a person reading their own
 * state directory, and to the guard below. A file about some OTHER directory is
 * answered "nothing was chosen" rather than refused: it is not damage, it is a
 * digest collision, and the honest answer is that nothing here says.
 *
 * Both halves are read LENIENTLY — anything that is not one of the modes reads
 * as "nothing says", the same as an absent field. A file written by an older
 * olai, or one somebody edited, should cost a reader the setting it names and
 * not the whole policy.
 */
const remembered = (
  at: string,
  cwd: string,
): Effect.Effect<GitPin, PolicyUnreadable> =>
  Effect.flatMap(
    Effect.tryPromise({
      // ENOENT is the ordinary answer rather than a fault — nobody has chosen
      // anything for this directory yet — so it is answered INSIDE the promise,
      // where the file's own reason is.
      try: async (): Promise<string | null> => {
        try {
          return await readFile(at, "utf8")
        } catch (cause) {
          if ((cause as { readonly code?: unknown }).code === "ENOENT") return null
          throw cause
        }
      },
      catch: (cause) =>
        new PolicyUnreadable({ why: `\`${at}\` could not be read: ${reasonOf(cause)}` }),
    }),
    (text) => {
      if (text === null) return Effect.succeed(NO_PIN)
      return Effect.map(
        Effect.try({
          try: () => JSON.parse(text) as unknown,
          catch: (cause) =>
            new PolicyUnreadable({
              why: `\`${at}\` is not readable JSON: ${reasonOf(cause)}`,
            }),
        }),
        (value) => {
          const held = value as Partial<Written> | null
          if (held?.cwd !== cwd) return NO_PIN
          return {
            commit: oneOf(COMMIT_MODES, held.commit),
            push: oneOf(PUSH_MODES, held.push),
          }
        },
      )
    },
  )

/** One of a mode table, or `null` for anything else — including an absent
 *  field, which is what "nobody has chosen this half" is on disk. */
const oneOf = <T extends string>(
  modes: ReadonlyArray<T>,
  value: unknown,
): T | null => modes.includes(value as T) ? (value as T) : null

interface Written {
  readonly cwd: string
  readonly commit?: string
  readonly push?: string
}

/**
 * ... and writing it down, staged and renamed the way every other file olai
 * writes is: a half-written policy read by the next boot would be a parse
 * failure reported to somebody who did nothing wrong.
 *
 * The failure is a {@link UsageFailure} because the one caller is a procedure a
 * person pressed: what they need to be told is that the toggle did not stick,
 * with the reason, rather than that a runtime defect happened.
 */
const write = (
  at: string,
  cwd: string,
  chosen: GitPin,
): Effect.Effect<void, UsageFailure> =>
  Effect.tryPromise({
    try: async () => {
      await mkdir(dirname(at), { recursive: true, mode: 0o700 })
      const staged = `${at}.${process.pid}.tmp`
      try {
        // `undefined` is how `JSON.stringify` spells a field that is not there,
        // which is what a half nobody has chosen IS on disk.
        await writeFile(
          staged,
          `${
            JSON.stringify({
              cwd,
              commit: chosen.commit ?? undefined,
              push: chosen.push ?? undefined,
            })
          }\n`,
          { mode: 0o600 },
        )
        await rename(staged, at)
      } catch (cause) {
        await rm(staged, { force: true })
        throw cause
      }
    },
    catch: (cause) =>
      new UsageFailure({
        reason: `the git policy could not be remembered in \`${at}\`: ${reasonOf(cause)}`,
      }),
  })

/** The defaults, re-exported beside the flags that decline to apply them — so a
 *  reader of this file can see what "nobody said" comes to without going two
 *  packages down. (The line under this sentence had gone missing, which is why
 *  `--help`'s "the default" and the value it names were two claims nothing
 *  joined.) */
export { COMMIT_DEFAULT, PUSH_DEFAULT }
