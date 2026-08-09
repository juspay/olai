/**
 * The error view — which is the product, not the fallback.
 *
 * Every error the load produced is here, grouped by the file that has to be
 * edited, each naming `file:line`, each carrying whatever structured detail it
 * had (the other record that claimed the id, the rest of a cycle, the children
 * that are not done). Nothing is summarised away, because a reader who has to
 * re-run the server to find the second error is a reader we have failed.
 *
 * Errors that implicate two files get their own section: "which file is
 * broken" has no single answer for a dangling mirror or a cross-file cycle,
 * and filing them under one of the two would be a guess.
 */

import { isCrossFile, type OutlineError, stageOf } from "@olai/format"
import { createMemo, For, Show } from "solid-js"

import { TESTID } from "./testids.ts"

export function Errors(props: { readonly errors: ReadonlyArray<OutlineError> }) {
  const crossFile = createMemo(() => props.errors.filter(isCrossFile))
  /** A file is read whole or not at all, and the set-wide rules do not run
   *  until every file parses. So when anything here is a per-line error, this
   *  list is not the whole story yet — and saying so beats letting a reader
   *  believe a clean second pass means a clean set. */
  const unparsed = createMemo(() =>
    props.errors.some((error) => stageOf(error.code) === "line")
  )
  const byFile = createMemo(() => {
    const groups = new Map<string, Array<OutlineError>>()
    for (const error of props.errors) {
      if (isCrossFile(error)) continue
      const group = groups.get(error.file)
      if (group === undefined) groups.set(error.file, [error])
      else group.push(error)
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))
  })

  return (
    <main class="errors" data-testid={TESTID.errorView}>
      <h1>
        {props.errors.length === 0
          ? "Broken outlines"
          : `${props.errors.length} ${props.errors.length === 1 ? "error" : "errors"}`}
      </h1>
      <p class="lede">
        {props.errors.length === 0
          // The page is decided by the outline stream, and the report arrives
          // on its own subscription — so for the frame between them there is a
          // broken set and nothing yet to say about it.
          ? "The set could not be loaded. Fetching the report…"
          : "Nothing is served until these are fixed: an outline set is valid or it is not, and half of one would be a different set from the one on disk."}
      </p>
      <Show when={unparsed()}>
        <p class="lede" data-testid={TESTID.stageNote}>
          Some of these are lines that could not be read. The checks that span
          the whole set — references, cycles, derived state — run once every
          file parses, so expect a second round after these are fixed.
        </p>
      </Show>

      <For each={byFile()}>
        {([file, errors]) => (
          <section class="error-group" data-testid={TESTID.errorFileGroup} data-file={file}>
            <h2>{file}</h2>
            <ul>
              <For each={errors}>{(error) => <Row error={error} />}</For>
            </ul>
          </section>
        )}
      </For>

      <Show when={crossFile().length > 0}>
        <section class="error-group" data-testid={TESTID.crossFileErrors}>
          <h2>Across files</h2>
          <p class="lede">
            These name two places at once — a reference that leaves its file, or
            a loop that closes through another one.
          </p>
          <ul>
            <For each={crossFile()}>{(error) => <Row error={error} />}</For>
          </ul>
        </section>
      </Show>
    </main>
  )
}

function Row(props: { readonly error: OutlineError }) {
  return (
    <li class="error" data-testid={TESTID.error} data-code={props.error.code}>
      <code class="site">
        {props.error.file}:{props.error.line}
      </code>
      <span class="message">{props.error.message}</span>
      <Show when={props.error.related?.length}>
        <ul class="related">
          <For each={props.error.related ?? []}>
            {(related) => (
              <li>
                <code class="site">
                  {related.file}:{related.line}
                </code>
                <span class="note">{related.note}</span>
              </li>
            )}
          </For>
        </ul>
      </Show>
    </li>
  )
}
