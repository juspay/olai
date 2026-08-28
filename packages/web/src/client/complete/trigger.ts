/**
 * WHICH widget a line has armed, read off the text and the caret.
 *
 * Three characters open something in a row's title — `!` a day, `#` or `@` a
 * tag, `((` a node to mirror — and this is the whole of the rule for all three.
 * A value in, a value out: no element, no signal, no DOM, so what "typing `!`
 * mid-word does nothing" means is a unit test rather than a browser one.
 *
 * ONE SCAN, one answer. The three could have been three independent tests, and
 * they would have disagreed the first time somebody typed `((` after a `#`:
 * whichever opener starts LATEST is the one the caret is inside, because that
 * is what the person is typing now. So the openers are found together and the
 * rightmost wins.
 *
 * ## What ends a trigger
 *
 * Nothing does — deliberately. There is no dismissed flag and no "the widget is
 * open" state anywhere in this feature: what is drawn is a function of the
 * text and the caret, so backspacing over the `!` closes the widget and typing
 * it again opens the same one. That is what makes the whole feature restartable
 * from any keystroke, and it is why {@link Trigger} carries `from` rather than
 * the widget remembering where it started.
 *
 * What each one WILL NOT swallow is the rest of the line, and each has its own
 * fence for it:
 *
 *   - a TAG stops at the tag alphabet, so a space ends it outright;
 *   - a DAY may hold spaces (`next fri`, `aug 20`) but not begin with one, and
 *     is capped — past that many characters this is prose with a `!` in it;
 *   - a NODE SEARCH may hold spaces too, is capped harder, and is ended by the
 *     `)` that closes it.
 *
 * The caps are what keep a stray `!` in the middle of a sentence from arming a
 * widget for the rest of the paragraph. A query that matches nothing draws
 * nothing anyway ({@link ./completing.tsx}), so the caps are the second fence
 * rather than the first.
 */

// WHERE A TAG STARTS AND STOPS IS THE FORMAT'S, and none of it is re-declared
// here: the sigils it recognises, the alphabet a name is made of, and the rule
// about a sigil sitting inside a word are three exports rather than three
// literals in a widget (`@olai/format`'s derive.ts says why, beside the regex
// they all answer for). What is left in this file is only WHERE the caret is.
import { isTagName, TAG_SIGILS, type TagSigil, tagOpensAt } from "@olai/format"

/** What the caret is inside, if anything. `from` is the index of the opener's
 *  FIRST character, so `[from, caret)` is the span a chosen completion
 *  replaces. */
export type Trigger =
  | { readonly kind: "date"; readonly from: number; readonly query: string }
  | {
    readonly kind: "tag"
    readonly sigil: TagSigil
    readonly from: number
    readonly query: string
  }
  | { readonly kind: "mirror"; readonly from: number; readonly query: string }

/** Past this many characters after `!`, a line is prose with an exclamation
 *  mark in it. Long enough for every phrase `../date/natural.ts` reads. */
const DAY_CAP = 24

/** The same fence for `((`, and tighter: a node search is a few words. */
const SEARCH_CAP = 48

/**
 * Whether two triggers are the SAME offer — the widget, where its span starts,
 * and what is inside it.
 *
 * {@link triggerIn} is a parse, so it mints a fresh object every time it is
 * asked, and it is asked on every CARET MOVE: a click into the middle of a line,
 * an arrow key, the `onSelect` a completion's own rewrite fires
 * (`../edit/RowEditor.tsx`). Almost none of those change what is armed — the
 * caret moved three characters inside one `#tag` — and without this each of them
 * re-ran the whole widget: the choices, the failure slot, whether the popup is
 * showing, its kind, and both question thunks
 * (https://github.com/juspay/oss.olai/blob/master/olai/brainstorming/reactivity-after-the-flip.md §4.3).
 *
 * The SIGIL is compared as well as the three fields every arm has, because `#`
 * and `@` are two different lists asked of the same door; `kind` alone would
 * hold a `#ho` popup open over an `@ho` one. It is spelled as a disjunction
 * rather than a narrowed branch because TypeScript will not narrow `is` from a
 * comparison against `was` — the second clause is unreachable given the first,
 * and it is what lets `was.sigil` and `is.sigil` both be read.
 *
 * A FOURTH ARM ADDED TO {@link Trigger} would compile here without being
 * compared, which is the one thing this predicate cannot check for itself:
 * whatever that arm carries beyond `kind`, `from` and `query` belongs in the
 * line below, the way `sigil` is.
 */
