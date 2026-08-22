/**
 * WHAT THE SERVER IS DOING ABOUT GIT, read as the two preference rows read it.
 *
 * Every other preference here is a claim about the READER — how the page is
 * painted, how much of a row is drawn, what happens to finished work — and is
 * stored in this browser and sent nowhere. The two git rows are not preferences
 * at all: "record what is waiting" and "send what was recorded" are claims about
 * a DIRECTORY, which other people may also be writing and which goes on being a
 * directory when every tab is shut. So those rows call `git.setPolicy` and draw
 * the answer off the `git` cell, and nothing about git is stored in this browser
 * — there is no `olai.git.autocommit` key, no per-tab loop for it to arm, and no
 * way for two tabs to disagree.
 *
 * **PURE FUNCTIONS OF THE CELL, and nothing else.** This module holds no state.
 * It used to hold a signal of its own, fed by a subscription of its own
 * (`followPin.ts`, then `followPolicy.ts`), because the pin had to reach the commit pill's sentence
 * without being threaded through it — and that made two places in one client
 * holding what one server said about one directory, kept in step by both
 * reading the same cell. There is one reader now (`../commit/state.ts`'s
 * `createCommit`, whose `git()` every caller of these already has in hand), so
 * these are readings rather than a second copy, and a unit test asks them with
 * a `GitState` built by hand.
 *
 * The SENTENCES live here too, beside the rules rather than with the other row
 * hints in `./Panel.tsx` — and that is deliberate. Every other hint is read off
 * a value this browser owns; these are read off the same value the freezing is
 * read off, and splitting them would let a row be drawn frozen while its line
 * named a flag nobody gave.
 */

import type { CommitMode, GitPolicy, GitState, PushMode } from "@olai/format"

/**
 * ── the readings, so nobody re-derives one ─────────────────────────────
 *
 * The rows ask three things — what is it set to, may I change it, and who said
 * so — and each is answered exactly once. A duplicated derivation is one
 * computation kept in N copies: the fourth reader gets it subtly wrong, and a
 * row drawn frozen whose control was still live would be a policy quietly not
 * applying.
 */

/** The policy in force — what this server DOES about the two verbs. */
export const policyIn = (git: GitState): GitPolicy => git.policy

/** What the Git commit row is set to: `true` for the quiet-window loop, `false`
 *  for the two modes that wait.
 *
 *  `auto` is the only mode that turns the row on, and the other two are one
 *  answer for two reasons: `manual` is "a write waits until somebody asks",
 *  which is the row's Off exactly, and `off` is a directory olai never commits
 *  in, where a loop is not a thing that could happen. */
export const commitOn = (git: GitState): boolean => git.policy.commit === "auto"

/** ... and the same for the push row, whose mode table has only the two values
 *  the row has. */
export const pushOn = (git: GitState): boolean => git.policy.push === "auto"

/** Whether each row is the OPERATOR's rather than anybody's to change — a flag
 *  was given, so the row is drawn read-only with the flag named. */
export const commitFrozen = (git: GitState): boolean => git.pinned.commit !== null
export const pushFrozen = (git: GitState): boolean => git.pinned.push !== null

/**
 * ... and the one thing a Git commit row set to `off` needs to say that "off"
 * does not cover: `--commit=off` is not "a write waits", it is olai never
 * touching git in this directory at all.
 *
 * Its own reading rather than the row asking `policy.commit === "off"` for
 * itself, for {@link commitFrozen}'s reason: every question about the policy is
 * answered here, so the sentence a row prints and the state it is drawn in
 * cannot be read off two different places.
 */
export const commitsOff = (git: GitState): boolean => git.policy.commit === "off"

/** WHO set each row, in the words the panel prints — `null` where nobody did.
 *  Here beside {@link commitFrozen} rather than in the panel, so "is it frozen"
 *  and "what does it say" cannot come apart: both are read off the same pin. */
export const commitSetBy = (git: GitState): string | null =>
  git.pinned.commit === null ? null : setBy("commit", git.pinned.commit)

export const pushSetBy = (git: GitState): string | null =>
  git.pinned.push === null ? null : setBy("push", git.pinned.push)

/**
 * WHO SET THIS ROW, in the words the panel prints under it.
 *
 * The flag is named rather than described, and that is the difference between a
 * control a reader can do something about and one that has simply stopped
 * working: "set by the server" alone leaves somebody looking for a setting that
 * is not anywhere, while the flag is the thing they hand whoever runs the
 * instance.
 *
 * `--commit=off` is spelled as itself even where the operator typed
 * `--no-commit`, because the two are one flag with two spellings and `--help`
 * says so. Nothing on the wire remembers which one was typed, deliberately: a
 * pin that carried its own spelling would be a second thing to keep true.
 */
const setBy = (flag: "commit" | "push", mode: CommitMode | PushMode): string =>
  `Set by the server: --${flag}=${mode}. This is the instance's policy, so it ` +
  `is the same in every browser and cannot be changed from one.`
