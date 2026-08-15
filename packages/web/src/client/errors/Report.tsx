/**
 * A list of errors, drawn.
 *
 * Every place errors appear renders through here — the whole-page view, the
 * banner over a last-good tree, the one broken outline in its own pane — so a
 * `file:line`, a message and its related sites look the same wherever they are
 * read, and none of the three can quietly start summarising.
 *
 * Two shapes, because there are two situations, and they are the whole of what
 * this module publishes — the headings and paragraphs it draws are its own
 * business, not a set of layout parts for callers to assemble errors out of.
 * {@link Report} GROUPS: by the file that has to be edited, with the errors
 * implicating two files kept apart, because "which file is broken" has no
 * single answer for a dangling mirror or a cross-file cycle and filing them
 * under one of the two would be a guess. {@link Rows} does not, and is for the
 * case where the grouping is already on screen — one file's errors, shown where
 * that file's outline would have been.
 */

import { hasLine, isCrossFile, type OutlineError } from "@olai/format"
import { createMemo, For, Show } from "solid-js"

import { TESTID } from "../testids.ts"
import { Lede } from "./Lede.tsx"

export function Report(props: { readonly errors: ReadonlyArray<OutlineError> }) {
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
    <>
      <For each={split().byFile}>
        {([file, errors]) => (
          <section data-testid={TESTID.errorFileGroup} data-file={file}>
            <Heading>{file}</Heading>
            <Rows errors={errors} />
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
          <Rows errors={split().across} />
        </section>
      </Show>
    </>
  )
}

export function Rows(props: { readonly errors: ReadonlyArray<OutlineError> }) {
  return (
    <ul class="m-0 list-none p-0">
      <For each={props.errors}>{(error) => <Row error={error} />}</For>
    </ul>
  )
}

function Heading(props: { readonly children: unknown }) {
  return (
    <h2 class="mt-8 mb-2 font-mono text-base">{props.children as never}</h2>
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

/** `file:line`, or just the file when there is no line to name. WHICH of those
 *  it is comes from the format (`hasLine`) rather than from a comparison
 *  written here: an agent's one-liner and these rows must not disagree about
 *  whether `plan.olai:0` is a line number somebody could go and look for. */
function Site(props: { readonly file: string; readonly line: number }) {
  return (
    <code class="mr-2 font-mono text-[0.8125rem] text-muted">
      {props.file}
      {hasLine(props) ? `:${props.line}` : ""}
    </code>
  )
}
