/**
 * TWO RULES for taking a served file's suffix off, held side by side before
 * either of them moves.
 *
 * `./message.ts` and `./dates.ts` each strip an extension, and each states the
 * opposite argument for how:
 *
 *   - `./message.ts`'s private `stemOf` SPELLS the suffix — `endsWith(OUTLINE_EXT)`,
 *     and a name that does not end in that one string is left exactly as it is;
 *   - `./dates.ts`'s `noteDateOf` FINDS it — `lastIndexOf(".")` — with a
 *     docstring saying so on purpose, "so a package that ever admitted another
 *     one does not leave this reading a name it has taken the wrong number of
 *     characters off".
 *
 * Both arguments are good and they are not the same function. Unifying them is
 * therefore a change that can silently move a caller, and this file is what
 * makes that impossible: the two rules are copied here VERBATIM, every input
 * they agree on is listed, every input they disagree on is listed WITH BOTH
 * ANSWERS, and each caller's REACHABLE domain is pinned through its own public
 * seam. A unification is then judged against a table rather than against a
 * reader's memory of two docstrings.
 *
 * What the table says, once it is written out, is the thing worth knowing
 * before the merge: the two rules agree on OUTLINES and nowhere else. So
 * neither of them can simply absorb the other — `bySpelling` hands a daily
 * note back with `.md` still on it, and `byFinding` answers `READM` for
 * `README`. The rule that fits both callers is a THIRD one, and it is already
 * spelled in this package: take off the suffix the registry says claims this
 * file, and leave a file it claims nothing about alone. On an outline that is
 * `bySpelling`; on a document it is `byFinding`; and the names where the two
 * differ from it are exactly the names no caller passes.
 *
 * The copies are the point, not a smell. A test that called the two functions
 * would stop being able to say anything the moment they became one, which is
 * exactly the moment the claim matters.
 */

import { describe, expect, test } from "bun:test"

import type { NodeChange } from "./changes.ts"
import { noteDateOf } from "./dates.ts"
import { OUTLINE_EXT } from "./kinds.ts"
import { composed } from "./message.ts"

/** `./message.ts:153`, as it stands: the basename, and the suffix taken off
 *  only when the name really ends in the one string this package spells. */
const bySpelling = (file: string): string => {
  const name = file.slice(file.lastIndexOf("/") + 1)
  return name.endsWith(OUTLINE_EXT) ? name.slice(0, -OUTLINE_EXT.length) : name
}

/** `./dates.ts:405`, as it stands: the basename, cut at its last dot, whatever
 *  that dot turns out to be — and whether or not there is one. */
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
 */
const DIVERGE: ReadonlyArray<
  readonly [path: string, spelled: string, found: string]
> = [
  ["2026-08-11.md", "2026-08-11.md", "2026-08-11"],
  ["Daily/2026/08/2026-08-12.md", "2026-08-12.md", "2026-08-12"],
  ["report.html", "report.html", "report"],
  ["notes/report.html", "report.html", "report"],
  ["shot.png", "shot.png", "shot"],
  ["house.olai.bak", "house.olai.bak", "house.olai"],
  ["README", "README", "READM"],
  ["docs/README", "README", "READM"],
  ["justfile", "justfile", "justfil"],
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
