import { Key } from "@solid-primitives/keyed"
import { createSignal, For, onCleanup, Show } from "solid-js"

import { type Claims, type Reference, type Way, WAYS } from "@olai/format"
import type { AnyTestId } from "@olai/ui-primitives/testids.ts"
import type { ReferrerMemory } from "@olai/ui-primitives/referrer-memory.ts"
import { Tip } from "@olai/web/client/Tip.tsx"

import { TitleHtml } from "./TitleHtml.tsx"
import { renderTitle } from "./title.ts"

export interface ReferrerRow {
  readonly key: string
  readonly opens: string
  readonly calls: string
  readonly callsFrom: string
  readonly where?: string
  readonly tip?: string
  readonly ref?: string
}

export const referrerRowOf = (one: Reference, open: {
  readonly file: (path: string) => string
  readonly node: (id: string) => string
}): ReferrerRow =>
  "path" in one.source
    ? {
      key: `doc:${one.source.path}`,
      opens: open.file(one.source.path),
      calls: one.source.title,
      callsFrom: one.source.path,
      tip: `Open ${one.source.path}`,
      ref: one.source.path,
    }
    : {
      key: `node:${one.source.node.id}`,
      opens: open.node(one.source.node.id),
      calls: one.source.node.title,
      callsFrom: one.source.file,
      where: one.source.file,
      tip: `Open ${one.source.node.title}`,
      ref: one.source.node.id,
    }

export interface ReferrerWay {
  readonly way: Way
  readonly label: string
  readonly refs: AnyTestId
}

export const makeReferrerWays = (refs: Record<Way, AnyTestId>): ReadonlyArray<ReferrerWay> =>
  WAYS.map((way) => ({ way, label: REFERRER_LABELS[way], refs: refs[way] }))

const REFERRER_LABELS: Record<Way, string> = {
  see: "Sees this",
  mention: "Mentions this",
  link: "Links to this",
}
export type { ReferrerMemory } from "@olai/ui-primitives/referrer-memory.ts"


export interface ReferrersSectionProps {
  readonly found: ReadonlyArray<Reference>
  readonly claims: Claims | undefined
  readonly ways: ReadonlyArray<ReferrerWay>
  readonly row: (one: Reference) => ReferrerRow
  readonly stillShown: () => boolean
  readonly memoryKey: string
  readonly testid: AnyTestId
  readonly summaryTestid: AnyTestId
  readonly linkTestid: AnyTestId
  readonly memory: ReferrerMemory | undefined
}

const said = (total: number): string =>
  `Referenced by ${total} ${total === 1 ? "thing" : "things"}`

export function ReferrersSection(props: ReferrersSectionProps) {
  const [open, setOpen] = createSignal(false)
  /** `<details>` reads its `open` attribute at parse time, so the element must
   *  be BORN open rather than opened a frame later by a command. */
  const initiallyOpen = () => props.memory?.opened?.get(props.memoryKey) ?? false
  onCleanup(() => {
    if (!props.stillShown()) props.memory?.forget(props.memoryKey)
  })
  return (
    <details
      ref={(element) => { element.open = initiallyOpen() }}
      class="mt-3 border-t border-rule pt-2"
      data-testid={props.testid}
      data-count={props.found.length}
      // `<details>` opens itself on a press, on a keyboard activation and on a
      // browser's find-in-page, so its state is read back, never commanded.
      onToggle={(event) => {
        const now = event.currentTarget.open
        setOpen(now)
        props.memory?.remember(props.memoryKey, now)
      }}
    >
      <summary
        data-testid={props.summaryTestid}
        class="cursor-pointer select-none text-muted hover:text-ink"
        data-count={props.found.length}
      >
        {said(props.found.length)}
      </summary>
      <Show when={open()}>
        <For each={props.ways}>
          {(way) => (
            <Show when={props.found.some((one) => one.ways.includes(way.way))}>
              <div
                class="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm"
                data-testid={way.refs}
              >
                <span class="text-muted">{way.label}</span>
                <Key
                  each={props.found.filter((one) => one.ways.includes(way.way)).map(props.row)}
                  by="key"
                >
                  {(row) => (
                    <>
                      <Tip text={row().tip ?? ""} disabled={row().tip === undefined}>
                        <a
                          class="inline-flex items-center text-accent no-underline hover:underline md:min-h-0"
                          data-testid={props.linkTestid}
                          href={row().opens}
                        >
                          <Show when={row().ref}>
                            {(ref) => <span data-ref={ref()} />}
                          </Show>
                          <TitleHtml
                            drawing={renderTitle(props.claims, row().calls, row().callsFrom, { links: false })}
                          />
                        </a>
                      </Tip>
                      <Show when={row().where}>
                        {(where) => (
                          <span class="ml-1 font-mono text-xs text-muted">{where()}</span>
                        )}
                      </Show>
                    </>
                  )}
                </Key>
              </div>
            </Show>
          )}
        </For>
      </Show>
    </details>
  )
}