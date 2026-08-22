/**
 * WHAT A NAME TYPED AT A DOOR MEANS — the one thing the browser decides about
 * a new file's path, and the whole of it.
 *
 * `+ New outline` and `+ New document` ask for a path, and a person types what
 * the file is called: `Foo`. Until this module that reached `create_outline`
 * as it stood and came back as the wire's paragraph — "`Foo` is not a relative
 * `.olai` path under the served directory (no absolute path, no `..`, no `.`,
 * and the name must end in `.olai`)" — for a name with nothing wrong with it
 * except the four characters the door itself already knows (roadmap node
 * `new-file-bare-name`, ruled by the human 2026-08-21: "the box should accept
 * both `Foo` and `Foo.olai`, naturally").
 *
 * ## Completing is not judging, and the difference is the whole design
 *
 * `NewFile.tsx` used to say that NOTHING in the browser may judge a path, for
 * a reason that still holds: a rule spelled here as well as in the ops layer is
 * two rules, free to disagree, and the one an agent meets is the real one. That
 * rule is unchanged. Absolute paths, `..`, a name the set already holds — every
 * one of those is still `create_outline` / `create_document`'s to refuse, in
 * its own words, over the path this module hands it.
 *
 * What is decided HERE is a question the ops layer never sees: which DOOR the
 * person is standing at. A door knows its kind ({@link Making.of}) and the wire
 * deliberately does not — `create_outline` takes one spelling of a path and
 * demands the suffix, because an agent naming a file is naming a file and has
 * no box around it. So the suffix is the door's half of the answer, and it is
 * put on here, before the ask. Agents are not the audience of this fix and the
 * MCP contract is untouched (docs/editing.md says so out loud).
 *
 * ## A suffix is one the registry claims, and nothing else is a suffix at all
 *
 * `Foo.txt` is a bare name — it becomes `Foo.txt.olai` — and so is
 * `plan v1.2`. That is not a lenience, it is the only rule this module can
 * honestly hold: olai's set is `.olai`, `.md` and `.html` (`@olai/format`'s
 * `kinds.ts`), and a dot anywhere else is somebody spelling a name. Cutting at
 * the last dot would rename `plan v1.2` to `plan v1.olai` behind their back,
 * and refusing every dotted name would refuse a name that is perfectly good.
 *
 * ## What is NOT completed, and why that is not a second `..` rule
 *
 * Every registered suffix BEGINS WITH A DOT, so gluing one onto a last segment
 * that is `.`, `..` or empty makes an ordinary filename out of the one thing
 * the ops layer could refuse: `..` would be asked for as `...olai`, which
 * `creatable` takes as a perfectly good name, and the box would mint a file
 * where the planner used to say "no `..`". So a text whose last segment is one
 * of those goes to the wire AS TYPED, and the paragraph goes on answering for
 * it, naming what was typed.
 *
 * That is a rule about which texts this side may CHANGE, not a second opinion
 * about which paths are legal — the verdict is still the planner's, and its
 * sentence is still what is drawn. `../escape` is untouched by it: its last
 * segment is a name, so it reaches the ops layer completed, as
 * `../escape.olai`, which is the file that was actually asked for.
 *
 * A TRAILING DOT is a name and is completed — `Foo.` → `Foo..olai`, the same
 * reading `plan v1.2` gets, because `Foo.` names a file (oddly) where `..`
 * names a place. So is a name that BEGINS with a dot: the store prunes
 * dot-DIRECTORIES and not dot-files (`@olai/store`'s `pruned`), so `.plan` →
 * `.plan.olai` is a file this app really lists. `.olai` typed whole is that
 * file's edge — the box takes it as it stands, `create_outline` accepts it, and
 * the row is drawn with an empty name. Pre-existing and identical on both faces
 * (an agent may ask for it too), so the day it is refused it is refused in
 * `creatable`, where both faces meet, and not here.
 *
 * ## The one refusal that is the box's own
 *
 * A name carrying ANOTHER kind's suffix — `Foo.md` typed into the outline door
 * — is refused here, in the box's own short sentence rather than the wire's
 * paragraph. It is not a second copy of an ops rule: the ops layer would only
 * ever see a completed path, and `Foo.md.olai` is what a "complete everything"
 * rule would have made of it — a file nobody asked for. What the sentence says
 * is the thing only this side knows: which kind that name names, which kind
 * this door makes, and what to type to get one.
 *
 * The two kinds are NAMED by the client's one vocabulary seam (`./kinds.ts`'s
 * `NAMED`), which is why a `.html` is "a page" in that sentence rather than
 * "hypertext": what a reader calls a kind is a decision this repository makes
 * once, and `../Nothing.tsx` was already making it.
 */

