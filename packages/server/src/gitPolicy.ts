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
  QUIET_MS,
  UsageFailure,
} from "@olai/format"
import { type CommitFace, commitDoors, type Policy } from "@olai/ops"
import {
  canonical,
  fileFor,
  readHeld,
  type StateFailure,
  writeHeld,
} from "@olai/state"
import { Effect, Result } from "effect"
import { Flag } from "effect/unstable/cli"

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
 * makes a train of thought one commit instead of a dozen. `auto` is the QUIET
 * WINDOW, which makes the same promise without anybody asking: everything
 * waiting records itself once writes stop arriving for the span
 * (`@olai/format`'s `QUIET_MS`, read below rather than spelled), whoever made
 * them and with no browser open. It used to be one commit per op, which is the
 * dozen this mode's neighbour exists to prevent — that door is retired. `off`
 * is a directory whose history is somebody else's job.
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
  `${Math.round(QUIET_MS / 1000)} seconds, whoever made them; ` +
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
   * Change the halves the operator did not pin.
   *
   * IT ANSWERS NOTHING, and tells whoever is listening instead: what changed is
   * the `git` cell every reader draws from, and a returned policy is exactly
   * the second opinion this feature exists to retire.
   *
   * A REFUSAL for a pinned half rather than a silent no-op: a browser that
   * asked for something and got a cheerful answer describing the opposite is
   * the failure `vault-level-settings` shipped a read-only control to prevent,
   * and a procedure is exactly where the control could be bypassed.
   */
  readonly set: (want: PolicyRequest) => Effect.Effect<void, UsageFailure>
}

/**
 * Open this directory's policy: the flags, plus whatever was remembered for it,
 * plus the defaults.
 *
 * WHERE IT IS REMEMBERED is the ruling this whole feature keeps being handed:
 * outside the vault, under the XDG state directory, keyed by the served path
 * (`@olai/state`). A file inside the vault would travel with `git pull`,
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
  /**
   * Told when the policy has moved, so the `git` cell is republished and the
   * quiet window hears about a loop it has just been given.
   *
   * IT HANGS HERE rather than on the procedure that asked, which is the rule
   * `@olai/ops`' `onSettled` already states and the reason it is stated:
   * a caller that has to remember to republish is a caller that can forget, and
   * this policy will grow a second door (a `SIGHUP` re-read, an `olai` CLI that
   * can set it) before anybody notices the first one was the only one that
   * published.
   */
  onSettled: () => void,
): Effect.Effect<LivePolicy> =>
  Effect.gen(function*() {
    const cwd = canonical(root)
    const at = fileFor(GIT, cwd)
    const read = yield* Effect.result(remembered(at, cwd))
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

    const set = (want: PolicyRequest): Effect.Effect<void, UsageFailure> =>
      Effect.gen(function*() {
        for (const half of HALVES) {
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
        // `undefined` for a half nobody has chosen — see `@olai/state`, which
        // owns the staging, the rename and the owner-only mode.
        yield* Effect.mapError(
          writeHeld(at, {
            cwd,
            commit: next.commit ?? undefined,
            push: next.push ?? undefined,
          }),
          (failure) =>
            new UsageFailure({
              reason: `the git policy could not be remembered: ${failure.why}`,
            }),
        )
        chosen = next
        onSettled()
      })

    return { pin, now: () => policyOf(pin, chosen), set }
  })

/** Which subdirectory of the state home this server's policies live in — the
 *  `kind` `@olai/state` names a file by, beside the chat panel's own. */
const GIT = "git"

/**
 * The halves, as a list the COMPILER keeps — the pinned-row guard above walks
 * it, and a third half added to {@link GitPin} must not be able to go
 * unguarded.
 *
 * A hand-written `["commit", "push"]` would compile perfectly well beside a
 * three-field pin and simply never check the new one, which is the exact
 * failure the pin exists to prevent (a row an operator froze, moved from a
 * browser) and it would be silent: the write lands, the row moves, the flag is
 * overridden. `satisfies` is what makes the omission a type error instead.
 */
const HALVES = Object.keys(
  { commit: true, push: true } satisfies Record<keyof GitPin, true>,
) as ReadonlyArray<keyof GitPin>

/**
 * What was written down, as this module's own vocabulary — or nothing, for a
 * directory nobody has chosen for.
 *
 * Both halves are read LENIENTLY: anything that is not one of the modes reads
 * as "nothing says", the same as an absent field. A file written by an older
 * olai, or one somebody edited, should cost a reader the setting it names and
 * not the whole policy. Whose file it is, whether it parses, and what a missing
 * one means are `@olai/state`'s.
 */
const remembered = (
  at: string,
  cwd: string,
): Effect.Effect<GitPin, StateFailure> =>
  Effect.map(readHeld(at, cwd), (held) =>
    held === null ? NO_PIN : {
      commit: oneOf(COMMIT_MODES, held["commit"]),
      push: oneOf(PUSH_MODES, held["push"]),
    })

/** One of a mode table, or `null` for anything else — including an absent
 *  field, which is what "nobody has chosen this half" is on disk. */
const oneOf = <T extends string>(
  modes: ReadonlyArray<T>,
  value: unknown,
): T | null => modes.includes(value as T) ? (value as T) : null

/** The defaults, re-exported beside the flags that decline to apply them — so a
 *  reader of this file can see what "nobody said" comes to without going two
 *  packages down. (The line under this sentence had gone missing, which is why
 *  `--help`'s "the default" and the value it names were two claims nothing
 *  joined.) */
export { COMMIT_DEFAULT, PUSH_DEFAULT }
