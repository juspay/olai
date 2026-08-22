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

import { type FileKind, FILE_KINDS, fileKind } from "@olai/format"

import { oneNamed } from "./kinds.ts"

/** What a typed name means at a door: the path to ask for, or the sentence to
 *  draw instead. A sum rather than a path plus an optional complaint, so a
 *  caller cannot send the one it was told not to. */
export type Meant =
  /** The completed path, exactly as the ops layer will be asked for it. */
  | { readonly at: string }
  /** The box's own words — nothing was asked for. */
  | { readonly refused: string }

/**
 * The file `typed` names at a door that makes `of` — trimmed, completed, and
 * refused only for naming a file of a kind this door cannot make.
 *
 * TRIMMED HERE rather than by the caller, so the path that is asked for and the
 * name a refusal quotes are the same string: `Foo ` and `Foo` are one file, and
 * a box that sent the first would have made a name nobody can type again.
 */
export const meantAt = (of: FileKind, typed: string): Meant => {
  const name = typed.trim()
  const carried = fileKind(name)
  if (carried === of) return { at: name }
  if (carried === null) return { at: `${name}${FILE_KINDS[of].ext}` }
  // HOW MANY CHARACTERS COME OFF is the registry's answer, not a `lastIndexOf`
  // — the same rule `stemOf` is, minus its basename step, which would offer
  // `plan` for a `notes/plan.md` and quietly move the file to the root.
  const bare = name.slice(0, -FILE_KINDS[carried].ext.length)
  const said = `\`${name}\` is ${oneNamed(carried)}, not ${oneNamed(of)}`
  // A name that is nothing BUT a suffix leaves nothing to suggest typing, and
  // an empty pair of backticks is advice about nothing.
  return {
    refused: bare === ""
      ? `${said}.`
      : `${said} — type \`${bare}\` to make \`${bare}${FILE_KINDS[of].ext}\`.`,
  }
}
