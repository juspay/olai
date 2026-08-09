/**
 * One outline, drawn.
 *
 * Every derived thing on screen — a parent's status, the order of siblings,
 * which part of a title is a tag — comes from @olai/format's own functions, so
 * the view and the validator can never disagree about what the file means. The
 * client computes nothing about the format on its own.
 *
 * Mirrors are expanded in place: a mirror shows its target's subtree, marked,
 * because a pointer the reader has to go and follow is not a second location,
 * it is a footnote. The expansion carries the ancestor ids it passed through
 * and refuses to re-enter one. The validator already rejects a set whose
 * mirrors close a loop, so that guard should never fire — but a renderer that
 * hangs is a worse way to learn about a bug than a marked stub.
 */

import {
  childIndex,
  type Located,
  rootsOf,
  type Status,
  statusIndex,
  titleParts,
} from "@olai/format"
import { createMemo, For, Show } from "solid-js"

import { renderMarkdown } from "./markdown.ts"

export interface TreeProps {
  /** EVERY node in the served set, not just this file's. A mirror may target
   *  any file — that is what mirrors are for — so the lookups have to see the
   *  whole set or a cross-file mirror renders as a dangling one. Only the
   *  roots are per-file. */
  readonly nodes: ReadonlyArray<Located>
  /** Which outline is open. */
  readonly file: string
  /** Ids the reader has collapsed. Client-local: collapsing is a property of
   *  this tab's reading, not of the file, so it never leaves the browser. */
  readonly collapsed: ReadonlySet<string>
  readonly onToggle: (id: string) => void
}

export function Tree(props: TreeProps) {
  const children = createMemo(() => childIndex(props.nodes))
  const status = createMemo(() => statusIndex(props.nodes, children()))
  const byId = createMemo(
    () => new Map(props.nodes.map((located) => [located.node.id, located])),
  )
  const roots = createMemo(() =>
    rootsOf(props.nodes.filter((located) => located.file === props.file))
  )

  return (
    <ul class="tree" data-testid="outline-tree">
      <For each={roots()}>
        {(located) => (
          <Branch
            located={located}
            ancestors={[]}
            children={children()}
            status={status()}
            byId={byId()}
            collapsed={props.collapsed}
            onToggle={props.onToggle}
          />
        )}
      </For>
    </ul>
  )
}

interface BranchProps {
  readonly located: Located
  /** The ids on the path from the root to here, mirror hops included. */
  readonly ancestors: ReadonlyArray<string>
  readonly children: ReadonlyMap<string, ReadonlyArray<Located>>
  readonly status: ReadonlyMap<string, Status>
  readonly byId: ReadonlyMap<string, Located>
  readonly collapsed: ReadonlySet<string>
  readonly onToggle: (id: string) => void
}

function Branch(props: BranchProps) {
  /** A mirror stands for its target: the subtree drawn under it, and the
   *  record whose title and dates are shown, both come from there. */
  const shown = createMemo(() => {
    const mirror = props.located.node.mirror
    return mirror === undefined ? props.located : props.byId.get(mirror)
  })

  const isMirror = () => props.located.node.mirror !== undefined
  const revisits = () =>
    shown() !== undefined && props.ancestors.includes(shown()!.node.id)

  const kids = createMemo(() => {
    const target = shown()
    return target === undefined || revisits()
      ? []
      : (props.children.get(target.node.id) ?? [])
  })

  const key = () => keyOf(props.located, props.ancestors)
  const isCollapsed = () => props.collapsed.has(key())

  return (
    <li
      class="node"
      data-testid="node"
      data-node-id={props.located.node.id}
      data-status={props.status.get(props.located.node.id) ?? "open"}
      data-collapsed={String(isCollapsed())}
      {...(isMirror() ? { "data-mirror": "true" } : {})}
      data-file={props.located.file}
      data-line={props.located.line}
    >
      <div class="row">
        <Show
          when={kids().length > 0}
          fallback={<span class="toggle-space" aria-hidden="true" />}
        >
          <button
            type="button"
            class="toggle"
            data-testid="toggle"
            aria-expanded={!isCollapsed()}
            aria-label={isCollapsed() ? "expand" : "collapse"}
            onClick={() => props.onToggle(key())}
          >
            {isCollapsed() ? "▸" : "▾"}
          </button>
        </Show>

        <Show
          when={shown()}
          fallback={<span class="dangling">mirror of an unknown node</span>}
        >
          {(target) => (
            <span class="title" data-testid="node-title">
              <Show when={isMirror()}>
                <span class="mirror-mark" title="a mirror of another node">
                  ⇢
                </span>
              </Show>
              <For each={titleParts(target().node.title ?? "")}>
                {(part) =>
                  part.kind === "tag"
                    ? <span class="tag" data-testid="tag">#{part.tag}</span>
                    : <>{part.text}</>}
              </For>
            </span>
          )}
        </Show>

        <Show when={shown()?.node.date}>
          {(date) => <span class="date" data-testid="date">{date()}</span>}
        </Show>
      </div>

      <Show when={!isCollapsed() && shown()?.node.desc}>
        {(desc) => (
          <div
            class="desc"
            data-testid="desc"
            // Safe because the pipeline sanitises: see ./markdown.ts.
            innerHTML={renderMarkdown(desc())}
          />
        )}
      </Show>

      <Show when={revisits()}>
        <div class="cycle-stub">
          this mirror is inside the subtree it shows — not expanded
        </div>
      </Show>

      <Show when={!isCollapsed() && kids().length > 0}>
        <ul class="children">
          <For each={kids()}>
            {(child) => (
              <Branch
                located={child}
                ancestors={[...props.ancestors, shown()!.node.id]}
                children={props.children}
                status={props.status}
                byId={props.byId}
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

/** Collapse is per PLACE, not per node: the same node reached through two
 *  mirrors is two rows on screen, and folding one should not fold the other.
 *  The path to a row is what makes it that row. */
const keyOf = (located: Located, ancestors: ReadonlyArray<string>): string =>
  [...ancestors, located.node.id].join("/")
