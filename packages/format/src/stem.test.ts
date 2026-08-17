/**
 * TWO RULES for taking a served file's suffix off, and the ONE they became —
 * held side by side, so the merge is a table a reader can check rather than a
 * claim they have to trust.
 *
 * `./message.ts` and `./dates.ts` each used to strip an extension, and each
 * stated the opposite argument for how:
 *
 *   - `./message.ts`'s private `stemOf` SPELLS the suffix — `endsWith(OUTLINE_EXT)`,
 *     and a name that does not end in that one string is left exactly as it is;
 *   - `./dates.ts`'s `noteDateOf` FINDS it — `lastIndexOf(".")` — with a
 *     docstring saying so on purpose, "so a package that ever admitted another
 *     one does not leave this reading a name it has taken the wrong number of
 *     characters off".
 *
 * Both arguments are good and they were not the same function. Merging them was
 * therefore a change that could silently move a caller, so the two rules are
 * copied here VERBATIM: every input they agree on is listed, every input they
 * disagree on is listed WITH BOTH ANSWERS, and each caller's REACHABLE domain is
 * pinned through its own public seam. The merge is then judged against a table
 * rather than against a reader's memory of two docstrings.
 *
 * What the table says is the thing worth knowing: the two agree on OUTLINES and
 * nowhere else, so neither could simply absorb the other. `bySpelling` hands a
 * daily note back with `.md` still on it; `byFinding` answers `READM` for
 * `README`, because `lastIndexOf(".")` of `-1` drops the last character rather
 * than nothing. The rule that is right for both callers is a THIRD one, and the
 * package already had the thing that knows it: take off the suffix the REGISTRY
 * says claims this file, and leave a file it claims nothing about alone
 * (`./kinds.ts`'s {@link stemOf}). On an outline that is `bySpelling`; on a
 * document it is `byFinding`.
 *
 * BE PRECISE ABOUT WHAT THAT BUYS, because the loose version of the sentence —
 * "the names where they differ are names no caller passes" — is false, and
 * every daily note is a counterexample: `2026-08-11.md` is a divergent row and
 * `noteDateOf` passes one of those on every read. The true claim is narrower
 * and is what the third column below asserts row by row: on every divergent
 * name the merged answer is ONE OF THE TWO, never a third reading, and it is
 * the one belonging to whichever caller can reach that name. What no caller
 * passes is a name where the merge would have moved it — which is the thing the
 * caller tests underneath hold, from the outside, through each caller's own
 * public seam.
 *
 * The copies are the point, not a smell. A test that called the two functions
 * stopped being able to say anything the moment they became one, which is
 * exactly the moment the claim matters.
 */

import { describe, expect, test } from "bun:test"

import type { NodeChange } from "./changes.ts"
import { noteDateOf } from "./dates.ts"
import { OUTLINE_EXT, stemOf } from "./kinds.ts"
import { composed } from "./message.ts"

/** `./message.ts`'s retired private `stemOf`: the basename, and the suffix taken
 *  off only when the name really ends in the one string this package spells. */
const bySpelling = (file: string): string => {
  const name = file.slice(file.lastIndexOf("/") + 1)
  return name.endsWith(OUTLINE_EXT) ? name.slice(0, -OUTLINE_EXT.length) : name
}

/** `./dates.ts`'s retired cut inside `noteDateOf`: the basename, cut at its last
 *  dot, whatever that dot turns out to be — and whether or not there is one. */
const byFinding = (file: string): string => {
  const name = file.slice(file.lastIndexOf("/") + 1)
  return name.slice(0, name.lastIndexOf("."))
}

/**
 * Every path both rules answer the same for — which is to say: the outlines,
 * and only the outlines.
 *
 * `.olai` carries no dot of its own, so the last dot in an outline's name is
 * the one that opens its suffix, and the rule that FINDS the dot lands on the
 * same character as the rule that SPELLS the suffix. That coincidence is the
 * whole of the agreement, and it does not survive a second registered kind.
 */
const AGREE: ReadonlyArray<readonly [path: string, stem: string]> = [
  ["roadmap.olai", "roadmap"],
  ["docs/roadmap.olai", "roadmap"],
  ["a/deep/tree/house.olai", "house"],
  ["Archive.olai", "Archive"],
  // A dot inside the name is not the suffix, and neither rule takes it for one.
  ["notes.v2.olai", "notes.v2"],
  // The degenerate outline: a file called nothing but its suffix. Spelled from
  // the registry rather than written out, because ./kinds.ts is the only file
  // allowed to say it in code (`@olai/tests`' `kinds.test.ts` holds that).
  [OUTLINE_EXT, ""],
]