import { bareOf, type FileKind, FILE_KINDS, fileKind } from "@olai/format"

import { oneNamed } from "./kinds.ts"

/**
 * The last segments that name a PLACE rather than a file — what the completion
 * declines to touch.
 *
 * The same three spellings `creatable` refuses a segment for (`@olai/ops`'
 * `plan.ts`), and they are written here rather than asked of it on purpose:
 * this is not the browser re-deciding whether a path is legal (it is not, and
 * the planner says so in its own words either way) — it is the browser knowing
 * WHICH TEXTS ITS OWN COMPLETION WOULD DISGUISE. A copy of that list which fell
 * behind the ops layer's costs one thing only: a completed `..`-like segment
 * the planner then refuses in a sentence naming the completed path instead of
 * the typed one, which is the seam this whole module already lives on.
 */
const NOT_A_NAME: ReadonlySet<string> = new Set(["", ".", ".."])

/**
 * What a typed name means at a door — the THREE things it can mean, as a sum
 * rather than a path with an optional complaint beside it, so a caller cannot
 * send the one it was told not to.
 *
 * `file` is the wire's word for this, and the word the box's own `create` is
 * handed ({@link ../NewFile.tsx}), rather than a fourth name for one thing.
 */
export type Meant =
  /** The completed path, exactly as the ops layer will be asked for it. */
  | { readonly file: string }
  /** The box's own words — nothing was asked for. */
  | { readonly refused: string }
  /** ...and `null` for text that names nothing at all: an empty box, or one
   *  holding only spaces. An answer rather than a failure, the way the
   *  registry's own `fileKind` answers `null` for a file the set is not
   *  holding — a third SHAPE would be a sentinel a reader has to learn where
   *  the language already has one. */
  | null

/**
 * What `typed` means at a door that makes `of` — trimmed, completed, and
 * refused only for naming a file of a kind this door cannot make.
 *
 * TOTAL OVER ANY TEXT A BOX HOLDS, which is what the empty arm is for. The box
 * used to ask that question itself, in a `trim()` of its own beside this one:
 * two readings of "what is in the box", agreeing by convention. Nothing about
 * an empty box is the GESTURE's to know — a person who has typed nothing has
 * named no file, which is a fact about the name — so the reading is one.
 *
 * TRIMMED HERE for the same reason: the path that is asked for and the name a
 * refusal quotes are then the same string, and `Foo ` and `Foo` are one file
 * rather than a name nobody can type again.
 */
export const meantAt = (of: FileKind, typed: string): Meant => {
  const name = typed.trim()
  if (name === "") return null
  const ext = FILE_KINDS[of].ext
  const carried = fileKind(name)
  if (carried === of) return { file: name }
  // AS TYPED where completing would erase the refusal — the section above.
  if (carried === null) {
    const last = name.slice(name.lastIndexOf("/") + 1)
    return { file: NOT_A_NAME.has(last) ? name : `${name}${ext}` }
  }
  // HOW MANY CHARACTERS COME OFF is the registry's own answer and not a
  // `lastIndexOf` here: `bareOf` is the rule `stemOf` is made of, with the
  // path left whole — taking the basename would offer `plan` for a
  // `notes/plan.md` and quietly move the file to the root.
  const bare = bareOf(name)
  const said = `\`${name}\` is ${oneNamed(carried)}, not ${oneNamed(of)}`
  // Only the ADVICE is conditional, so the sentence is written once: a name
  // that is nothing but a suffix leaves nothing to suggest typing, and an empty
  // pair of backticks is advice about nothing.
  const advice = bare === "" ? "" : ` — type \`${bare}\` to make \`${bare}${ext}\``
  return { refused: `${said}${advice}.` }
}
