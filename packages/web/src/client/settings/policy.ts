/**
 * WHAT THE SERVER IS DOING ABOUT GIT, read as the two preference rows read it.
 *
 * Every other preference here is a claim about the READER — how the page is
 * painted, how much of a row is drawn, what happens to finished work — and is
 * stored in this browser and sent nowhere. The two git rows are not preferences
 * at all: "record what is waiting" and "send what was recorded" are claims about
 * a DIRECTORY, which other people may also be writing and which goes on being a
 * directory when every tab is shut. So those rows DRAW the answer off the `git`
 * cell, always read-only — the instance's policy, the same in every browser.
 * Nothing about git is stored in this browser: there is no `olai.git.autocommit`
 * key, no per-tab loop for it to arm, and no way for two tabs to disagree.
 *
 * **PURE FUNCTIONS OF THE CELL, and nothing else.** This module holds no state.
 * There is one reader (`../commit/state.ts`'s `createCommit`, whose `git()`
 * every caller of these already has in hand), so these are readings rather than
 * a second copy, and a unit test asks them with a `GitState` built by hand.
 *
 * The SENTENCES live here too, beside the rules rather than with the other row
 * hints in `./Panel.tsx` — and that is deliberate. Every other hint is read off
 * a value this browser owns; these are read off the same value the instance
 * line is read off, and splitting them would let a row name a flag nobody gave.
 * What is NOT here is the doctrine those lines end with — that the row is the
 * instance's and this browser cannot change it — because the plugin rows
 * (`./plugins.ts`) say the same thing about a different flag. One copy, in
 * `./instance.ts`.
 */

import type { CommitMode, GitState, PushMode } from "@olai/format"

import { loopIn } from "../commit/said.ts"
import { builtInDefault, setByServer } from "./instance.ts"

/**
 * ── the readings, so nobody re-derives one ─────────────────────────────
 *
 * The rows ask three things — what is it set to, and who said so — and each
 * is answered exactly once. A duplicated derivation is one computation kept
 * in N copies: the fourth reader gets it subtly wrong.
 */

/**
 * What the Git commit row is set to: `true` for the quiet-window loop, `false`
 * for the two modes that wait.
 *
 * READ THROUGH `loopIn` (`../commit/said.ts`), which is the pill's own reading
 * of the same question — "is the window running here" — so the segmented
 * control and the chip's `data-auto` cannot come to disagree about one
 * directory. A third commit mode that counted as running would otherwise move
 * one of them and not the other, with no test to catch it.
 *
 * `auto` is the only mode that turns the row on, and the other two are one
 * answer for two reasons: `manual` is "a write waits until somebody asks",
 * which is the row's Off exactly, and `off` is a directory olai never commits
 * in, where a loop is not a thing that could happen — a STOPPED loop still
 * reads on, because the row is the policy rather than the loop's health.
 */
export const commitOn = (git: GitState): boolean => loopIn(git) !== "off"

/** ... and the same for the push row, whose mode table has only the two values
 *  the row has. */
export const pushOn = (git: GitState): boolean => git.policy.push === "auto"

/**
 * ... and the one thing a Git commit row set to `off` needs to say that "off"
 * does not cover: `--commit=off` is not "a write waits", it is olai never
 * touching git in this directory at all.
 *
 * Its own reading rather than the row asking `policy.commit === "off"` for
 * itself, for the same reason the other readings live here: every question
 * about the policy is answered here, so the sentence a row prints and the
 * state it is drawn in cannot be read off two different places.
 */
export const commitsOff = (git: GitState): boolean => git.policy.commit === "off"

/** WHO set each row, in the words the panel prints. Always a sentence: these
 *  rows are always the instance's, so they always have something to say about
 *  who set them — a given flag, or the built-in default. */
export const commitSetBy = (git: GitState): string =>
  git.pinned.commit === null ? builtInDefault("--commit") : setBy("commit", git.pinned.commit)

export const pushSetBy = (git: GitState): string =>
  git.pinned.push === null ? builtInDefault("--push") : setBy("push", git.pinned.push)

/**
 * WHO SET THIS ROW, in the words the panel prints under it.
 *
 * The words are `./instance.ts`'s and not this module's, because they are not
 * about git: one row per plugin says the same two things about the same kind of
 * fact, and a second copy of the doctrine is the copy somebody softens. What is
 * git's — and stays here — is the SPELLING of the flag.
 *
 * `--commit=off` is spelled as itself even where the operator typed
 * `--no-commit`, because the two are one flag with two spellings and `--help`
 * says so. Nothing on the wire remembers which one was typed, deliberately: a
 * pin that carried its own spelling would be a second thing to keep true.
 */
const setBy = (flag: "commit" | "push", mode: CommitMode | PushMode): string =>
  setByServer(`--${flag}=${mode}`)
