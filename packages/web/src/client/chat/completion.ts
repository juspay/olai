/**
 * WHAT THE MESSAGE BOX HAS ARMED, read off the draft and the caret.
 *
 * Two characters open a list over the composer — `/` the agent's own commands,
 * `@` something the served directory holds, a file or a node — and this is the
 * whole of the rule for both. A value in, a value out: no element, no signal,
 * no DOM, so "typing `@` inside a word does nothing" is a unit test rather than
 * a browser one. It is
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
 * a bracket. So `/review` is a command and never a name, `/rev@x` is a command
 * whose `@` sits inside a word, and `look at @no` is a name because the line
 * stopped being a command at the space. There is no third case to order.
 *
 * ## What ends a trigger
 *
 * Nothing does, again deliberately — what is drawn is a function of the text
 * and the caret, so backspacing over the `@` shuts the list and typing it
 * again opens the same one. What each one WILL NOT swallow is the rest of the
 * message, and each has its own fence: a command ends at the first space, and
 * a name ends at any whitespace at all. The cap below is a second fence rather
 * than the first.
 *
 * That fence is why the node half of the `@` list takes a query of ONE TOKEN
 * where the grammar it is read by has quoting, `OR` and multi-word conjunctions
 * (`./nodes.ts`): a trigger that took a space would be a completion eating the
 * rest of somebody's sentence on the chance the next word was meant for it.
 *
 * ## `@` here is not the outline's `@`
 *
 * `@` IS a tag sigil in olai's format (`@olai/format`'s `TAG_SIGILS`), and a
 * row's title editor completes `@alice` against the tags the set already
 * writes (`../complete/tags.ts`). None of that vocabulary exists HERE: a chat
 * message is prose on its way to an agent, never a stored title, and no `#` or
 * `@` in it is read as a tag by anything. So the two cannot disagree about one
 * string — they never read the same string.
 *
 * Where they meet is a HABIT rather than a syntax: somebody who writes
 * `@alice` in titles will type `@alice` in the box meaning the person. Three
 * things keep that from being fought over, and they are the reason this file
 * offers rather than corrects:
 *
 *   - the list is drawn only when a served file or node actually matches, so an
 *     `@` naming a person types straight through;
 *   - nothing is ever rewritten unless a row is CHOSEN — there is no
 *     autocorrect here, and a message sends exactly as it reads;
 *   - Escape puts the list away for that `@` and leaves the word alone, which
 *     is what makes the very next Enter the send it was meant to be.
 *
 * {@link namedIn} below is the one place the panel reads an `@` back out of a
 * message, and it is deliberately not a parser of prose: it can only recognise
 * words this box itself wrote, because it is asked which of the ids ALREADY
 * TAKEN from the list the message still says. Typing `@alice` arms nothing,
 * whatever the set declares — and the trigger, the read-back and the removal
 * are three questions about ONE walk (`namesOf`), so none of them can come to
 * disagree with the list that wrote a word.
 *
 * The one rule that IS shared is where a sigil may open at all: `tagOpensAt`
 * is the format's own, asked here rather than respelled, because "an `@` in
 * the middle of a word is part of the word" is the same sentence about
 * `issue#42` and about `srid@example.com`.
 */

import { tagOpensAt } from "@olai/format"

import { type Written, written } from "../complete/trigger.ts"

/** What the box has armed, if anything. `from` is the index of the opener's
 *  FIRST character, so `[from, caret)` is the span a chosen row replaces —
 *  which is what `../complete/trigger.ts`'s `written` takes. */
export type Completing =
  | { readonly kind: "command"; readonly from: number; readonly query: string }
  /** An `@`: what the directory holds under that word, a file or a node. It
   *  was `path` while a path was the only thing the list could offer, which
   *  was never the name of the TRIGGER — the trigger is the `@`, and what it
   *  completes is a name for something ({@link ./naming.ts}). */
  | { readonly kind: "name"; readonly from: number; readonly query: string }

/**
 * Past this many characters after an `@`, this is prose with an address in it.
 *
 * Generous, because it is the SECOND fence and not the first: whitespace ends
 * the query outright, so prose can never run away into one. What this catches
 * is the other shape — one enormous unbroken token, a pasted URL, a base64 blob
 * — where two matchers would otherwise scan the whole directory and the whole
 * set on every keystroke of something that was never going to be a name.
 */
const NAME_CAP = 120

