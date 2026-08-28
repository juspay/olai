/**
 * WHAT A PROPERTY VALUE NAMES — one question, one answer, asked where the set
 * is.
 *
 * `custom` is the one open field on a record and olai gives no key in it a
 * meaning ({@link ./custom.ts}); that is the format's rule and it does not
 * move. But a vault that DECLARES its keys ({@link ./typing.ts}) has said
 * something about the values under them, and a lane node saying
 * `brief briefs/tp.md` and `agent grok` is pointing at two things this
 * directory actually holds. So this module asks one question of one value —
 * *does this name something the app can open, and what* — and everything that
 * draws a chip spends the answer.
 *
 * ## The bug family this exists to close
 *
 * It was asked TWICE, by two modules that had never been introduced. The
 * validator resolved a declared value through the vocabulary (`wrongDoc`,
 * `wrongRef`), and the display re-derived the same question from the value's
 * SHAPE — five guesses, written before the vault could declare anything, and
 * never taught to read a declaration. They disagreed three ways, and every one
 * of them was a live defect on the board (roadmap: `typed-chips-doors`):
 *
 *   - **Every `brief` chip outside the root was dead.** The two sides assumed
 *     different path bases. That is a fact now ({@link ./typing.ts}'s
 *     {@link PathBase}), read by both arms off the key's own row.
 *   - **A ref chip drew the raw variant id.** `agent agent-claude-opus`, when
 *     the id is the stored truth and the TITLE is what a reader wants — the
 *     typed spec's own display rule, half-drawn.
 *   - **A declared `doc` taught the display nothing.** A value the gate had
 *     already resolved was guessed at again a layer up.
 *
 * ## Two arms, one consult
 *
 * A DECLARED key is answered by its declaration, which is a stronger warrant
 * than any shape guess: `agent` names a node because the vault said so, and a
 * `worktree` that happens to look like a path opens nothing because the vault
 * said *that* too.
 *
 * An UNDECLARED key keeps the five guesses, unchanged and in the same order —
 * a URL, a date, a node id, a served path, a GitHub reference. Nothing
 * regresses in a vault that declares nothing, which is the whole of what
 * "typing is opt-in per key" means one floor down.
 *
 * A key declared `text` takes the GUESSES TOO, and that is deliberate rather
 * than an oversight in the switch. A declared `text` says "this prose is
 * deliberate" ({@link ./typing.ts}'s `PropType`); it does not say the prose
 * names nothing, and the board's own `pr-url` and `merge-commit` are declared
 * `text` and hold whole URLs. Reading them as an undeclared key is read is what
 * keeps those doors open.
 *
 * ## The founding rule, kept
 *
 * A WRONG DOOR IS WORSE THAN NO DOOR. There is no fuzzy matching here, no
 * "looks like", no title search, no substring: the entire value has to BE the
 * name of the thing. Two consequences worth stating because they are what
 * somebody will ask about:
 *
 *   - A value with a URL IN IT is not a URL. `#365 https://…/365 @ efc32b13 —
 *     reported 12:45` is a paragraph, and pulling the URL out of it would be
 *     the display deciding which part of somebody's sentence was the point.
 *   - A NODE ID is matched by id and never by title. Titles are prose, two
 *     nodes may share one, and a value that merely reads like a title is a
 *     guess.
 *
 * ## Why it is here, beside the validator, and not in the browser
 *
 * Because this is where the set is. The browser holds a page, not a vault: it
 * cannot say which ids the set declares, which paths the directory serves, or
 * what the vault declares about a key — and the third of those must never
 * travel ({@link ./page.ts}: the tab receives ANSWERS, and #395's decision that
 * declarations stay off the wire survives untouched). So the question is
 * answered once per revision where all three facts are in hand, and what ships
 * is a {@link Door} per value the page draws — exactly the way resolved names
 * already ship.
 *
 * ## What it does NOT decide
 *
 * WHERE A CLICK GOES. An answer names a thing; turning that into a route, a
 * tab and a tooltip is the drawing side's (`@olai/web`'s `props/door.ts`),
 * which is a mapping with no vault in it at all.
 */

