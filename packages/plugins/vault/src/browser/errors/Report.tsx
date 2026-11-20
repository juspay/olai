import { Key } from "@solid-primitives/keyed"
import { TESTID } from "olai-plugin-vault/testids"
import { hasLine, isCrossFile, type OutlineError, type Site } from "@olai/format"
import { createMemo, For, Show } from "solid-js"


import { Lede } from "@olai/web/client/errors/Lede.tsx"

export function Report(props: { readonly errors: ReadonlyArray<OutlineError> }) {
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
      <Key each={split().byFile} by={one => one[0]}>
        {(group) => (
          <section data-testid={TESTID.errorFileGroup} data-file={group()[0]}>
            <Heading>{group()[0]}</Heading>
            <Rows errors={group()[1]} />
          </section>
        )}
      </Key>

      <Show when={split().across.length > 0}>
        <section data-testid={TESTID.crossFileErrors}>
          <Heading>Across files</Heading>
          <Lede>
            These involve two files: a link to another file, or a loop that
            runs through another one.
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
    <h2 class="mt-8 mb-2 text-title">{props.children as never}</h2>
  )
}

function Row(props: { readonly error: OutlineError }) {
  return (
    <li
      class="mb-2 border-l-[3px] border-alarm py-1.5 pl-3"
      data-testid={TESTID.error}
      data-code={props.error.code}
    >
      <At site={props.error} />
      <span>{props.error.message}</span>
      <Show when={props.error.related?.length}>
        <ul class="mt-1 ml-4 list-none text-body text-muted">
          <For each={props.error.related ?? []}>
            {(related) => (
              <li>
                <At site={related} />
                <span>{related.note}</span>
              </li>
            )}
          </For>
        </ul>
      </Show>
    </li>
  )
}

function At(props: { readonly site: Site }) {
  return (
    <code class="mr-2 font-mono text-body text-muted">
      {props.site.file}
      {hasLine(props.site) ? `:${props.site.line}` : ""}
    </code>
  )
}
