/**
 * What the SERVER decided about git, and what that does to the two rows on the
 * preferences panel that would otherwise be this browser's alone.
 *
 * Every other preference here is a claim about the READER — how the page is
 * painted, how much of a row is drawn, what happens to finished work — and is
 * stored in this browser and sent nowhere. The two git rows are the exception
 * and always have been slightly odd: "record what is waiting" and "send what
 * was recorded" are claims about a DIRECTORY that other people may also be
 * writing. Single-user, that difference does not matter and the preference is
 * exactly right. In a team deployment it is the whole problem — auto-push is
 * not a thing one colleague's browser gets to decide for the branch — so the
 * operator may PIN either row from the command line (`--commit`, `--push`), and
 * a pinned row is drawn read-only with the flag that set it named.
 *
 * TWO MODULES rather than one, and the seam is the wire. This one holds the
 * value and the rules over it and imports nothing from the connection, so the
 * preferences it gates stay unit-testable with the pin set by hand; `./followPin.ts`
 * beside it is the subscription that feeds it, started once from `main.tsx`
 * like every other document-lifetime follower.
 *
 * NOTHING HERE IS STORED. A pin belongs to the running server, so it arrives on
 * every connection and is forgotten with the tab — which is also what makes
 * unpinning safe: the browser's own stored preference was never overwritten, so
 * a server restarted without the flag hands each reader their own choice back.
 *
 * The SENTENCE lives here too, beside the rule rather than with the other row
 * hints in `./Panel.tsx` — and that is deliberate. Every other hint is read off
 * a value this browser owns; this one is read off the same pin the freezing is
 * read off, and splitting them would let a row be drawn frozen while its line
 * named a flag nobody gave.
 */

import { type Accessor, createRoot, createSignal } from "solid-js"

import {
  type CommitMode,
  type GitPin,
  NO_PIN,
  type PushMode,
} from "@olai/format"

/** The pin in force, and the one way it is written — see `./followPin.ts` for who
 *  writes it. `createRoot` because this outlives every component that reads it,
 *  which is the shape `../pins/pinning.ts` already keeps app-wide state in. */
const [pin, setPin] = createRoot(() => createSignal<GitPin>(NO_PIN))

/** What this server pinned — {@link NO_PIN} until it has said, and for every
 *  server that pinned nothing. */
export const pinned: Accessor<GitPin> = pin

/** Told what the server said. Called by `./followPin.ts`, and by a test that wants a
 *  pinned panel without a server. */
export const setPinned = (value: GitPin): void => {
  setPin(value)
}

/**
 * What a pinned `--commit` means for the Git commit row: `true` for a row
 * frozen ON, `false` for one frozen OFF, `null` for a row nobody pinned.
 *
 * `auto` is the only mode that turns the row on, and the other two are one
 * answer for two reasons: `manual` is "a write waits until somebody asks",
 * which is the row's Off exactly, and `off` is a directory olai never commits
 * in, where a browser recording on its own is not a thing that could happen.
 *
 * It is NOT the same claim `--commit=auto` makes about the server, and the two
 * agreeing is the point rather than a coincidence: that mode commits each write
 * as it lands, this row sweeps the whole repository once the edits stop, and an
 * operator who asked for one has asked for the policy both of them are.
 */
export const pinnedCommit = (pin: GitPin): boolean | null =>
  pin.commit === null ? null : pin.commit === "auto"

/** ... and the same for `--push`, which has only the two values the row has. */
export const pinnedPush = (pin: GitPin): boolean | null =>
  pin.push === null ? null : pin.push === "auto"

/**
 * ── the readings, so nobody re-derives one ─────────────────────────────
 *
 * WHETHER EACH ROW IS THE SERVER'S, as one accessor each. Three surfaces ask —
 * the preferences panel (which draws the row read-only), the commit pill and
 * the commit panel (whose paused sentence names the gesture a frozen row
 * actually has) — and the derivation was spelled at all three. A duplicated
 * derivation is one computation kept in N copies: the fourth reader gets it
 * subtly wrong, and a row drawn frozen whose control was still live would be a
 * team's policy quietly not applying.
 */
export const commitFrozen = (): boolean => pinnedCommit(pinned()) !== null
export const pushFrozen = (): boolean => pinnedPush(pinned()) !== null

/** WHO set each row, in the words the panel prints — `null` where nobody did.
 *  Here beside {@link commitFrozen} rather than in the panel, so "is it frozen"
 *  and "what does it say" cannot come apart: both are read off the same pin. */
export const commitSetBy = (): string | null => {
  const mode = pinned().commit
  return mode === null ? null : setBy("commit", mode)
}

export const pushSetBy = (): string | null => {
  const mode = pinned().push
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