import { Schema } from "effect"

import { pathedOf } from "./documents.ts"
import { dayOf } from "./occasion.ts"
import { isIsoInstant } from "./parse.ts"
import {
  basedAt,
  type Declared,
  declaredFor,
  type PropDeclarations,
  resolvedDoc,
} from "./typing.ts"

/**
 * WHAT A VALUE TURNS OUT TO NAME — or `null` from {@link meaningOf}, which is
 * the ordinary answer and the one every value gets until it earns another.
 *
 * FOUR ARMS, because there are four kinds of place this app can send somebody:
 * a file of this directory, a record of this set, a day of the journal, and
 * out. Each carries the TARGET and nothing about how it is drawn — where a
 * click goes, what a pointer is told and which ink a chip takes are three
 * decisions the drawing side makes from these, and putting any of them here
 * would be this module deciding what a link looks like in a browser it cannot
 * see.
 */
export const Meaning = Schema.Union([
  /** A document of this directory — a `.md`, a `.html`, an `.olai`, anything
   *  with a page. The path is resolved and SERVED: existence was asked, which
   *  is what makes this different from a written markdown link. */
  Schema.Struct({ kind: Schema.Literal("document"), file: Schema.String }),
  /** A node this set declares, by its id. */
  Schema.Struct({
    kind: Schema.Literal("node"),
    id: Schema.String,
    /**
     * DRAW THE TARGET'S TITLE ON THE CHIP, with the id as the stored truth
     * underneath.
     *
     * A fact about the VALUE rather than a style instruction, which is why it
     * may ride on the wire: it is true exactly when the vault DECLARED this key
     * a reference (`ref` or `node`), and a reference is a thing whose name is
     * not its identity — "names rename, ids don't" read from the display end
     * (https://github.com/juspay/oss.olai/blob/master/olai/brainstorming/typed-properties.md, Converged §1).
     *
     * FALSE for a value that merely turned out to be an id. Nobody declared it
     * a reference, so the string the record holds is the fact somebody wrote,
     * and swapping a title in for it would be the display rewriting a value on
     * the strength of a guess — this module's founding rule pointed at the
     * face instead of at the link.
     *
     * The title itself is NOT here: it is in the page's names table already
     * ({@link ./page.ts}'s `Named`), keyed by this same id, and shipping it
     * twice would be two spellings of one fact on one wire.
     */
    titled: Schema.Boolean,
  }),
  /** A day of the journal — the DAY, for a value that says a minute too. */
  Schema.Struct({ kind: Schema.Literal("day"), date: Schema.String }),
  /** Somewhere that is not this app, as the address a tab would open. */
  Schema.Struct({ kind: Schema.Literal("away"), href: Schema.String }),
])
export type Meaning = typeof Meaning.Type

/**
 * ONE ROW OF A DOORS TABLE: the value, said exactly as it was found, and what
 * it names.
 *
 * THE LOOKUP IS THE TRIPLE and every part of it earns its place. `prop` is what
 * the vault declared about, `value` is what the record holds, and `from` is the
 * file it was WRITTEN in — which is not decoration: a `doc` key based on the
 * file resolves `briefs/tp.md` to two different documents on two rows of two
 * outlines, so a table looked up by the pair would answer one of them wrong.
 *
 * `prop` AND NOT `key`, which is a wire fact rather than a taste: the page
 * stream declares `arrayKey: "key"` (juspay/kolu#2190), so a field of that name
 * would make the merge treat this as a KEYED array and identify two doors on
 * two rows by the property they happen to share — one `brief` standing in for
 * every `brief` on the page. It is positional, like `names` beside it, and the
 * name is what keeps it that way (`@olai/surface`'s `surface.test.ts` pins the
 * whole partition).
 *
 * ONLY VALUES THAT NAME SOMETHING ARE CARRIED. A value that names nothing is
 * absent, exactly as an unresolvable id is absent from the names table, and the
 * drawing side reads absence as "this is the text it always was". That is also
 * what keeps the table small on a page of prose.
 */
