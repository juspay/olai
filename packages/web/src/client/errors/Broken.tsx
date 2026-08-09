/**
 * One outline that could not be read, in that outline's own place.
 *
 * The hybrid error scope (docs/brainstorming/architecture.live-store.md,
 * resolved 2026-08-09): a file whose lines do not parse costs the reader that
 * file and nothing else. The sidebar still lists it, every other outline is
 * still live, and this is what opening it shows — its own errors, where its
 * tree would have been.
 *
 * No grouping heading: the file is named by the sidebar entry that is currently
 * selected, and repeating it here would be the same fact twice on one screen.
 */

import type { BrokenFile } from "@olai/format"

import { TESTID } from "../testids.ts"
import { Lede } from "./Lede.tsx"
import { Rows } from "./Report.tsx"

export function Broken(props: { readonly file: BrokenFile }) {
  const count = () => props.file.errors.length

  return (
    <section class="max-w-4xl" data-testid={TESTID.outlineFailure} data-file={props.file.file}>
      <h1 class="m-0 mb-2 text-xl font-bold text-alarm">
        {count()} {count() === 1 ? "error" : "errors"} in this file
      </h1>
      <Lede>
        Its lines could not be read, so it has no tree to draw. Every other
        outline in the directory is unaffected and still live.
      </Lede>
      <Rows errors={props.file.errors} />
    </section>
  )
}
