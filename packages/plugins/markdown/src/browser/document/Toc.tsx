import { Key } from "@solid-primitives/keyed"
import { TESTID } from "olai-plugin-markdown/testids"
import { createMemo, For, Show } from "solid-js"

import type { Heading } from "@olai/markdown-ui/outline.ts"

import { TARGET } from "@olai/ui-primitives/touch.ts"

const INDENT_REM = 0.75

const LINE =
  `inline-block ${TARGET} py-3 break-words text-ink/80 no-underline hover:text-accent md:min-h-0 md:py-0`

export function Toc(props: {
  readonly file: string
  readonly headings: readonly Heading[]
}) {
  const base = createMemo(() => {
    let shallowest = 6
    for (const heading of props.headings) shallowest = Math.min(shallowest, heading.depth)
    return shallowest
  })

  const drawnFor = createMemo(() => (props.headings.length > 1 ? props.file : undefined))

  return (
    // `open` is an attribute the browser owns once a reader has touched it, so a
    // reused block would carry one document's answer onto the next.
    <Show when={drawnFor()} keyed>
      <nav aria-label="Contents">
        <details
          open
          class="mb-6 rounded-control border border-rule bg-desk/40 px-3 py-2"
          data-testid={TESTID.toc}
        >
          <summary class="cursor-pointer select-none text-caption font-semibold uppercase tracking-[0.08em] text-muted">
            Contents
          </summary>
          <ol class="mt-2 space-y-0.5 text-label">
            <Key each={props.headings} by="id">
              {(heading) => (
                <li style={{ "padding-left": `${(heading().depth - base()) * INDENT_REM}rem` }}>
                  <a href={heading().route ?? `#${heading().id}`} class={LINE} data-testid={TESTID.tocLink}>
                    {heading().text}
                  </a>
                </li>
              )}
            </Key>
          </ol>
        </details>
      </nav>
    </Show>
  )
}