export const Door = Schema.Struct({
  from: Schema.String,
  prop: Schema.String,
  value: Schema.String,
  opens: Meaning,
})
export type Door = typeof Door.Type

/**
 * The three facts about the vault this consult cannot answer for itself.
 *
 * Handed IN rather than read off a reading, for the reason the door rule this
 * replaces did the same: the answer is a function of its inputs, its test needs
 * no corpus to be built, and the one caller that HAS a reading
 * ({@link ./page.ts}) is where those three are joined. Two of them are
 * questions rather than tables because that is what they are asked as — once
 * per value, of an index the caller already holds.
 */
export interface Vault {
  /** What this vault declares about its property keys — {@link ./typing.ts}'s
   *  reading, which is `NO_TYPING` for a directory that declares nothing. */
  readonly declarations: PropDeclarations
  /** Is this id a node this set declares. `nodeNamed` at the call site, so a
   *  value naming a MIRROR answers for the node standing at that placement —
   *  the same lookup a `see` link's text has always come from. */
  readonly declares: (id: string) => boolean
  /**
   * Does the directory serve this path — asked of EVERY file it holds, not only
   * the documents, so an `.olai` may be named.
   *
   * The wide question, and it is the one a value that PROMISED nothing gets: a
   * `path` and an undeclared key alike say only that some string is there, so
   * what settles whether it is a door is whether this directory happens to hold
   * a page for it — which it does for an outline, a saved `.html` and a picture
   * as readily as for a `.md`.
   */
  readonly serves: (file: string) => boolean
  /**
   * ...and does it serve this path as a `.md` — the NARROW question, and the
   * one a `doc` gets, because `doc` is the kind that promises exactly that.
   *
   * TWO PREDICATES AND NOT ONE, which is the shape grok's review corrected. A
   * single `serves` behind both meant the gate asked `markdownPaths` and the
   * display asked the whole file list, so a `doc` value naming a served `.olai`
   * was REFUSED by the validator and DRAWN AS A LIVE DOOR by the chip — the
   * bug family this module exists to close, recreated inside the socket.
   *
   * It is `./rules.ts`'s `markdownPaths`, which is the very set {@link Typed}'s
   * `documents` is and the very set the `doc` FIELD's rule is asked about. One
   * set, three readers, no room to disagree.
   */
  readonly documents: (file: string) => boolean
}

/**
 * WHAT THIS VALUE NAMES, under this key, written in this file — or `null`,
 * which is the answer for nearly every value in every vault.
 *
 * `from` is the file the value was WRITTEN in: the outline holding the record,
 * or the document whose frontmatter this is.
 *
 * ONE VALUE, never a list. `custom` holds text or a list of it — a fact can be
 * several — and a list is several values of one key, each asked here on its
 * own, exactly as the gate checks a list member by member. Drawing one member
 * as a door and another as text because they arrived joined would be the
 * display inventing a difference the record does not have.
 */
export const meaningOf = (
  vault: Vault,
  from: string,
  key: string,
  value: string,
): Meaning | null => {
  if (value === "") return null
  const declared = declaredFor(vault.declarations, key)
  // AN UNDECLARED KEY AND A DECLARED `text` READ THE SAME WAY, and the header
  // argues why: neither one says the value names nothing, and the board's own
  // `pr-url` is the second kind holding a URL.
  if (declared === undefined || declared.type.kind === "text") return guessed(vault, from, value)
  return declaredly(vault, declared, from, value)
}

/**
 * THE DECLARED ARM: the vault said what this key holds, so nothing is guessed.
 *
 * A switch over the six kinds that say something, so a kind added to
 * {@link ./typing.ts}'s union is a type error here rather than a value that
 * quietly stops being a door.
 */
