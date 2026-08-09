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

import { isCrossFile, type OutlineError, reportStage } from "@olai/format"
import { createMemo, For, Show } from "solid-js"

import { TESTID } from "./testids.ts"

export function Errors(props: { readonly errors: ReadonlyArray<OutlineError> }) {
  /** One walk, one partition. "Under its file" and "across files" are the two
   *  halves of one split; computing them with two predicates that have to stay
   *  each other's complement is how an error goes missing from both — in the
   *  view whose whole promise is that nothing is dropped. */
  const split = createMemo(() => {
    const across: Array<OutlineError> = []
    const groups = new Map<string, Array<OutlineError>>()
    for (const error of props.errors) {
      if (isCrossFile(error)) {
        across.push(error)
        continue
      }
      const group = groups.get(error.file)
      if (group === undefined) groups.set(error.file, [error])
      else group.push(error)
    }
    return {
      across,
      byFile: [...groups.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
    }
  })

  return (
    <main class="max-w-4xl p-8" data-testid={TESTID.errorView}>
      <h1 class="m-0 mb-2 text-2xl font-bold text-alarm">
        {props.errors.length === 0
          ? "Broken outlines"
          : `${props.errors.length} ${props.errors.length === 1 ? "error" : "errors"}`}
      </h1>
      <Lede>
        {props.errors.length === 0
          // The page is decided by the outline stream, and the report arrives
          // on its own subscription — so for the frame between them there is a
          // broken set and nothing yet to say about it.
          ? "The set could not be loaded. Fetching the report…"
          : "Nothing is served until these are fixed: an outline set is valid or it is not, and half of one would be a different set from the one on disk."}
      </Lede>
      <Show when={reportStage(props.errors) === "line"}>
        <Lede testid={TESTID.stageNote}>
          Some of these are lines that could not be read. The checks that span
          the whole set — references, cycles, derived state — run once every
          file parses, so expect a second round after these are fixed.
        </Lede>
      </Show>

      <For each={split().byFile}>
        {([file, errors]) => (
          <section data-testid={TESTID.errorFileGroup} data-file={file}>
            <Heading>{file}</Heading>
            <ul class="m-0 list-none p-0">
              <For each={errors}>{(error) => <Row error={error} />}</For>
            </ul>
          </section>
        )}
      </For>

      <Show when={split().across.length > 0}>
        <section data-testid={TESTID.crossFileErrors}>
          <Heading>Across files</Heading>
          <Lede>
            These name two places at once — a reference that leaves its file, or
            a loop that closes through another one.
          </Lede>
          <ul class="m-0 list-none p-0">
            <For each={split().across}>{(error) => <Row error={error} />}</For>
          </ul>
        </section>
      </Show>
    </main>
  )
}

function Heading(props: { readonly children: unknown }) {
  return (
    <h2 class="mt-8 mb-2 font-mono text-base">{props.children as never}</h2>
  )
}

function Lede(props: { readonly children: unknown; readonly testid?: string }) {
  return (
    <p class="mt-0 mb-4 max-w-3xl text-muted" data-testid={props.testid}>
      {props.children as never}
    </p>
  )
}

function Row(props: { readonly error: OutlineError }) {
  return (
    <li
      class="mb-2 border-l-[3px] border-alarm py-1.5 pl-3"
      data-testid={TESTID.error}
      data-code={props.error.code}
    >
      <Site file={props.error.file} line={props.error.line} />
      <span>{props.error.message}</span>
      <Show when={props.error.related?.length}>
        <ul class="mt-1 ml-4 list-none text-sm text-muted">
          <For each={props.error.related ?? []}>
            {(related) => (
              <li>
                <Site file={related.file} line={related.line} />
                <span>{related.note}</span>
              </li>
            )}
          </For>
        </ul>
      </Show>
    </li>
  )
}

function Site(props: { readonly file: string; readonly line: number }) {
  return (
    <code class="mr-2 font-mono text-[0.8125rem] text-muted">
      {props.file}:{props.line}
    </code>
  )
}