export const sameTrigger = (was: Trigger | null, is: Trigger | null): boolean =>
  was === is ||
  (was !== null && is !== null &&
    was.kind === is.kind && was.from === is.from && was.query === is.query &&
    (was.kind !== "tag" || is.kind !== "tag" || was.sigil === is.sigil))

export const triggerIn = (text: string, caret: number): Trigger | null => {
  const before = text.slice(0, Math.max(0, caret))
  const brackets = bracketsIn(before)
  const sigil = sigilIn(before)
  // Rightmost wins: it is the one the caret is inside. Exactly two candidates,
  // because each of the two scans below answers with at most one.
  if (sigil === null) return brackets
  if (brackets === null) return sigil
  return sigil.from > brackets.from ? sigil : brackets
}

/** The `((` nearest the caret, if it is still open. */
const bracketsIn = (before: string): Trigger | null => {
  const at = before.lastIndexOf("((")
  if (at === -1) return null
  const query = before.slice(at + 2)
  return query.length <= SEARCH_CAP && !query.includes(")")
    ? { kind: "mirror", from: at, query }
    : null
}

/**
 * The `!`, `#` or `@` nearest the caret that opens a word, if what follows it
 * is a query that kind will accept.
 *
 * It stops at the FIRST such character, live or not: an earlier `#` is behind a
 * space by construction, and an earlier `!` would have swallowed this one's
 * text. So there is nothing further left that could still be open.
 */
const sigilIn = (before: string): Trigger | null => {
  for (let at = before.length - 1; at >= 0; at--) {
    const char = before[at] as string
    if (char !== "!" && !TAG_SIGILS.includes(char as TagSigil)) continue
    if (!tagOpensAt(before, at)) continue
    const query = before.slice(at + 1)
    if (char === "!") {
      return query.length <= DAY_CAP && !query.startsWith(" ") && !query.includes("!")
        ? { kind: "date", from: at, query }
        : null
    }
    return isTagName(query)
      ? { kind: "tag", sigil: char as TagSigil, from: at, query }
      : null
  }
  return null
}

/** A line and where the caret sits in it — what choosing a completion answers
 *  with, because both change together and a caller that set one without the
 *  other would leave the caret in last frame's sentence. */
export interface Written {
  readonly text: string
  readonly caret: number
}

/**
 * The line with the trigger's span REPLACED by `insert` — the tag completion's
 * answer, and with an empty insert the other two's, which take their span out
 * entirely because what they write is not text at all.
 *
 * ONLY A REMOVAL tidies anything, and only its seam: the two spaces a removal
 * brings together give back one, and a removal at the end of the line does not
 * leave the line ending in one. An insert is put in exactly as it is given —
 * a title is stored verbatim, and an editor with an opinion about somebody's
 * spacing is an editor writing words they did not.
 */
export const written = (
  text: string,
  /** WHERE THE SPAN STARTS, which is all this needs of a trigger — a
   *  {@link Trigger} satisfies it, and so does the chat composer's own
   *  ({@link ../chat/completion.ts}), which completes a file path into a
   *  message through this same function. Taking the narrower thing is what
   *  lets the second caller reuse the rule rather than respell it, and there
   *  is only one arithmetic here worth having two copies of. */
  trigger: { readonly from: number },
  insert: string,
  caret: number,
): Written => {
  const head = text.slice(0, trigger.from)
  const tail = text.slice(caret)
  if (insert !== "") {
    return { text: `${head}${insert}${tail}`, caret: head.length + insert.length }
  }
  if (tail === "") return { text: head.trimEnd(), caret: head.trimEnd().length }
  const joined = head.endsWith(" ") && tail.startsWith(" ") ? head.slice(0, -1) : head
  return { text: `${joined}${tail}`, caret: joined.length }
}
