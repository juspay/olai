/**
 * WHAT THE MESSAGE BOX HAS ARMED, read off the draft and the caret.
 *
 * Two characters open a list over the composer — `/` the agent's own commands,
 * `@` a file of the served directory — and this is the whole of the rule for
 * both. A value in, a value out: no element, no signal, no DOM, so "typing `@`
 * inside a word does nothing" is a unit test rather than a browser one. It is
 * `../complete/trigger.ts`'s arrangement one panel over, and deliberately so:
 * that file's first argument — one scan, one answer, no "the popup is open"
 * flag anywhere — is what makes a completion survive everything else that can
 * happen to a line mid-typing.
 *
 * ## The two cannot both be armed
 *
 * Not by a precedence rule but by construction, which is better: a command is
 * the WHOLE line (`/` first character, no space anywhere yet), and an `@` only
 * opens a list where a word opens — the start of the box, or after a space or
 * a bracket. So `/review` is a command and never a path, `/rev@x` is a command
 * whose `@` sits inside a word, and `look at @no` is a path because the line
 * stopped being a command at the space. There is no third case to order.
 *
 * ## What ends a trigger
 *
 * Nothing does, again deliberately — what is drawn is a function of the text
 * and the caret, so backspacing over the `@` shuts the list and typing it
 * again opens the same one. What each one WILL NOT swallow is the rest of the
 * message, and each has its own fence: a command ends at the first space, and
 * a path ends at any whitespace at all. The cap below is a second fence rather
 * than the first.
 *
 * ## `@` here is not the outline's `@`
 *
 * `@` IS a tag sigil in olai's format (`@olai/format`'s `TAG_SIGILS`), and a
 * row's title editor completes `@alice` against the tags the set already
 * writes (`../complete/tags.ts`). None of that vocabulary exists HERE: a chat
 * message is prose on its way to an agent, never a stored title, and nothing
 * in the panel parses a `#` or an `@` out of what was typed. So the two cannot
 * disagree about one string — they never read the same string.
 *
 * Where they meet is a HABIT rather than a syntax: somebody who writes
 * `@alice` in titles will type `@alice` in the box meaning the person. Three
 * things keep that from being fought over, and they are the reason this file
 * offers rather than corrects:
 *
 *   - the list is drawn only when a served file actually matches, so an `@`
 *     naming a person types straight through;
 *   - nothing is ever rewritten unless a row is CHOSEN — there is no
 *     autocorrect here, and a message sends exactly as it reads;
 *   - Escape puts the list away for that `@` and leaves the word alone, which
 *     is what makes the very next Enter the send it was meant to be.
 *
 * The one rule that IS shared is where a sigil may open at all: `tagOpensAt`
 * is the format's own, asked here rather than respelled, because "an `@` in
 * the middle of a word is part of the word" is the same sentence about
 * `issue#42` and about `srid@example.com`.
 */

import { tagOpensAt } from "@olai/format"

/** What the box has armed, if anything. `from` is the index of the opener's
 *  FIRST character, so `[from, caret)` is the span a chosen row replaces —
 *  which is what `../complete/trigger.ts`'s `written` takes. */
export type Completing =
  | { readonly kind: "command"; readonly from: number; readonly query: string }
  | { readonly kind: "path"; readonly from: number; readonly query: string }

/**
 * Past this many characters after an `@`, this is prose with an address in it.
 *
 * Generous, because it is the SECOND fence and not the first: whitespace ends
 * a path query outright, so prose can never run away into one. What this
 * catches is the other shape — one enormous unbroken token, a pasted URL, a
 * base64 blob — where a matcher would otherwise scan the whole directory on
 * every keystroke of something that was never going to be a path.
 */
const PATH_CAP = 120

export const completingIn = (text: string, caret: number): Completing | null =>
  commandIn(text) ?? pathIn(text, caret)

/**
 * The `/` that makes this whole line a command, if it still is one.
 *
 * The WHOLE line rather than the span before the caret, which is the rule the
 * composer has always had: a command is the entire message or it is not a
 * command, so a `/` with something typed after it somewhere else on the line
 * is not one. It ends at the first space, because that is where the command's
 * own arguments start and an agent's argument is not something olai completes.
 */
const commandIn = (text: string): Completing | null => {
  if (!text.startsWith("/")) return null
  return text.includes(" ")
    ? null
    : { kind: "command", from: 0, query: text.slice(1) }
}

/**
 * The `@` nearest the caret that opens a word, if what follows it could still
 * be a path.
 *
 * It stops at the FIRST such character walking back, live or not: an earlier
 * `@` is behind whitespace by construction, and whitespace is exactly what
 * would have ended it. So there is nothing further left that could still be
 * open.
 */
const pathIn = (text: string, caret: number): Completing | null => {
  const before = text.slice(0, Math.max(0, caret))
  for (let at = before.length - 1; at >= 0; at--) {
    if (before[at] !== "@") continue
    if (!tagOpensAt(before, at)) continue
    const query = before.slice(at + 1)
    return query.length <= PATH_CAP && !/\s/.test(query)
      ? { kind: "path", from: at, query }
      : null
  }
  return null
}

/** WHICH token a dismissal is about: the kind and where it starts, so Escape
 *  over one `@` keeps that one shut while it is being typed and a second `@`
 *  further along the line is a fresh offer. The composer's own memory of a
 *  dismissal is this string and nothing else. */
export const tokenOf = (found: Completing): string =>
  `${found.kind}:${found.from}`

/**
 * What a chosen file writes into the message: the path, still wearing the `@`
 * it was completed from, and a space after it.
 *
 * THE `@` STAYS, which is the decision worth naming. It is not markup — the
 * agent is handed the message verbatim — so what it buys is what it buys in
 * every terminal that has this gesture: the message says out loud that this
 * word is a file, both to the person re-reading their own sentence before
 * sending and to the agent reading it after. A bare path in a sentence is a
 * word with a slash in it.
 *
 * THE SPACE IS THE COMPOSER'S OWN habit, from the slash completion beside it
 * (`/review ` is what accepting a command writes): a message is prose and the
 * next thing typed is the next word. It is also what ends the trigger, since
 * whitespace is what a path query stops at — so the list is gone the moment
 * the row is taken, with nothing to remember.
 *
 * That is the opposite of what the row editor's tag completion does, and the
 * two are right for their own reasons: a title is STORED verbatim, so a space
 * nobody typed is a space in somebody's git history. Nothing here is stored.
 *
 * THE PATH GOES IN AS IT IS, including a name with a space in it. Such a file
 * is still offered — the query stops at whitespace, so it is found by the
 * segment before the space — and what is written is the path, unquoted. A
 * quoting convention would be one only olai understands: the agent is handed
 * the sentence, not a syntax, and inventing punctuation for it to parse would
 * be worse than a sentence a reader can see the shape of.
 */
export const inserted = (path: string): string => `@${path} `
