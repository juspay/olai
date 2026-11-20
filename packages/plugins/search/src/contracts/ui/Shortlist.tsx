import type { Claims } from "@olai/format"
import type { Signal } from "solid-js"
import type { NodeHit } from "@olai/format"
import { type Accessor, createMemo, createSelector, createSignal, Index, onMount, Show } from "solid-js"

import { SaidLine } from "@olai/web/client/SaidLine.tsx"
import { listKey } from "@olai/web/client/keys.ts"
import { Refused } from "@olai/web/client/Refused.tsx"
import type { AnyTestId } from "@olai/ui-primitives/testids.ts"
import { TARGET } from "@olai/ui-primitives/touch.ts"
import { createCursor } from "@olai/ui-primitives/cursor.ts"
import type { NodeSearch } from "olai-plugin-search/reading"
import { Result, type RowTestids } from "olai-plugin-search/ui/Result.tsx"
import type { CrumbFaces } from "olai-plugin-search/ui/PlaceLine.tsx"
import { type HitRow, hitRow } from "olai-plugin-search/ui/row.ts"

export interface ShortlistTestids {
  readonly box: AnyTestId
  readonly row: RowTestids
  readonly failed: AnyTestId
}

export function Shortlist(props: {
  readonly claims: Claims | undefined;
  /** Handed in: a contract closure may not acquire a provider resource. */
  readonly nodes: NodeSearch
  readonly query?: Signal<string>
  readonly label: string
  readonly testids: ShortlistTestids
  readonly faces?: CrumbFaces
  readonly onTake: (hit: NodeHit) => void
  readonly refusing?: {
    readonly why: (hit: NodeHit) => string | null
    readonly testid: AnyTestId
    readonly asked?: (hits: Accessor<ReadonlyArray<NodeHit>>) => void
  }
}) {
  const [query, setQuery] = props.query ?? createSignal("")
  const found = props.nodes(() => query(), "node")
  const hits = found.hits
  const cursor = createCursor(() => hits().length)
  const isCurrent = createSelector(cursor.at)

  const rows = createMemo(() => hits().map(hit => hitRow(hit)))

  const row = (index: number): HitRow => rows()[index]!

  onMount(() => {
    props.refusing?.asked?.(hits)
  })

  const verdicts = createMemo<ReadonlyArray<string | null>>(() => {
    const judge = props.refusing
    return hits().map((hit) => (judge === undefined ? null : judge.why(hit)))
  })

  const refusal = (): string | null => verdicts()[cursor.at()] ?? null

  const take = (index: number): void => {
    const hit = hits()[index]
    if (hit === undefined) return
    cursor.to(index)
    if (verdicts()[index] !== null) return
    props.onTake(hit)
  }

  return (
    <div
      data-asked={found.answering() ?? undefined}
    >
      <input
        type="text"
        class={`${TARGET} md:min-h-0 w-full rounded-control border border-rule bg-paper px-2 py-1 text-body text-ink outline-none focus:border-accent`}
        data-testid={props.testids.box}
        aria-label={props.label}
        placeholder={props.label}
        enterkeyhint="go"
        autocorrect="off"
        autocapitalize="none"
        spellcheck={false}
        value={query()}
        // `queueMicrotask`: the element is not in the document when the ref runs.
        ref={(box) => queueMicrotask(() => box.focus())}
        onInput={(event) => {
          setQuery(event.currentTarget.value)
          cursor.top()
        }}
        onKeyDown={(event) => {
          switch (listKey(event)) {
            case "dismiss":
              return
            case "next":
              event.preventDefault()
              cursor.step(1)
              return
            case "prev":
              event.preventDefault()
              cursor.step(-1)
              return
            case "take":
              if (hits().length > 0) event.preventDefault()
              found.taking(() => take(cursor.at()))
              return
            case null:
              return
          }
        }}
      />

      <Show when={found.failure()}>
        {(failure) => (
          <SaidLine
            said={{ tone: "alarm", text: failure() }}
            class="m-0 mt-1 text-label"
            testid={props.testids.failed}
          />
        )}
      </Show>

      <ul class="m-0 max-h-56 list-none overflow-x-hidden overflow-y-auto p-0">
        <Index each={hits()}>
          {(hit, index) => (
            <li
              data-refused={verdicts()[index] === null ? undefined : "true"}
              classList={{ "opacity-60": verdicts()[index] !== null }}
            >
              <Result
                claims={props.claims}
                label={row(index).label}

                place={row(index).place}
                props={row(index).props}
                faces={props.faces}
                active={isCurrent(index)}
                testids={props.testids.row}
                id={row(index).id}
                onHover={() => cursor.to(index)}
                onSelect={() => take(index)}
              />
            </li>
          )}
        </Index>
      </ul>

      <Show when={props.refusing}>
        {(judging) => (
          <Show when={refusal()}>
            {(why) => (
              <div class="mt-1">
                <Refused said={why()} testid={judging().testid} />
              </div>
            )}
          </Show>
        )}
      </Show>
    </div>
  )
}