export const completingIn = (text: string, caret: number): Completing | null =>
  commandIn(text) ?? nameIn(text, caret)

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
 * The `@` the caret is inside, if what follows it could still be a name.
 *
 * The LAST name in the text before the caret, and only when it reaches the
 * caret — an earlier `@` is behind whitespace by construction, and whitespace
 * is exactly what would have ended it, so a name that stops short of the caret
 * is a name somebody has finished typing.
 *
 * Through {@link namesOf}, which is what makes "the two readers cannot disagree
 * with the list that wrote a word" a fact rather than a hope: the trigger, the
 * read-back and the removal are three questions about one walk. Written as its
 * own backwards scan, this file held two spellings of "where a word starts and
 * where it ends" and they agreed by coincidence of two regexes.
 */
const nameIn = (text: string, caret: number): Completing | null => {
  const before = text.slice(0, Math.max(0, caret))
  const said = namesOf(before).at(-1)
  if (said === undefined) return null
  // The QUERY is what was WRITTEN — the whole of it, not the name with what a
  // sentence puts after it trimmed off. A caret after `@hinges,` asks the two
  // lists about `hinges,`, which is a thing neither of them holds, so the list
  // shuts on the comma; trimming here instead would re-open it over a word
  // somebody has finished and offer to rewrite the punctuation out of it.
  const query = before.slice(said.at + 1)
  return !/\s/.test(query) && query.length <= NAME_CAP
    ? { kind: "name", from: said.at, query }
    : null
}

/** WHICH token a dismissal is about: the kind and where it starts, so Escape
 *  over one `@` keeps that one shut while it is being typed and a second `@`
 *  further along the line is a fresh offer. The composer's own memory of a
 *  dismissal is this string and nothing else. */
export const tokenOf = (found: Completing): string =>
  `${found.kind}:${found.from}`

/**
 * What a chosen row writes into the message: what it names, still wearing the
 * `@` it was completed from, and a space after it.
 *
 * ONE SPELLING FOR BOTH KINDS — a file's path, a node's id — because the two
 * are one gesture and the person did one thing. `read @notes/cabinets.md ` and
 * `look at @hinges ` are the same sentence shape, and a reader who has learned
 * one has learned the other.
 *
 * THE `@` STAYS, which is the decision worth naming. It is not markup — the
 * agent is handed the message verbatim — so what it buys is what it buys in
 * every terminal that has this gesture: the message says out loud that this
 * word names something in the directory, both to the person re-reading their
 * own sentence before sending and to the agent reading it after. A bare path
 * in a sentence is a word with a slash in it, and a bare id is a word.
 *
 * It buys a second thing here that it did not have to buy for a path: the word
 * stays COMPLETABLE. Backspace into `@hinges` and the same list comes back over
 * the same word, because the trigger is a function of the text (above) and the
 * text still has the `@` in it. A spelling that consumed the sigil — the id in
 * backticks, say, which is how the agent writes one in prose — would be a word
 * this box could no longer offer to fix, and it would be the only thing in the
 * message the panel had written that the panel could not read back
 * ({@link namedIn}).
 *
 * THE SPACE IS THE COMPOSER'S OWN habit, from the slash completion beside it
 * (`/review ` is what accepting a command writes): a message is prose and the
 * next thing typed is the next word. It is also what ends the trigger, since
 * whitespace is what the query stops at — so the list is gone the moment the
 * row is taken, with nothing to remember.
 *
 * That is the opposite of what the row editor's tag completion does, and the
 * two are right for their own reasons: a title is STORED verbatim, so a space
 * nobody typed is a space in somebody's git history. Nothing here is stored.
 *
 * WHAT IT NAMES GOES IN AS IT IS, including a path with a space in it. Such a
 * file is still offered — the query stops at whitespace, so it is found by the
 * segment before the space — and what is written is the path, unquoted. A
 * quoting convention would be one only olai understands: the agent is handed
 * the sentence, not a syntax, and inventing punctuation for it to parse would
 * be worse than a sentence a reader can see the shape of. An id cannot hold a
 * space at all (`@olai/format`'s `ID_SHAPE`), which is the other half of why a
 * node is named by its id here and not by its title.
 */
export const inserted = (name: string, followed = " "): string =>
  `@${name}${followed}`

