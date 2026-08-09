/**
 * What is wrong right now, over what was right last.
 *
 * The store keeps its last good snapshot when a set stops validating, so the
 * tree under this banner is real — just older than the files on disk. That is
 * the whole reason the errors ride a separate subscription from the snapshot:
 * a dangling reference in one file must not blank a page someone was reading.
 *
 * It says "not the files as they are now" rather than counting errors in the
 * heading, because the count is right below it and the STALENESS is the thing
 * a reader cannot see by looking at the tree.
 */

import type { OutlineError } from "@olai/format"

import { TESTID } from "../testids.ts"
import { Report } from "./Report.tsx"

export function Banner(props: { readonly errors: ReadonlyArray<OutlineError> }) {
  return (
    <aside
      class="mb-6 rounded border border-alarm bg-alarm/5 px-4 py-3"
      data-testid={TESTID.staleBanner}
    >
      <h2 class="m-0 mb-1 text-base font-bold text-alarm">
        Showing the last good version
      </h2>
      <p class="mt-0 mb-2 max-w-3xl text-sm text-muted">
        The files on disk no longer validate, so the outline below is the one
        from before they stopped. Fix these and it catches up on its own —
        nothing needs reloading.
      </p>
      <Report errors={props.errors} />
    </aside>
  )
}
