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
 * **What these flags produce is a PIN, not a mode.** Whether a flag was GIVEN is
 * a fact every browser has to be told, because a given flag is named under the
 * row (`--commit=auto`) while an omitted one is the built-in default. Both are
 * the instance's policy, read-only, the same in every browser — there is no
 * runtime door. So {@link gitPin} answers with `null` for a flag nobody typed.
 * A single `CommitMode` here could not tell the two apart: `--commit=manual`
 * typed out loud is a team's policy named as a flag, while the same mode
 * arrived at by saying nothing is the default.
 *
 * **The policy is immutable after boot.** Flags plus the built-in defaults,
 * held in memory. There is no remembered file and no `git.setPolicy`. Stale
 * files under `$XDG_STATE_HOME/olai/git/` from an older olai are inert.
 */

import {
  COMMIT_MODES,
  type CommitMode,
  type GitPin,
  PUSH_MODES,
  type PushMode,
  QUIET_MS,
} from "@olai/format"
import { type CommitFace, commitDoors, fixedPolicy, type Policy } from "@olai/ops"
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
 * The last clause is the instance: giving the flag sets this server's policy
 * for every browser, and omitting it uses the built-in default. Either way the
 * row is read-only.
 */
export const commitsSaid = (face: CommitFace): string =>
  `when to git-commit writes: manual — a write lands on disk and waits for ${
    commitDoors(face)
  } to ask for one, so a finished piece of work is ONE commit (the default); ` +
  `auto — everything waiting records itself once writes stop arriving for ` +
  `${Math.round(QUIET_MS / 1000)} seconds, whoever made them; ` +
  `off — olai never touches git in this directory. ${INSTANCE}`

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
  `makes here, by whichever door, is followed by the push. ${INSTANCE}`

/** The clause both sentences end with. Spelled once, because it is one fact
 *  about either flag and two copies of it is one place for it to be softened. */
const INSTANCE =
  "This is the instance's policy: every browser draws that preference row " +
  "read-only, the same in every browser. Giving this flag sets it; omitting " +
  "it uses the built-in default."

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
 * survives all the way to the browser (which names a given flag and otherwise
 * the built-in default). `--no-commit` is the exception and is a boolean,
 * because that is what it has always been.
 */
export const gitFlags = (face: CommitFace) => ({
  commits: Flag.choice("commit", COMMIT_MODES).pipe(
    Flag.withDescription(commitsSaid(face)),
    // NOT `withDefault(COMMIT_DEFAULT)`. Omission has to stay distinguishable
    // from `--commit=manual`, because the two do the same thing on this server
    // and different things on the row that names who set it.
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
 * `null` on either half is nobody having said: that half is the built-in
 * default. What the server then DOES with the pair is `@olai/format`'s
 * `policyOf`, which fills the defaults in. There is no third source.
 */
export const gitPin = (
  chosen: CommitMode | null,
  off: boolean,
  pushes: PushMode | null,
): GitPin => ({ commit: off ? "off" : chosen, push: pushes })

/**
 * Open this directory's policy: the flags, plus the built-in defaults.
 *
 * IMMUTABLE after boot. Held in memory; nothing is read from disk and nothing
 * is written. A leftover `$XDG_STATE_HOME/olai/git/<digest>.json` from an older
 * olai is not consulted.
 */
export const openPolicy = (pin: GitPin): Policy => fixedPolicy(pin)

/** The defaults, re-exported beside the flags that decline to apply them — so a
 *  reader of this file can see what "nobody said" comes to without going two
 *  packages down. (The line under this sentence had gone missing, which is why
 *  `--help`'s "the default" and the value it names were two claims nothing
 *  joined.) */
export { COMMIT_DEFAULT, PUSH_DEFAULT } from "@olai/format"