/**
 * WHICH OF THE NODES ALREADY TAKEN this message still names, in the order it
 * names them.
 *
 * The one place the panel reads an `@` back out of what was typed, and the
 * shape of the question is what keeps it from being a parser of prose: it is
 * asked which of a KNOWN SET of ids — the ones taken off this box's own list —
 * the draft still holds. `@alice` arms nothing, whatever the set declares,
 * because nobody took `alice` off a list. Nothing here can turn a word somebody
 * typed into a claim about their message.
 *
 * It exists because the alternative is a chip that outlives its word. Taking a
 * node writes `@<id>` into the sentence and arms the node, so the id rides the
 * send and the server says what it is ({@link ./armed.ts}, `chat/context.ts`) —
 * and then the person selects the word and deletes it, and the message that
 * goes is about a node it does not mention. Reading the draft back
 * makes the words the last word: delete `@hinges` and the chip goes with it,
 * put it back and it returns. There is no disarm to remember and no undo to
 * write, which is `./completion.ts`'s own argument about the trigger applied to
 * what the trigger produced.
 *
 * IN THE ORDER THE MESSAGE NAMES THEM, because that order is a fact the words
 * carry and the chips cannot: `compare @a with @b` says which is which, and two
 * lines under a message do not. Named twice, drawn once — a message that says
 * `@order` in two sentences is about one node.
 *
 * The `@` it looks for is the trigger's own — the format's `tagOpensAt`, so a
 * word with an `@` inside it is a word here exactly as it is up there — and the
 * token it reads ends where a query ends, at whitespace. So this and the list
 * that wrote the word agree about what a word is by construction.
 */
export const namedIn = (
  text: string,
  taken: ReadonlySet<string>,
): ReadonlyArray<string> => {
  if (taken.size === 0) return []
  const named: Array<string> = []
  for (const found of namesOf(text)) {
    if (taken.has(found.word) && !named.includes(found.word)) named.push(found.word)
  }
  return named
}

/**
 * The message without the word that names `id` — what the `×` on a chip does to
 * the sentence, since the sentence is what the strip is read from.
 *
 * EVERY occurrence of it, because a message that names one node twice is about
 * one node and the chip that went was the chip for all of them. The space after
 * the word goes with it when there is one, which is the space the completion
 * wrote; anything else a person typed around it stays exactly as it is.
 *
 * A WHOLE WORD, never a substring — the reason this is a walk over the same
 * tokens {@link namedIn} reads rather than a replace. Ids are slugs and one is
 * routinely the start of another (`order`, `ordering`), so a text-level
 * `@order` → `` would leave `@ing` in somebody's sentence, and the `@` it
 * matched might have been inside a word in the first place.
 *
 * The caret moves only for what came out BEFORE it, so a person whose caret is
 * three words further on stays three words further on.
 */
export const unnamed = (text: string, id: string, caret: number): Written => {
  let out = ""
  let read = 0
  let moved = caret
  for (const found of namesOf(text)) {
    if (found.word !== id) continue
    // Past the `@` and the name — then past the space the completion wrote
    // after it, if it is still there.
    const said = found.at + 1 + id.length
    const end = text[said] === " " ? said + 1 : said
    out += text.slice(read, found.at)
    read = end
    if (caret > found.at) moved -= Math.min(caret, end) - found.at
  }
  return { text: out + text.slice(read), caret: moved }
}

/**
 * What a sentence puts AFTER a name rather than in it.
 *
 * `look at @hinges, then the doors` is the sentence this exists for, and it is
 * read from both ends: the comma comes OFF a word being read back
 * ({@link namesOf}, or `@hinges,` names nothing and the chip goes out from
 * under a person who only wrote a comma), and it stops a space being written IN
 * FRONT of it by a completion ({@link completed}). One set, asked twice, so the
 * two can never come to disagree about what a sentence's own punctuation is.
 *
 * AT THE EDGES ONLY, which is what makes one rule safe for both kinds of name:
 * a path's dots and slashes are INSIDE it (`@notes/cabinets.md` keeps every
 * character) and an id's own alphabet holds none of these, so `@order-2` is
 * still `order-2` and never `order`. It is the convention every terminal and
 * chat client already applies to a URL at the end of a sentence.
 *
 * WHAT THE EDGES-ONLY RULE COSTS, since it was asked (review, d17ec4f6):
 * `@hinges,@order` with no space between them names NEITHER — the word runs to
 * the whitespace, so the comma and the second name are inside it. Splitting
 * there was refused twice over. The format says a `@` opens a word after
 * whitespace or a bracket and nowhere else (`tagOpensAt`), so the trigger would
 * never have offered a list for `,@order`: a read-back that saw a name there
 * would be recognising a word this box could not have written, which is the
 * whole of what {@link namesOf} exists not to do. And splitting on the marks
 * themselves — the shape review suggested — takes `@notes/cabinets.md` apart at
 * its own dot. The case is reachable only by hand-editing a completion's own
 * space away, the chip goes as the character is typed rather than at send, and
 * the sentence is the thing that decides: it says one word, so it names one
 * thing, and that thing is not a node.
 */