const declaredly = (
  vault: Vault,
  declared: Declared,
  from: string,
  value: string,
): Meaning | null => {
  switch (declared.type.kind) {
    case "text":
      // Answered by the caller, which is where the reason is written. Kept as
      // an arm rather than a `default` so the switch stays exhaustive.
      return guessed(vault, from, value)
    case "date":
      // The declaration and the shape agree here and always will — a `date`
      // key holds what the format calls a date, and {@link dayIn} is what that
      // means. What the declaration adds is the refusal: a `date` key holding
      // prose opens nothing, where a guess would have kept looking.
      return dayIn(value)
    case "int":
      // A number names nothing this app can open. Said as an arm rather than
      // left to fall through, because "193 is not a door" is a decision.
      return null
    case "ref":
    case "node":
      // A REFERENCE, and the id is the value: the door is the node, and the
      // face is its title ({@link Meaning}'s `titled`). Whether the id is a
      // LEGAL variant of this key is the gate's question and not this one's —
      // a value the gate would refuse still names the node it names, and
      // answering `null` here would draw a dead chip on a file the validator
      // is already reporting. The `date` arm above says the same thing about
      // SPELLING, and `doc` below says the opposite about EXISTENCE: which arms
      // may part from the gate is decided by what each kind promised, and only
      // `doc` promised that its value names something.
      return vault.declares(value) ? { kind: "node", id: value, titled: true } : null
    case "doc": {
      // THE GATE'S OWN EXPRESSION, OVER THE GATE'S OWN CORPUS. `doc` is the one
      // kind that PROMISES its value names a served document, so this arm is
      // not a rule that agrees with `wrongDoc` — it is the same resolution
      // ({@link resolvedDoc}) asked of the same `.md` set, which is what makes
      // "the validator refuses it" and "the chip draws no door" one fact.
      //
      // IT MAY NOT RIDE `path`'S ARM, and the review that caught it named the
      // failure exactly: `path`'s display asks the whole file list, so a `doc`
      // value naming a served `.olai` was refused by the gate and drawn as a
      // live door — a wrong door on a finding, which is this module's founding
      // rule broken by the module built to keep it.
      const file = resolvedDoc(declared, from, value)
      return file !== undefined && vault.documents(file) ? { kind: "document", file } : null
    }
    case "path":
      // A SHAPE AND NOTHING MORE is what this kind promised, so the gate asked
      // no question this could disagree with — and the display asks the wide
      // one: does this directory happen to serve what the value resolves to,
      // whatever kind of file that is. A `worktree` naming a directory on
      // somebody's machine is not served here and stays the text it is; a
      // `brief` declared `path` — which is what the live board declares, since
      // a brief is working material the served set does not always hold
      // (`docs/briefs/` was gitignored when this was ruled) and a `doc` would
      // make every checkout red
      // — opens exactly when the file is actually there. That asymmetry with
      // the arm above is the argued call: two arms of one consult may differ
      // about what they PROMISE, and may not differ about the same promise.
      return servedFrom(vault, declared, from, value)
  }
}

