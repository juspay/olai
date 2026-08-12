/**
 * What a repository IS right now — the half of this package that has no
 * subprocess in it.
 *
 * It sits in its own module, and on its own `./state` subpath, for one reason:
 * these values TRAVEL THE WIRE. `@olai/format` re-exports them so the pending
 * schema can carry them, the browser imports that schema, and the browser must
 * never pull `node:child_process` into its bundle — which is exactly what
 * importing this package's main entry would do. So the vocabulary is
 * reachable without the plumbing, the way `./testlib` is reachable without
 * either.
 *
 * Schemas rather than plain types, because the wire needs them: one
 * declaration, decoded by the surface and read by everything above.
 */

import { Schema } from "effect"

/**
 * What happened to a file that moved, out of the porcelain XY letters.
 *
 * Five words rather than the letter pair, because what a reader wants is the
 * word — and because the pair says index-and-work-tree, a distinction olai
 * deliberately has no opinion about: it never touches the index.
 *
 * Here rather than beside the parser that produces it, for the same reason
 * {@link RepoState} is: it travels. A dirty file's status is drawn as a chip in
 * the commit panel, so the value crosses the wire, and one declaration is what
 * keeps the letters, the schema and the chip from being kept in step by hand.
 */
export const How = Schema.Literals([
  "modified",
  "added",
  "deleted",
  "renamed",
  "untracked",
])
export type How = typeof How.Type

/** Why the repository cannot take a commit right now. Nothing used to check
 *  for any of them, which is how an agent marking a node done mid-conflict
 *  could swallow a resolution — the hole that decided manual over automatic,
 *  and the reason this type exists. Every commit path now refuses when the
 *  answer is one of these. */
export const Reason = Schema.Literals(["merge", "rebase", "cherry-pick", "detached"])
export type Reason = typeof Reason.Type

/**
 * Whether the served directory can be committed to.
 *
 * Five arms, and EVERY ONE OF THEM IS DRAWN. That is the decision the whole
 * control turns on: the commit feature exists to be an audit trail of what the
 * tool wrote, so "there is no audit trail here" is the single most important
 * thing it can say, and a pill that disappeared is exactly how a person would
 * never find that out. Same argument as the connection dot, which stays green
 * when it is healthy rather than vanishing.
 *
 * `Off` and `NoRepo` are SETTINGS, not faults — a directory of notes under
 * Dropbox is not this program's business, and neither is a server started with
 * `--commit=off`. They are drawn dim and inert, with no warning colour.
 * `Blocked` and `Unusable` are the two a reader is owed an explanation for, and
 * `Blocked` is the one a person can act on.
 *
 * `Unusable` is #108's, and it is why this is five arms rather than four: git
 * RAN and could not answer — no binary on the PATH, dubious ownership, a
 * repository it refuses to use. Folding that into `NoRepo` would say "your
 * notes are not a repository" to somebody whose notes are, which is the exact
 * bug `git-invisible` was filed for. One state, one sentence, and git keeps its
 * own words.
 *
 * `Off` is the one arm this package never produces: nothing here knows olai has
 * a `--commit` flag. It is declared here anyway because the value is one union
 * on the wire, and splitting it across two packages by which of them mints each
 * arm would be splitting a type by its authors rather than by what it means.
 */
export const RepoState = Schema.Union([
  Schema.Struct({ _tag: Schema.Literal("Off") }),
  Schema.Struct({ _tag: Schema.Literal("NoRepo") }),
  Schema.Struct({
    _tag: Schema.Literal("Ready"),
    branch: Schema.String,
  }),
  Schema.Struct({
    _tag: Schema.Literal("Blocked"),
    reason: Reason,
    /** Git's own words, kept as a field rather than folded into a sentence. */
    said: Schema.String,
  }),
  Schema.Struct({
    _tag: Schema.Literal("Unusable"),
    /** Git's own words, for the same reason `Blocked` keeps them. */
    said: Schema.String,
  }),
])
export type RepoState = typeof RepoState.Type