const SENTENCE_MARK = /[,.;:!?)\]}'"]/

/** A name with what the sentence put after it taken off. */
const trimmed = (word: string): string => {
  let end = word.length
  while (end > 0 && SENTENCE_MARK.test(word[end - 1] ?? "")) end--
  return word.slice(0, end)
}

/** ...and how many of those marks stand at `at`, which is what a completion
 *  must not write a space in front of. */
const markedAt = (text: string, at: number): number => {
  let end = at
  while (end < text.length && SENTENCE_MARK.test(text[end] ?? "")) end++
  return end - at
}

/** Every `@word` in a message, in the order it says them — where a `@` OPENS a
 *  word (the format's own rule, the trigger's) and the word ends where a query
 *  ends, at whitespace, less whatever the sentence put after it. One walk, so
 *  the two readers above cannot come to disagree about what a word is. */
const namesOf = (
  text: string,
): ReadonlyArray<{ readonly at: number; readonly word: string }> => {
  const found: Array<{ at: number; word: string }> = []
  for (let at = 0; at < text.length; at++) {
    if (text[at] !== "@" || !tagOpensAt(text, at)) continue
    const rest = text.slice(at + 1)
    const end = rest.search(/\s/)
    const said = end === -1 ? rest : rest.slice(0, end)
    found.push({ at, word: trimmed(said) })
    // Past the whole of what was written, punctuation included: what was
    // trimmed is not part of the name and is not somewhere another `@` can
    // open either.
    at += said.length
  }
  return found
}

/**
 * The message with the armed span replaced by the chosen path, and the caret
 * after it — the whole of what taking a row writes.
 *
 * ONE SPACE, NOT TWO, which is the reason this is a function rather than a
 * call to {@link written} with {@link inserted} in it. Completing at the end of
 * a message is the case that shaped the trailing space, and completing in the
 * MIDDLE of one is the case it got wrong: `read @fin later` already has the
 * space that separates the path from the next word, so adding another wrote
 * `read @finishes.md  later` — two spaces, in somebody's sentence, put there
 * by a completion. So a caret sitting on a space gives that space up, and what
 * follows the path is the whitespace that was already there.
 *
 * A SPACE and not any whitespace: a newline after the caret stays a newline,
 * because swallowing one would join two lines a person wrote apart, and a
 * trailing space at the end of a line is nothing anybody sees. The space is
 * still written when the caret is at the end of the message, where there is
 * nothing to give it up — and where it does the second job the trailing space
 * has, which is to end the trigger so the list does not come straight back
 * over the path it just wrote.
 *
 * AND NO SPACE AT ALL WHEN THE SENTENCE ALREADY PUT ONE OF ITS OWN MARKS
 * THERE. `look at @hin, then the doors`, completed with the caret against the
 * comma, wrote `look at @hinges , then` — a space nobody typed, in front of
 * somebody's punctuation (reported by review). The trailing space is a
 * separator between this name and the next WORD; a comma is the separator, so
 * there is nothing for it to do. It is the same closed set of marks
 * {@link namesOf} takes off the end of a name, asked from the other side: what
 * a sentence puts after a name is not part of it, and not something to space
 * away from it either.
 *
 * The caret then goes PAST those marks, which is the other half of the same
 * sentence — the next thing typed is the next word, and it goes after the
 * comma rather than in front of it. It also keeps the list from coming
 * straight back: with the caret there the query is `hinges,`, which is a thing
 * neither half of the list holds.
 */
export const completed = (
  text: string,
  at: Completing,
  name: string,
  caret: number,
): Written => {
  const marks = markedAt(text, caret)
  if (marks > 0) {
    const put = written(text, at, inserted(name, ""), caret)
    return { ...put, caret: put.caret + marks }
  }
  return written(text, at, inserted(name), text[caret] === " " ? caret + 1 : caret)
}
