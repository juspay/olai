/**
 * ONE BROKEN OUTLINE, in that outline's own place — and its errors are all it
 * shows.
 *
 * The per-file ruling (2026-08-29) and its second half: a broken `.olai` costs
 * the reader that file and nothing else, and what its page shows is the
 * validator's rows — where you would fix them — and NOT a stale copy of the
 * tree. The sidebar still lists it, every other outline is still live and still
 * writable, and this is what opening it gets you.
 *
 * IT IS EVERY KIND OF BROKEN NOW. This pane used to be reached only by a file
 * whose LINES did not parse (the 2026-08-09 error scope); a file that read
 * perfectly and said something the set could not hold — a duplicate id, a
 * dangling `see`, a property that does not fit its declaration — took the whole
 * vault off the screen instead, and had no pane of its own to be sent to. Both
 * are one thing in the set now (`@olai/format`'s `BrokenFile`), so both are one
 * page here, and the LEDE is the only thing that has to know which: the state
 * is read off the rows, exactly as the summary's is.
 *
 * No grouping heading: the file is named by the sidebar entry that is currently
 * selected, and repeating it here would be the same fact twice on one screen.
 */

import { type BrokenFile, stageOf } from "@olai/format"

import { PAGE_TITLE } from "../look.ts"
import { TESTID } from "../testids.ts"
import { Lede } from "./Lede.tsx"
import { Rows } from "./Report.tsx"

export function Broken(props: { readonly file: BrokenFile }) {
  const count = () => props.file.errors.length
  /** Whether any of this file's rows is one a single LINE answers for. The
   *  format's own staging word (`stageOf`), not a second reading of the codes
   *  here — the same split the summary's `FileState` is read off. */
  const unparsed = () => props.file.errors.some((error) => stageOf(error.code) === "line")

  return (
    <section class="max-w-4xl" data-testid={TESTID.outlineFailure} data-file={props.file.file}>
      <h1 class={`${PAGE_TITLE} mb-2 italic text-alarm`}>
        {count()} {count() === 1 ? "error" : "errors"} in this file
      </h1>
      <Lede>
        {unparsed()
          ? "Some of its lines could not be read, so it has no tree to draw. "
          : "It reads, and it says something the set cannot hold, so its tree is not being drawn. "}
        Every other outline in the directory is unaffected — still live, still
        writable — and this one comes back on its own once these are fixed.
      </Lede>
      <Rows errors={props.file.errors} />
    </section>
  )
}