/**
 * THE UNDECLARED ARM: the five shape guesses, in the order they are read.
 *
 *   1. **a URL** — `http:` or `https:`, whole. It leaves the tab.
 *   2. **a date** — what the FORMAT calls a date ({@link isIsoInstant}: a day,
 *      or an instant on one). Read before the id match, though a date is
 *      id-shaped, because a value the format would call a date is a date
 *      wherever it appears — a node whose id happens to be `2026-08-31` is a
 *      coincidence, and letting it change what a date LOOKS like would put a
 *      caveat on the one face rule here that has none.
 *   3. **a node id** — an exact match against what this set declares.
 *   4. **a vault path** — resolved beside the file the value was WRITTEN in
 *      (there is no declaration to say otherwise, which is exactly what makes
 *      this the guess), and then only if the directory actually serves it. The
 *      extra question is the difference between this and a written link, and it
 *      cuts both ways: markdown deliberately does not ask it, because a
 *      `[…](…)` is somebody STATING a link and the page that says "no such
 *      document" is the honest answer, while a property value states nothing —
 *      so a path the directory has not got is not a broken link, it is a string
 *      that turned out not to be a path.
 *   5. **a GitHub reference** — `owner/repo#123`, GitHub's own unambiguous
 *      cross-repo spelling, which opens the issue or pull request (the issue
 *      URL redirects to the pull request when that is what the number is). A
 *      BARE `#123` or `123` is NOT one: which repository it means is a fact
 *      nothing on this screen holds, and inventing one is the wrong door this
 *      module exists to refuse.
 *
 * Anything else is text.
 */
const guessed = (vault: Vault, from: string, value: string): Meaning | null => {
  if (isHttp(value)) return { kind: "away", href: value }
  const day = dayIn(value)
  if (day !== null) return day
  // TITLED IS FALSE and the arm above's docstring argues it: nobody declared
  // this a reference, so the value is the fact and the face draws it.
  if (vault.declares(value)) return { kind: "node", id: value, titled: false }
  const served = servedFrom(vault, undefined, from, value)
  if (served !== null) return served
  const github = GITHUB_REF.exec(value)
  if (github !== null) {
    const [, owner, repo, number] = github as unknown as [string, string, string, string]
    // `/issues/<n>` for both kinds: GitHub redirects it to the pull request
    // when that is what the number turns out to be, and guessing `/pull/` for a
    // plain issue would 404 on the one it guessed wrong.
    return { kind: "away", href: `https://github.com/${owner}/${repo}/issues/${number}` }
  }
  return null
}

/** The DAY a value names, for a value that says a minute too: `2026-08-24
 *  16:20` is a day with a time on it, and this app has a page per day and none
 *  per minute — the same cut `dayOf` makes of every other date reading in
 *  olai. */
const dayIn = (value: string): Meaning | null =>
  isIsoInstant(value) ? { kind: "day", date: dayOf(value) } : null

/**
 * ANY SERVED FILE this value resolves to, or `null` — the WIDE question, asked
 * by the two readings that promised nothing about the value: a declared `path`,
 * and a key nobody declared at all.
 *
 * The path arithmetic and its refusals are one place ({@link ./documents.ts}'s
 * `pathedOf`: no scheme, no `//host`, no absolute path, no bare fragment, and a
 * `..` clamped to the served root) and existence is the question after it —
 * which is what lets an `.olai` be named, since the app draws a page for one
 * and no suffix allowlist has room for it.
 *
 * `declared` is `undefined` for the guess, which is exactly what it means:
 * nothing was declared, so the basis is the writing file — {@link basedAt}'s
 * own default, reached by the same call rather than by a second rule spelled
 * here.
 */
const servedFrom = (
  vault: Vault,
  declared: Declared | undefined,
  from: string,
  value: string,
): Meaning | null => {
  const file = pathedOf(basedAt(declared, from), value)
  return file !== null && vault.serves(file) ? { kind: "document", file } : null
}

/** `http:`/`https:` and nothing else: a value is text, and what becomes a link
 *  out of the app is what unambiguously already is one. */
const isHttp = (value: string): boolean =>
  value.startsWith("https://") || value.startsWith("http://")

/**
 * GitHub's own cross-repo reference: `owner/repo#123`.
 *
 * Deliberately anchored at both ends — this is the whole value or it is
 * nothing — and deliberately narrow about the halves: an owner and a repo are
 * the characters GitHub allows in a name, and the number is a number. A bare
 * `#123` does not match, and that is the point rather than an omission.
 */
const GITHUB_REF = /^([A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)\/([A-Za-z0-9._-]+)#(\d+)$/
