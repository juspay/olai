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
 * means "a write waits until something asks", and WHAT ASKS is a Commit button
 * in the browser and a `commit` tool in a terminal. A person running
 * `olai mcp --help` has no button; telling them about one is telling them to go
 * looking for a control their face does not have. So the mode table is shared
 * and the door is named per face — which is why {@link ASKS} is a map with the
 * face as its key: adding a third face is a line here, and forgetting to is a
 * type error rather than a sentence that quietly describes the wrong thing.
 *
 * The parsing itself — including which flag wins when both are given — is
 * {@link commitMode}, and it is a pure function so the truth table can be
 * asserted without a process.
 */

import { COMMIT_MODES, type CommitMode } from "@olai/ops"
import { Flag } from "effect/unstable/cli"

/** The two ways olai is put in front of a directory. Not a general-purpose
 *  vocabulary: it is exactly the set of subcommands, and it exists so the
 *  sentence below can name the right door. */
export type Face = "web" | "mcp"

/** What asks for a commit, on each face. The whole of the difference between
 *  the two help texts, kept as data so it reads as the one clause it is. */
const ASKS: Record<Face, string> = {
  web: "the Commit button in the header",
  mcp: "the `commit` tool",
}

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
export const commitsSaid = (face: Face): string =>
  `when to git-commit writes: manual — a write lands on disk and waits for ${
    ASKS[face]
  } to ask for one, so a finished piece of work is ONE commit (the default); ` +
  `auto — every write commits itself, for a headless serve with nobody to ask; ` +
  `off — olai never touches git in this directory`

/** The flag itself, for the face declaring it. */
export const commitsFor = (face: Face) =>
  Flag.choice("commit", COMMIT_MODES).pipe(
    Flag.withDescription(commitsSaid(face)),
    Flag.withDefault("manual" as CommitMode),
  )

/**
 * `--no-commit`, which stays and means `--commit=off`.
 *
 * It is in scripts and in this repo's own test harness, and a flag that quietly
 * changed meaning would be worse than one that is spelled twice.
 */
export const noCommitFlag = Flag.boolean("no-commit").pipe(
  Flag.withDescription("the same as --commit=off"),
)

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
