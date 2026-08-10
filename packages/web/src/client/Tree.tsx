/**
 * One outline, drawn.
 *
 * The shape of the tree is not decided here. `@olai/format` derives it —
 * status, sibling order, mirror expansion and the guard that stops a mirror
 * inside its own subtree — and hands back rows; this file turns a row into
 * markup and nothing else. That is the point: the view and the validator agree
 * about what a file means because they are running the same code, not because
 * two implementations were written to the same paragraph.
 *
 * A row's `kind` is what to draw, and each kind carries the answer already —
 * a dangling row knows the id its mirror chain actually died on, a cycle row
 * knows the id it closed on. Recomputing either from the record here would
 * give the FIRST hop, and say something untrue about a mirror three hops long.
 *
 * Every row's bullet is a link to that node's own page (./Bullet.tsx), on the
 * RECORD's id rather than the node it shows: a mirror's id resolves through
 * its chain to the same canonical page, so the two spellings agree and nothing
 * has to resolve anything here.
 */

import { type Row } from "@olai/format"
import { createMemo, For, Match, Show, Switch } from "solid-js"

import { Bullet } from "./Bullet.tsx"
import { DateBadge } from "./DateBadge.tsx"
import { NodeTitle } from "./NodeTitle.tsx"
import { Note } from "./Note.tsx"
import { TESTID } from "./testids.ts"
import { TONE } from "./tone.ts"

export interface TreeProps {
  readonly rows: ReadonlyArray<Row>
  /** Places the reader has folded. Client-local: folding is a property of this
   *  tab's reading, not of the file, so it never leaves the browser — and it
   *  is keyed by PLACE, because the same node reached through two mirrors is
   *  two rows and folding one must not fold the other. */
  readonly collapsed: ReadonlySet<string>
  readonly onToggle: (key: string) => void
}

export function Tree(props: TreeProps) {
  return (
    <ul class="list-none m-0 p-0" data-testid={TESTID.outlineTree}>
      <For each={props.rows}>
        {(row) => (
          <Branch row={row} collapsed={props.collapsed} onToggle={props.onToggle} />
        )}
      </For>
    </ul>
  )
}

function Branch(props: {
  readonly row: Row
  readonly collapsed: ReadonlySet<string>
  readonly onToggle: (key: string) => void
}) {
  // A memo, not a plain accessor: folding one row mints a new Set, and five
  // separate computations in this component read it. Without the memo every
  // row in the tree re-runs all five on every click.
  const collapsed = createMemo(() => props.collapsed.has(props.row.key))
  const shown = () => (props.row.kind === "node" || props.row.kind === "mirror")
    ? props.row.shows.node
    : undefined

  return (
    <li
      class="my-0.5"
      data-testid={TESTID.node}
      data-node-id={props.row.at.node.id}
      data-status={props.row.status}
      data-collapsed={String(collapsed())}
      data-kind={props.row.kind}
      data-file={props.row.at.file}
      data-line={props.row.at.line}
    >
      <div class="flex items-baseline gap-1.5">
        <Show
          when={props.row.children.length > 0}
          fallback={<span class="w-4 shrink-0" aria-hidden="true" />}
        >
          <button
            type="button"
            class="w-4 shrink-0 cursor-pointer border-0 bg-transparent p-0 text-center text-xs text-muted hover:text-ink"
            data-testid={TESTID.toggle}
            aria-expanded={!collapsed()}
            aria-label={collapsed() ? "expand" : "collapse"}
            onClick={() => props.onToggle(props.row.key)}
          >
            {collapsed() ? "▸" : "▾"}
          </button>
        </Show>

        <Bullet id={props.row.at.node.id} />

        <Switch>
          <Match when={props.row.kind === "dangling" ? props.row : undefined}>
            {(row) => (
              <span class="flex-1 text-sm text-alarm" data-testid={TESTID.nodeTitle}>
                a mirror of `{row().missing}`, which no node declares
              </span>
            )}
          </Match>
          <Match when={shown()}>
            {(node) => (
              <span
                class={`flex-1 ${TONE[props.row.status]}`}
                data-testid={TESTID.nodeTitle}
              >
                <Show when={props.row.kind !== "node"}>
                  <span class="mr-1 text-muted" title="a mirror of another node">
                    ⇢
                  </span>
                </Show>
                <NodeTitle title={node().title} />
              </span>
            )}
          </Match>
        </Switch>

        <Show when={shown()?.date}>
          {(date) => <DateBadge date={date()} />}
        </Show>
      </div>

      <Show when={!collapsed() && shown()?.desc}>
        {(desc) => <Note desc={desc()} class="mt-1 mb-2 ml-11 text-[0.9375rem] text-muted" />}
      </Show>

      <Show when={props.row.kind === "cycle" ? props.row : undefined}>
        {(row) => (
          <div class="ml-11 text-sm text-alarm">
            this mirror is inside the subtree it shows (`{row().through}`) — not
            expanded
          </div>
        )}
      </Show>

      <Show when={!collapsed() && props.row.children.length > 0}>
        <ul class="ml-5 list-none border-l border-rule pl-3">
          <For each={props.row.children}>
            {(child) => (
              <Branch
                row={child}
                collapsed={props.collapsed}
                onToggle={props.onToggle}
              />
            )}
          </For>
        </ul>
      </Show>
    </li>
  )
}
