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
 * named. So {@link gitPin} answers with `null` for a flag nobody typed, and
 * `@olai/format`'s `commitModeOf` is what fills the default back in for the
 * server's own behaviour. A single `CommitMode` here could not tell the two
 * apart, which is exactly the bug: `--commit=manual` typed out loud is a team's
 * policy and must freeze the row, while the same mode arrived at by saying
 * nothing must leave it alone.
 */

import {
  COMMIT_DEFAULT,
  COMMIT_MODES,
  type CommitMode,
  type GitPin,
  PUSH_DEFAULT,
  PUSH_MODES,
  type PushMode,
} from "@olai/format"
import { type CommitFace, commitDoors } from "@olai/ops"
import { Flag } from "effect/unstable/cli"

/**
 * What `--commit` says for itself on one face.
 *
 * Exported because it is the thing worth ASSERTING: `./commits.test.ts` holds
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
  `auto — every write commits itself, for a headless serve with nobody to ask; ` +
  `off — olai never touches git in this directory. ${PINS}`

/** ... and what `--push` says, which needs no face at all: there is one push
 *  verb, it takes nothing, and nobody has a second door to it. */
export const pushSaid = (): string =>
  `whether a commit made here is pushed to the branch's upstream: off — it ` +
  `waits for the Push button (the default); auto — a commit is followed by ` +
  `the push. ${PINS}`

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
    Flag.withDescription(pushSaid()),
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
 * `null` on either half is nobody having said, which is what leaves that
 * browser preference alone. What the SERVER then does about it is
 * `commitModeOf` / `pushModeOf` (`@olai/format`), which fill the defaults in.
 */
export const gitPin = (
  chosen: CommitMode | null,
  off: boolean,
  pushes: PushMode | null,
): GitPin => ({ commit: off ? "off" : chosen, push: pushes })

/** The defaults, re-exported beside the flags that decline to apply them — so a
 *  reader of this file can see what "nobody said" comes to without going two
 *  packages down. */
export { COMMIT_DEFAULT, PUSH_DEFAULT }
