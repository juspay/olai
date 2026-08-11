/**
 * The ways around the DIRECTORY: the month, and the directory as a TREE.
 *
 * Desktop: a resizable column when open, replaced by the icon rail when
 * minimized (./layout/Rail.tsx). Mobile: a slide-over drawer with scrim —
 * not the old capped close-on-any-tap sheet. App chrome (connection, agent,
 * theme) lives in the header; this column is only the directory.
 *
 * Directory nodes collapse client-locally like the outline tree's folds
 * (./view.ts). The entry that lights up is the file the open page lives in.
 */

import type { BrokenFile } from "@olai/format"
import { Key } from "@solid-primitives/keyed"
import {
  createMemo,
  createSelector,
  createSignal,
  type JSX,
  Match,
  Show,
  Switch,
} from "solid-js"

import { type FileRow, fileTree } from "./fileTree.ts"
import { SidebarHandle } from "./layout/Handle.tsx"
import { setSidebarOpen } from "./layout/prefs.ts"
import { Link } from "./router.tsx"
import { TESTID } from "./testids.ts"
import { CONTROL, TARGET, TARGET_BOX } from "./touch.ts"

/** One file entry. Workflowy-quiet: soft hover, soft current. */
const ENTRY =
  `flex ${TARGET} items-center break-all rounded-sm px-2 py-0.5 text-[0.8125rem] leading-snug ` +
  "no-underline text-ink hover:bg-rule/60 aria-[current=page]:bg-rule " +
  "aria-[current=page]:text-ink md:min-h-0"

/** A directory row: folds, does not navigate. */
const DIR =
  `flex ${TARGET} items-center gap-0.5 rounded-sm px-1 py-0.5 text-[0.8125rem] ` +
  "leading-snug text-muted hover:bg-rule/60 hover:text-ink md:min-h-0"

interface TreeView {
  readonly isActive: (file: string) => boolean
  readonly broken: ReadonlyMap<string, BrokenFile>
  readonly collapsed: () => ReadonlySet<string>
  readonly toggle: (path: string) => void
}

export function Sidebar(props: {
  readonly files: ReadonlyArray<string>
  readonly documents: ReadonlyArray<string>
  readonly active: string | undefined
  readonly broken: ReadonlyMap<string, BrokenFile>
  readonly children?: JSX.Element
  /**
   * Mobile drawer open. Desktop always draws the column when this component
   * is mounted (the parent swaps in the rail when minimized).
   */
  readonly open: boolean
  /** Shut the mobile drawer (navigation, scrim). */
  readonly onClose: () => void
}) {
  const [collapsed, setCollapsed] = createSignal(new Set<string>())
  const toggle = (path: string) => {
    setCollapsed((current) => {
      const next = new Set(current)
      if (!next.delete(path)) next.add(path)
      return next
    })
  }

  const isActive = createSelector(() => props.active)
  const tree = createMemo(() => fileTree(props.files, props.documents))

  const view: TreeView = {
    isActive,
    get broken() {
      return props.broken
    },
    collapsed,
    toggle,
  }

  return (
    <>
      {/* Mobile scrim: only when the drawer is open. */}
      <Show when={props.open}>
        <button
          type="button"
          class="fixed inset-0 z-30 bg-ink/40 md:hidden"
          data-testid={TESTID.sidebarScrim}
          aria-label="close the directory"
          onClick={() => props.onClose()}
        />
      </Show>

      <nav
        class={
          // Mobile closed: `hidden` so Playwright (and thumbs) agree it is put
          // away — off-screen translate still counts as visible to the suite.
          // Mobile open: fixed drawer under the header with a right rule.
          // Desktop: in-flow column; width comes from the grid / CSS var.
          (props.open ? "flex " : "hidden ") +
          "relative z-40 flex-col border-r border-rule bg-paper " +
          "fixed bottom-0 left-0 top-[var(--height-header,3rem)] w-[min(20rem,85vw)] " +
          "md:static md:flex md:h-full md:w-full md:translate-x-0"
        }
        data-testid={TESTID.sidebar}
        data-open={props.open ? "true" : "false"}
      >
        {/* Desktop: collapse to the rail. The resize handle is a full-height
            edge of this nav (absolute), not a strip on this toolbar. */}
        <div class="hidden shrink-0 items-center justify-end border-b border-rule px-2 py-1 md:flex">
          <button
            type="button"
            class={`${TARGET_BOX} inline-flex items-center justify-center rounded text-muted hover:bg-rule/60 hover:text-ink md:min-h-8 md:min-w-8`}
            data-testid={TESTID.sidebarCollapse}
            aria-label="collapse the sidebar to the icon rail"
            title="collapse sidebar"
            onClick={() => setSidebarOpen(false)}
          >
            <svg viewBox="0 0 16 16" class="size-4" aria-hidden="true" fill="currentColor">
              <path d="M9.78 3.22a.75.75 0 0 1 0 1.06L6.56 8l3.22 3.72a.75.75 0 1 1-1.06 1.06l-4-4a.75.75 0 0 1 0-1.06l4-4a.75.75 0 0 1 1.06 0z" />
            </svg>
          </button>
        </div>
        <div class="hidden md:contents">
          <SidebarHandle />
        </div>

        <div
          class="min-h-0 flex-1 overflow-y-auto p-4"
          data-testid={TESTID.sidebarBody}
          // Any navigation (day, outline, document) bubbles here and puts the
          // mobile drawer away. Folder folds stop propagation so a reader can
          // open several without reopening the drawer each time.
          onClick={() => props.onClose()}
        >
          {props.children}

          <ul class="m-0 list-none p-0" data-testid={TESTID.outlineList}>
            <Key each={tree()} by="key">
              {(row) => <Entry row={row()} view={view} />}
            </Key>
          </ul>
        </div>
      </nav>
    </>
  )
}