/**
 * Where they part, with both answers written out.
 *
 * Three shapes, and each is a different way of being wrong for somebody:
 *
 *   - **another registered kind.** A `.md` or a `.html` keeps its suffix under
 *     `bySpelling`, which is the reading `./dates.ts` explicitly refused to
 *     write. Every daily note is in here.
 *   - **a file the registry claims nothing about.** `shot.png` and
 *     `house.olai.bak` lose a suffix under `byFinding` that no rule in this
 *     package ever said was one.
 *   - **no dot at all**, which is the sharpest case: `lastIndexOf(".")` is
 *     `-1`, `slice(0, -1)` drops the name's LAST CHARACTER, and `README` comes
 *     back as `READM`. Nothing throws and nothing is empty; the answer is just
 *     quietly one letter short.
 *
 * The fourth column is what {@link stemOf} answers, and it is written out per
 * row rather than derived, because "the merged rule sides with whichever of the
 * two was right about this file" is the claim and a derivation would assume it.
 * It sides with `byFinding` on a registered kind and with `bySpelling` on
 * everything else, which is one sentence — the registry's — read twice.
 */
const DIVERGE: ReadonlyArray<
  readonly [path: string, spelled: string, found: string, unified: string]
> = [
  ["2026-08-11.md", "2026-08-11.md", "2026-08-11", "2026-08-11"],
  ["Daily/2026/08/2026-08-12.md", "2026-08-12.md", "2026-08-12", "2026-08-12"],
  ["report.html", "report.html", "report", "report"],
  ["notes/report.html", "report.html", "report", "report"],
  ["shot.png", "shot.png", "shot", "shot.png"],
  ["house.olai.bak", "house.olai.bak", "house.olai", "house.olai.bak"],
  ["README", "README", "READM", "README"],
  ["docs/README", "README", "READM", "README"],
  ["justfile", "justfile", "justfil", "justfile"],
]

describe("the two suffix rules", () => {
  test("agree on an outline, which is the only name they agree on", () => {
    for (const [path, stem] of AGREE) {
      expect(bySpelling(path), path).toBe(stem)
      expect(byFinding(path), path).toBe(stem)
    }
  })

  test("and part company everywhere else, exactly here", () => {
    for (const [path, spelled, found] of DIVERGE) {
      expect(bySpelling(path), path).toBe(spelled)
      expect(byFinding(path), path).toBe(found)
      expect(spelled === found, `${path} is listed as a divergence`).toBe(false)
    }
  })
})

describe("the one rule they became", () => {
  test("is both of them on an outline, which is where they already agreed", () => {
    for (const [path, stem] of AGREE) {
      expect(stemOf(path), path).toBe(stem)
    }
  })

  // The merge, stated as the thing it has to be: on every name the two rules
  // disagreed about, the registry's answer is ONE OF THE TWO — never a third
  // reading nobody had. Which one it is, is the row.
  test("and takes the side of whichever was right about the file, on every other", () => {
    for (const [path, spelled, found, unified] of DIVERGE) {
      expect(stemOf(path), path).toBe(unified)
      expect(
        unified === spelled || unified === found,
        `${path}: the merged rule invented an answer neither rule gave`,
      ).toBe(true)
    }
  })
})

/**
 * …and neither caller can reach the other one's half of the divergence. This is
 * what makes a unification safe to make, and it is asserted rather than argued.
 */
describe("what each caller actually passes", () => {
  // `composed`'s stem comes from a `NodeChange.file`, and a node change is
  // built by `./changes.ts` out of the OUTLINE records of a loaded set — so the
  // path is an outline's, always, which is the row of `AGREE` above. The public
  // seam is the subject line.
  test("a commit subject names an outline's stem, with the suffix gone", () => {
    const change: NodeChange = {
      file: "docs/roadmap.olai",
      id: "x",
      title: "a node",
      fields: [],
      sort: "done",
    }
    expect(composed([change]).split("\n")[0]).toBe(
      "olai: 1 edit to roadmap — a node done",
    )
  })

  // `noteDateOf` cuts the suffix only after `fileKind` has said the file is a
  // DOCUMENT, so the name it cuts ends in `.md` by construction — a row of
  // `DIVERGE`, where the rule that finds the dot is the one that is right. The
  // boundary cases are the ones a rewrite would break first.
  test("a daily note is read off a document, dots inside the name and all", () => {
    expect(noteDateOf("2026-08-11.md")).toBe("2026-08-11")
    expect(noteDateOf("Daily/2026/08/2026-08-12.md")).toBe("2026-08-12")
    // A name that is not a bare day, however many dots it carries.
    expect(noteDateOf("notes.v2.md")).toBeNull()
    // And nothing that is not a document is asked at all — the guard, not the
    // stripping, is what answers for these.
    expect(noteDateOf("2026-08-11.olai")).toBeNull()
    expect(noteDateOf("2026-08-11.html")).toBeNull()
    expect(noteDateOf("2026-08-11")).toBeNull()
  })
})
