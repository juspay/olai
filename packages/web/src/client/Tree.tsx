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
 * The one thing the client does interpret on its own is a note, which is
 * markdown and is rendered (sanitised) at view time — see ./markdown.ts.
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
  const collapsed = () => props.collapsed.has(props.row.key)
  const shown = () => props.row.shows
  const desc = createMemo(() => {
    const node = shown()?.node
    return node !== undefined && "desc" in node ? node.desc : undefined
  })
  const html = createMemo(() => {
    const source = desc()
    return source === undefined ? undefined : renderMarkdown(source)
  })

  return (
    <li
      class="node"
      data-testid={TESTID.node}
      data-node-id={props.row.at.node.id}
      data-status={props.row.status}
      data-collapsed={String(collapsed())}
      data-kind={props.row.kind}
      {...(props.row.kind === "node" ? {} : { "data-mirror": "true" })}
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
          <Match when={props.row.kind === "dangling"}>
            <span class="dangling" data-testid={TESTID.nodeTitle}>
              a mirror of `{mirrorTarget(props.row)}`, which no node declares
            </span>
          </Match>
          <Match when={shown()}>
            {(target) => (
              <span class="title" data-testid={TESTID.nodeTitle}>
                <Show when={props.row.kind !== "node"}>
                  <span class="mirror-mark" title="a mirror of another node">⇢</span>
                </Show>
                <For each={titleParts(titleOf(target().node))}>
                  {(part) =>
                    part.kind === "tag"
                      ? <span class="tag" data-testid={TESTID.tag}>#{part.tag}</span>
                      : <>{part.text}</>}
                </For>
              </span>
            )}
          </Match>
        </Switch>

        <Show when={dateOf(shown())}>
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

      <Show when={props.row.kind === "cycle"}>
        <div class="cycle-stub">
          this mirror is inside the subtree it shows — not expanded
        </div>
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

/** A mirror's target id, for the one row that has nothing else to show. */
const mirrorTarget = (row: Row): string =>
  "mirror" in row.at.node ? row.at.node.mirror : row.at.node.id

const titleOf = (node: Row["at"]["node"]): string =>
  "title" in node ? node.title : ""

const dateOf = (located: Row["shows"]): string | undefined => {
  const node = located?.node
  return node !== undefined && "date" in node ? node.date : undefined
}