function Entry(props: {
  readonly row: FileRow
  readonly view: TreeView
}) {
  return (
    <Switch>
      <Match when={props.row.kind === "dir" ? props.row : undefined}>
        {(dir) => <Dir row={dir()} view={props.view} />}
      </Match>
      <Match when={props.row.kind === "file" ? props.row : undefined}>
        {(file) => <File row={file()} view={props.view} />}
      </Match>
    </Switch>
  )
}

function Dir(props: {
  readonly row: Extract<FileRow, { kind: "dir" }>
  readonly view: TreeView
}) {
  const folded = createMemo(() => props.view.collapsed().has(props.row.path))

  return (
    <li
      class="mb-0.5"
      data-testid={TESTID.fileDir}
      data-path={props.row.path}
      data-collapsed={String(folded())}
    >
      <button
        type="button"
        class={DIR}
        data-testid={TESTID.fileDirToggle}
        aria-expanded={!folded()}
        aria-label={folded() ? `expand ${props.row.name}` : `collapse ${props.row.name}`}
        onClick={(event) => {
          event.stopPropagation()
          props.view.toggle(props.row.path)
        }}
      >
        <span
          class={`${CONTROL} text-[0.55rem] leading-none text-muted`}
          aria-hidden="true"
        >
          <span
            class="inline-block transition-transform duration-100"
            classList={{ "-rotate-90": folded() }}
          >
            ▼
          </span>
        </span>
        <span class="break-all">{props.row.name}</span>
      </button>
      <Show when={!folded()}>
        <ul class="m-0 ml-2 list-none border-l border-rule/70 p-0 pl-2">
          <Key each={props.row.children} by="key">
            {(child) => <Entry row={child()} view={props.view} />}
          </Key>
        </ul>
      </Show>
    </li>
  )
}

function File(props: {
  readonly row: Extract<FileRow, { kind: "file" }>
  readonly view: TreeView
}) {
  const outline = props.row.of === "outline"

  return (
    <li class="mb-1">
      <Link
        route={
          outline
            ? { kind: "outline", file: props.row.file }
            : { kind: "document", file: props.row.file }
        }
        class={ENTRY}
        testid={outline ? TESTID.outlineLink : TESTID.documentLink}
        current={props.view.isActive(props.row.file)}
        broken={outline && props.view.broken.has(props.row.file)}
      >
        {props.row.name}
        <Show when={outline && props.view.broken.has(props.row.file)}>
          <span class="ml-1 text-alarm" title="this file could not be read">
            ⚠
          </span>
        </Show>
      </Link>
    </li>
  )
}
