/**
 * The ways around the DIRECTORY: the month, and the directory as a TREE.
 *
 * One walk of the served directory mixes every `.jsonl` outline and every
 * `.md` document under the folders they live in — a folder shows everything
 * it holds, the way a reader of the same directory sees it, and the way the
 * racket original's sidebar did.
 *
 * What is NOT here is the app's own chrome. The wordmark, the connection, the
 * agent toggle and the theme live in the header (`./AppHeader.tsx`) — they are
 * about the APP rather than about the directory, and a pill fixed to a corner
 * of the viewport was a pill on top of whatever was being read. The principle,
 * for the next reader: the header carries what is about the app; this column
 * carries what is about the directory.
 *
 * Directory nodes collapse, and that collapse is client-local the way the
 * outline tree's folds are (./view.ts): nothing is written, two readers of
 * the same directory may fold it differently, and a fold survives navigation
 * because the tree is of the directory rather than of the open page. Folders
 * start collapsed — a deep corpus is not a wall of paths — and a directory
 * the reader has unfolded stays open until they fold it again. The chain of
 * folders holding the open file is always drawn open so the selection is
 * never hidden under a shut parent. A SLOT rather than the calendar's own
 * inputs threaded through: what the month needs is the month's business.
 *
 * The entry that lights up is the file the OPEN PAGE lives in — for a zoomed
 * node, the file of the canonical record, which is not something the URL says
 * (see ./page.ts). A day page lights none: a day crosses every outline, and
 * the calendar is where it says which day it is. An entry is marked when its
 * file could not be read: the rest of the directory is still live, and which
 * one is broken is something a reader should be able to see without opening
 * it.
 *
 * Below 48rem this is a sheet behind the header's burger rather than a column:
 * shut it is not drawn, open it is capped so the outline under it still shows.
 * The open state is owned by the layout (`App.tsx`) because the burger that
 * toggles it lives in the header, not here.
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

import { ancestorDirs, type FileRow, fileTree } from "./fileTree.ts"
import { Link } from "./router.tsx"
import { TESTID } from "./testids.ts"
import { CONTROL, TARGET } from "./touch.ts"

/** One file entry. A row a finger aims at (./touch.ts), back to a line of
 *  text where the pointer is a mouse — and one string, because an outline and
 *  a document are the same row for the same reason: a finger aims at both.
 *  `calendar/Day.tsx` spells its cell once for the same reason.
 *
 *  Workflowy-quiet: soft hover, soft current (rule wash rather than a solid
 *  accent block), and body-weight type so the tree reads as navigation rather
 *  than a second outline. */
const ENTRY =
  `flex ${TARGET} items-center break-all rounded-sm px-2 py-0.5 text-[0.8125rem] leading-snug ` +
  "no-underline text-ink hover:bg-rule/60 aria-[current=page]:bg-rule " +
  "aria-[current=page]:text-ink md:min-h-0"

/** A directory row: the same height a finger aims at, but not a link — it
 *  folds, it does not navigate. Disclosure triangle + name, Workflowy-style. */
const DIR =
  `flex ${TARGET} items-center gap-0.5 rounded-sm px-1 py-0.5 text-[0.8125rem] ` +
  "leading-snug text-muted hover:bg-rule/60 hover:text-ink md:min-h-0"

/** What every row of the tree needs from the sidebar: which file is open,
 *  which outlines are broken, and how folders fold. One bag so a recursive
 *  row is not a function of five separate props that always travel together. */
interface TreeView {
  readonly isActive: (file: string) => boolean
  readonly broken: ReadonlyMap<string, BrokenFile>
  /** Directories the reader has unfolded. Absent = collapsed (the default). */
  readonly expanded: () => ReadonlySet<string>
  /** Directory chain of the open file — always drawn open so the selection
   *  is reachable. Does not write into `expanded`; a preference the reader
   *  set earlier still sits there for when the selection moves away. */
  readonly openAncestry: () => ReadonlySet<string>
  readonly toggle: (path: string) => void
}

