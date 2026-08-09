/**
 * The error view — which is the product, not the fallback.
 *
 * This is the whole page, and it is what a reader gets when there is nothing
 * else to show: the set has never loaded, so there is no last-good tree to put
 * a banner over. Every error the load produced is here, each naming `file:line`,
 * each carrying whatever structured detail it had (the other record that
 * claimed the id, the rest of a cycle, the children that are not done). Nothing
 * is summarised away, because a reader who has to re-run the server to find the
 * second error is a reader we have failed.
 *
 * The two DEGRADED cases are elsewhere and deliberately quieter, because in
 * both of them something real is still on screen: ../Banner.tsx over a
 * last-good tree, and ./Broken.tsx in one outline's place.
 */

import { type OutlineError, reportStage } from "@olai/format"
import { Show } from "solid-js"

import { TESTID } from "../testids.ts"
import { Report } from "./Report.tsx"

export function Page(props: { readonly errors: ReadonlyArray<OutlineError> }) {
  return (
    <main class="max-w-4xl p-8" data-testid={TESTID.errorView}>
      <h1 class="m-0 mb-2 text-2xl font-bold text-alarm">
        {props.errors.length === 0
          ? "Broken outlines"
          : `${props.errors.length} ${props.errors.length === 1 ? "error" : "errors"}`}
      </h1>
      <p class="mt-0 mb-4 max-w-3xl text-muted">
        {props.errors.length === 0
          // The page is decided by the outline stream, and the report arrives
          // on its own subscription — so for the frame between them there is a
          // broken set and nothing yet to say about it.
          ? "The set could not be loaded. Fetching the report…"
          : "Nothing is served until these are fixed: an outline set is valid or it is not, and half of one would be a different set from the one on disk."}
      </p>
      <Show when={reportStage(props.errors) === "line"}>
        <p class="mt-0 mb-4 max-w-3xl text-muted" data-testid={TESTID.stageNote}>
          Some of these are lines that could not be read. The nodes in those
          files are missing from the set, so references that might point into
          them are not reported yet — expect a second round after these are
          fixed.
        </p>
      </Show>

      <Report errors={props.errors} />
    </main>
  )
}
