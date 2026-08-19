/**
 * `--commit`, for whichever face is asking.
 *
 * Both subcommands write, so both take the flag, and what it MEANS is one
 * answer: the same three modes, the same default, the same `--no-commit`
 * override. That much is HACKING.md's rule — "MCP and Web ops must be
 * consistent; never deviate" — and the reason this file exists at all rather
 * than the flag being declared twice in `./main.ts`.
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
 */

import {
  COMMIT_MODES,
  type CommitFace,
  commitDoors,
  type CommitMode,
} from "@olai/ops"
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
 */
export const commitsSaid = (face: CommitFace): string =>
  `when to git-commit writes: manual — a write lands on disk and waits for ${
    commitDoors(face)
  } to ask for one, so a finished piece of work is ONE commit (the default); ` +
  `auto — every write commits itself, for a headless serve with nobody to ask; ` +
  `off — olai never touches git in this directory`

/**
 * The flag PAIR a subcommand takes, as one thing.
 *
 * Both or neither: `--no-commit` is only meaningful beside `--commit`, and
 * `--commit` without it would silently drop an opt-out that is in scripts and in
 * this repo's own test harness. Handing a caller two exports to spread into its
 * own options object would make "which flags does a face take" a question
 * answered at each call site — which is one call site away from the two faces
 * taking different ones, the exact thing this module exists to prevent.
 */
export const commitFlags = (face: CommitFace) => ({
  commits: Flag.choice("commit", COMMIT_MODES).pipe(
    Flag.withDescription(commitsSaid(face)),
    Flag.withDefault("manual" as CommitMode),
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
 * The two flags above, as the one answer they are between them.
 *
 * `--no-commit` WINS when both are given, because it is the one that turns
 * something off: a person who typed both said "off" once and something else
 * once, and honouring the opt-out is the reading that cannot surprise them by
 * writing to a history they asked olai to stay out of.
 */
export const commitMode = (chosen: CommitMode, off: boolean): CommitMode =>
  off ? "off" : chosen
