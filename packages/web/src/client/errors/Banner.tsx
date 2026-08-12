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
import { Show } from "solid-js"

import { TESTID } from "../testids.ts"
import { Lede } from "./Lede.tsx"
import { Report } from "./Report.tsx"

/**
 * WHY the tree below is old — which is not always the same reason.
 *
 * "The files on disk no longer validate" is the ordinary case and was the only
 * case, so it was written as a fact rather than read off the errors. It became
 * a lie the moment the store learned to publish the other kind: a directory
 * that could not be READ has nothing wrong with its files, and telling
 * somebody whose mount went away to go and fix their outlines is worse than
 * the silence this banner replaced.
 *
 * Read off the errors, so the two cannot drift: one `unreadable-directory` is
 * enough, because a set nothing could read is a set nothing could validate
 * either — anything else in the list is downstream of it.
 */
const unreadable = (errors: ReadonlyArray<OutlineError>): boolean =>
  errors.some((error) => error.code === "unreadable-directory")

export function Banner(props: { readonly errors: ReadonlyArray<OutlineError> }) {
  return (
    <aside
      class="mb-6 rounded border border-alarm bg-alarm/5 px-4 py-3"
      data-testid={TESTID.staleBanner}
    >
      <h2 class="m-0 mb-1 text-base font-bold text-alarm">
        Showing the last good version
      </h2>
      <Show
        when={unreadable(props.errors)}
        fallback={
          <Lede>
            The files on disk no longer validate, so the outline below is the one
            from before they stopped. Fix these and it catches up on its own —
            nothing needs reloading.
          </Lede>
        }
      >
        <Lede>
          The served directory cannot be read right now, so the outline below is
          the one from before it went away. Nothing here is wrong with your
          files, and nothing needs reloading — it catches up on its own once the
          directory can be read again.
        </Lede>
      </Show>
      <Report errors={props.errors} />
    </aside>
  )
}
