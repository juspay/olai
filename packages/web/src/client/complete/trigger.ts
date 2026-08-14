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
 * nothing anyway ({@link ./completing.ts}), so the caps are the second fence
 * rather than the first.
 */

import { TAG_SIGILS, type TagSigil } from "@olai/format"

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

/** The characters a tag is made of — the format's own alphabet, not
 *  re-declared here beyond the class that spells it. */
const TAG_BODY = /^[A-Za-z0-9_/-]*$/

/** Where a sigil may start one: the beginning of the line, or after a space or
 *  an opening bracket. The same rule the format applies to `@`, applied here to
 *  BOTH — a completion is an affordance, and offering one inside `issue#42` is
 *  offering to rewrite the middle of a word somebody is in the middle of
 *  typing. What the format then RECOGNISES as a tag is the format's own
 *  question and a wider one; this is only about when a popup appears. */
const opensAWord = (text: string, at: number): boolean =>
  at === 0 || /[\s([{]/.test(text[at - 1] as string)

export const triggerIn = (text: string, caret: number): Trigger | null => {
  const before = text.slice(0, Math.max(0, Math.min(caret, text.length)))
  const found: Array<Trigger> = []

  const brackets = before.lastIndexOf("((")
  if (brackets !== -1) {
    const query = before.slice(brackets + 2)
    if (query.length <= SEARCH_CAP && !query.includes(")")) {
      found.push({ kind: "mirror", from: brackets, query })
    }
  }

  for (let at = before.length - 1; at >= 0; at--) {
    const char = before[at] as string
    if (char !== "!" && !TAG_SIGILS.includes(char as TagSigil)) continue
    if (!opensAWord(before, at)) continue
    const query = before.slice(at + 1)
    if (char === "!") {
      if (query.length <= DAY_CAP && !query.startsWith(" ") && !query.includes("!")) {
        found.push({ kind: "date", from: at, query })
      }
    } else if (TAG_BODY.test(query)) {
      found.push({ kind: "tag", sigil: char as TagSigil, from: at, query })
    }
    // The nearest opener of this kind is the only one that can be live — an
    // earlier `#` is behind a space by construction, and an earlier `!` would
    // have swallowed this one's text.
    break
  }

  // Rightmost wins: it is the one the caret is inside.
  return found.reduce<Trigger | null>(
    (best, one) => (best === null || one.from > best.from ? one : best),
    null,
  )
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
  trigger: Trigger,
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
