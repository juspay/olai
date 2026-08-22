/**
 * WHAT THE SERVER IS DOING ABOUT GIT, and what that means for the two rows on
 * the preferences panel that used to be this browser's alone.
 *
 * Every other preference here is a claim about the READER — how the page is
 * painted, how much of a row is drawn, what happens to finished work — and is
 * stored in this browser and sent nowhere. The two git rows were always the odd
 * ones out: "record what is waiting" and "send what was recorded" are claims
 * about a DIRECTORY, which other people may also be writing and which goes on
 * being a directory when every tab is shut.
 *
 * `vault-level-settings` answered half of that by letting an operator PIN
 * either row from the command line. `git-policy-server-side` answered the rest:
 * the rows set the SERVER's policy now, through `git.setPolicy`, and what they
 * DRAW is the policy the server publishes on the git cell. Nothing about git is
 * stored in this browser any more — there is no `olai.git.autocommit` key, no
 * per-tab loop for it to arm, and no way for two tabs to disagree.
 *
 * TWO MODULES rather than one, and the seam is the wire. This one holds the
 * value and the rules over it and imports nothing from the connection, so the
 * rows it feeds stay unit-testable with the policy set by hand;
 * `./followPolicy.ts` beside it is the subscription that fills it, started once
 * from `main.tsx` like every other document-lifetime follower.
 *
 * NOTHING HERE IS STORED. The policy belongs to the running server, so it
 * arrives on every connection and is forgotten with the tab. What is remembered
 * is remembered THERE — outside the vault, keyed by the served path
 * (`@olai/server`'s `gitPolicy.ts`) — which is the ruling that a settings file
 * in the vault would travel with `git pull` and hand a personal clone the
 * team's auto-push.
 *
 * The SENTENCES live here too, beside the rules rather than with the other row
 * hints in `./Panel.tsx` — and that is deliberate. Every other hint is read off
 * a value this browser owns; these are read off the same value the freezing is
 * read off, and splitting them would let a row be drawn frozen while its line
 * named a flag nobody gave.
 */

import { type Accessor, createRoot, createSignal } from "solid-js"

import {
  type CommitMode,
  DEFAULT_POLICY,
  GIT_OFF,
  type GitPolicy,
  type GitState,
  type PushMode,
} from "@olai/format"

/** What the server last said about git, and the one way it is written — see
 *  `./followPolicy.ts` for who writes it. `createRoot` because this outlives
 *  every component that reads it, which is the shape `../pins/pinning.ts`
 *  already keeps app-wide state in. */
const [state, setState] = createRoot(() => createSignal<GitState>(GIT_OFF))

/** What git is doing for this directory — {@link GIT_OFF} until the server has
 *  said, which is the calm face rather than a fault. */
export const gitSaid: Accessor<GitState> = state

/** Told what the server said. Called by `./followPolicy.ts`, and by a test that
 *  wants a pinned or paused panel without a server. */
export const setGitSaid = (value: GitState): void => {
  setState(value)
}

/**
 * ── the readings, so nobody re-derives one ─────────────────────────────
 *
 * The rows ask three things — what is it set to, may I change it, and who said
 * so — and each is answered exactly once. A duplicated derivation is one
 * computation kept in N copies: the fourth reader gets it subtly wrong, and a
 * row drawn frozen whose control was still live would be a team's policy
 * quietly not applying.
 */

/** What the Git commit row is set to: `true` for the quiet-window loop, `false`
 *  for the two modes that wait.
 *
 *  `auto` is the only mode that turns the row on, and the other two are one
 *  answer for two reasons: `manual` is "a write waits until somebody asks",
 *  which is the row's Off exactly, and `off` is a directory olai never commits
 *  in, where a loop is not a thing that could happen. */
export const commitOn = (): boolean => policy().commit === "auto"

/** ... and the same for the push row, whose mode table has only the two values
 *  the row has. */
export const pushOn = (): boolean => policy().push === "auto"

/** The policy in force, or the defaults before the server has said. */
export const policy = (): GitPolicy => gitSaid().policy ?? DEFAULT_POLICY

/** Whether each row is the OPERATOR's rather than anybody's to change — a flag
 *  was given, so the row is drawn read-only with the flag named. */
export const commitFrozen = (): boolean => gitSaid().pinned.commit !== null
export const pushFrozen = (): boolean => gitSaid().pinned.push !== null

/**
 * ... and the one thing a Git commit row set to `off` needs to say that "off"
 * does not cover: `--commit=off` is not "a write waits", it is olai never
 * touching git in this directory at all.
 *
 * Its own reading rather than the row asking `policy().commit === "off"` for
 * itself, for {@link commitFrozen}'s reason: every question about the policy is
 * answered here, so the sentence a row prints and the state it is drawn in
 * cannot be read off two different places.
 */
export const commitsOff = (): boolean => policy().commit === "off"

/** Why the quiet-window loop stopped, or `null` while it is running — what puts
 *  the Resume button on the Git commit row. */
export const paused = (): string | null => gitSaid().paused

/** WHO set each row, in the words the panel prints — `null` where nobody did.
 *  Here beside {@link commitFrozen} rather than in the panel, so "is it frozen"
 *  and "what does it say" cannot come apart: both are read off the same pin. */
export const commitSetBy = (): string | null => {
  const mode = gitSaid().pinned.commit
  return mode === null ? null : setBy("commit", mode)
}

export const pushSetBy = (): string | null => {
  const mode = gitSaid().pinned.push
  return mode === null ? null : setBy("push", mode)
}

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
