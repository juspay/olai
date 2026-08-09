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
 * The one thing the client interprets on its own is a note, which is markdown
 * and is rendered (sanitised) at view time — see ./markdown.ts.
 */

import { type Row, titleParts } from "@olai/format"
import { createMemo, For, Match, Show, Switch } from "solid-js"

import { renderMarkdown } from "./markdown.ts"
import { TESTID } from "./testids.ts"

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
    <ul class="tree" data-testid={TESTID.outlineTree}>
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
  const html = createMemo(() => {
    const desc = shown()?.desc
    return desc === undefined ? undefined : renderMarkdown(desc)
  })

  return (
    <li
      class="node"
      data-testid={TESTID.node}
      data-node-id={props.row.at.node.id}
      data-status={props.row.status}
      data-collapsed={String(collapsed())}
      data-kind={props.row.kind}
      data-file={props.row.at.file}
      data-line={props.row.at.line}
    >
      <div class="row">
        <Show
          when={props.row.children.length > 0}
          fallback={<span class="toggle-space" aria-hidden="true" />}
        >
          <button
            type="button"
            class="toggle"
            data-testid={TESTID.toggle}
            aria-expanded={!collapsed()}
            aria-label={collapsed() ? "expand" : "collapse"}
            onClick={() => props.onToggle(props.row.key)}
          >
            {collapsed() ? "▸" : "▾"}
          </button>
        </Show>

        <Switch>
          <Match when={props.row.kind === "dangling" ? props.row : undefined}>
            {(row) => (
              <span class="dangling" data-testid={TESTID.nodeTitle}>
                a mirror of `{row().missing}`, which no node declares
              </span>
            )}
          </Match>
          <Match when={shown()}>
            {(node) => (
              <span class="title" data-testid={TESTID.nodeTitle}>
                <Show when={props.row.kind !== "node"}>
                  <span class="mirror-mark" title="a mirror of another node">⇢</span>
                </Show>
                <For each={titleParts(node().title)}>
                  {(part) =>
                    part.kind === "tag"
                      ? <span class="tag" data-testid={TESTID.tag}>#{part.tag}</span>
                      : <>{part.text}</>}
                </For>
              </span>
            )}
          </Match>
        </Switch>

        <Show when={shown()?.date}>
          {(date) => <span class="date" data-testid={TESTID.date}>{date()}</span>}
        </Show>
      </div>

      <Show when={!collapsed() && html()}>
        {(rendered) => (
          <div
            class="desc"
            data-testid={TESTID.desc}
            // Safe because the pipeline sanitises: see ./markdown.ts.
            innerHTML={rendered()}
          />
        )}
      </Show>

      <Show when={props.row.kind === "cycle" ? props.row : undefined}>
        {(row) => (
          <div class="cycle-stub">
            this mirror is inside the subtree it shows (`{row().through}`) — not
            expanded
          </div>
        )}
      </Show>

      <Show when={!collapsed() && props.row.children.length > 0}>
        <ul class="children">
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