export function Sidebar(props: {
  readonly files: ReadonlyArray<string>
  /** The documents' paths. A tree of a directory is a tree of PATHS, which is
   *  all a `.md` contributes to it — and all this tab has of one until someone
   *  opens it (./outlines.ts). */
  readonly documents: ReadonlyArray<string>
  /** The file the open page is of, in whichever kind of file it is. */
  readonly active: string | undefined
  readonly broken: ReadonlyMap<string, BrokenFile>
  /** What sits above the tree: the month. */
  readonly children?: JSX.Element
  /** Whether the phone sheet is open. Above 48rem the column is always drawn
   *  and this is ignored. Owned by the layout because the burger lives in the
   *  header (`AppHeader.tsx`). */
  readonly open: boolean
  /** Shut the phone sheet. Every control in here either goes somewhere or
   *  opens something over it, so a tap inside asks to put the sheet away. */
  readonly onClose: () => void
}) {
  // Unfolded directories, keyed by their root-relative path. A Set rather than
  // a boolean per node so a directory that is not in it is simply collapsed —
  // the default a deep corpus wants, and the same shape the outline tree uses
  // for folds (./view.ts), only inverted: there the set holds what is shut
  // because nodes start open; here it holds what is open because folders
  // start shut. A toggle survives navigation because the tree is of the
  // directory rather than of the open page.
  const [expanded, setExpanded] = createSignal(new Set<string>())
  const toggle = (path: string) => {
    setExpanded((current) => {
      const next = new Set(current)
      if (!next.delete(path)) next.add(path)
      return next
    })
  }

  // The open file's parent chain, as a set for O(1) membership in each Dir.
  // Memoised on the active path alone: folding a folder must not rewalk it.
  const openAncestry = createMemo(() => {
    const file = props.active
    return file === undefined ? new Set<string>() : new Set(ancestorDirs(file))
  })

  // `createSelector` rather than `props.active === file` in each row, which is
  // what this was: that form subscribes EVERY entry to the open page, so
  // walking from one outline to another re-runs one effect per file in the
  // directory to change two attributes. This notifies exactly the entry that
  // lit and the one that went out — the pattern theme/Picker.tsx already
  // established over fifteen chips, and this list is the one that grows
  // without limit: it is the served directory.
  //
  // Solid utilization (PR #72) established this pattern and named this item
  // as the reason the O(n) form would hurt once the tree landed on the
  // ported Dropbox corpus.
  const isActive = createSelector(() => props.active)

  // One tree, rebuilt only when the directory's paths move — not when a page
  // changes or a folder folds. Document *text* is not an input, and now cannot
  // be: what arrives here is the documents' key set, so a rewrite of a body is
  // not something this memo can even see. (The outline collection keeps
  // `order` by reference on a values-only tick, which is the same property on
  // the other list.)
  //
  // The walk mints fresh row objects each time; `<Key by="key">` holds each
  // place across that mint the way Tree.tsx holds outline rows — without it
  // `<For>` would compare by reference and rebuild the whole sidebar DOM on
  // one membership change, which is O(corpus) on the Dropbox-sized tree this
  // item targets.
  const tree = createMemo(() => fileTree(props.files, props.documents))

  // Getters, not a snapshot: the bag is built once, and a row that reads
  // `view.broken` must still track the prop that moves when a file fails to
  // parse. A plain object closed over `props.broken` at construction would
  // freeze the map the first frame handed it.
  const view: TreeView = {
    isActive,
    get broken() {
      return props.broken
    },
    expanded,
    openAncestry,
    toggle,
  }

  return (
    // Below 48rem there is no second column to be, so this is a SHEET behind
    // the header's burger — capped and scrolling so the outline under it is
    // still on screen. Shut, the body is `hidden` and the nav carries no
    // border or overflow of its own (a bare `border-b` around a zero-height
    // body used to leave a ghost 1px rule under the header). Above 48rem none
    // of that applies: there is a column and the burger is not drawn.
    //
    // The e2e "has the set loaded?" probe keys on the header's
    // `data-layout="docked"`, not on this nav's box — so a shut phone sheet
    // does not have to fake a 1px layout box to settle.
    <nav
      class={
        props.open
          ? "overflow-y-auto border-b border-rule md:max-h-none md:border-b-0 md:border-r md:p-4"
          : "md:overflow-y-auto md:border-r md:p-4"
      }
      data-testid={TESTID.sidebar}
    >
      <div
        class={`${props.open ? "max-h-[42dvh] overflow-y-auto p-4" : "hidden"} md:block md:max-h-none md:overflow-visible md:p-0`}
        data-testid={TESTID.sidebarBody}
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
  )
}

/** One row of the file tree. Kind decides what is drawn — a folder folds, a
 *  file is a link — the same Switch shape Tree.tsx uses for outline rows, so
 *  a third kind of sidebar row is another Match rather than another branch
 *  through a Show-with-cast. */
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
  // A memo, not a plain accessor: folding one directory mints a new Set, and
  // both the chevron and the children list read it. Without the memo every
  // directory re-runs both on every click. Ancestry wins over the default
  // (collapsed) so the open file is never buried; a reader preference in
  // `expanded` still wins over the default for every other folder.
  const folded = createMemo(
    () =>
      !props.view.openAncestry().has(props.row.path) &&
      !props.view.expanded().has(props.row.path),
  )

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
        // A fold is not a navigation: keep the sheet open so the reader can
        // fold several folders without reopening it each time. The file links
        // still shut it via the body's onClick.
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
  // Kind is fixed for the life of the row; broken and current are not —
  // they are read in the JSX so a later frame that marks this file, or a
  // walk that lights a different one, updates this row only.
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
