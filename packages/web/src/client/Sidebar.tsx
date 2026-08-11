/**
 * The ways around the set: the month, and the directory as a TREE.
 *
 * One walk of the served directory mixes every `.jsonl` outline and every
 * `.md` document under the folders they live in — a folder shows everything
 * it holds, the way a reader of the same directory sees it, and the way the
 * racket original's sidebar did. The two flat sections that used to sit here
 * (outlines above, documents below, nested paths as wrapped strings) are what
 * this replaces; the pure shape of the tree is `./fileTree.ts`.
 *
 * Above the tree is the month of the whole set's dated nodes, and below it is
 * where the app's own chrome lives — the connection dot and the agent toggle
 * — because those two are about the APP rather than about the page, and a
 * pill fixed to the corner of the viewport is a pill on top of whatever is
 * being read. Last of all is the theme picker, which is about neither: it is
 * what this BROWSER looks like, and it is the one thing in the column that is
 * drawn here rather than handed in, because it needs nothing from the app to
 * draw itself.
 *
 * Directory nodes collapse, and that collapse is client-local the way the
 * outline tree's folds are (./view.ts): nothing is written, two readers of
 * the same directory may fold it differently, and a fold survives navigation
 * because the tree is of the directory rather than of the open page. A SLOT
 * rather than the calendar's own inputs threaded through: what the month
 * needs is the month's business.
 *
 * The entry that lights up is the file the OPEN PAGE lives in — for a zoomed
 * node, the file of the canonical record, which is not something the URL says
 * (see ./page.ts). A day page lights none: a day crosses every outline, and
 * the calendar is where it says which day it is. An entry is marked when its
 * file could not be read: the rest of the directory is still live, and which
 * one is broken is something a reader should be able to see without opening
 * it.
 */

import type { BrokenFile, Document } from "@olai/format"
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
import { Link } from "./router.tsx"
import { TESTID } from "./testids.ts"
import { ThemePicker } from "./theme/Picker.tsx"
import { CONTROL, TARGET, TARGET_BOX } from "./touch.ts"

/** One file entry. A row a finger aims at (./touch.ts), back to a line of
 *  text where the pointer is a mouse — and one string, because an outline and
 *  a document are the same row for the same reason: a finger aims at both.
 *  `calendar/Day.tsx` spells its cell once for the same reason. */
const ENTRY =
  `flex ${TARGET} items-center break-all rounded px-2 py-1 text-sm ` +
  "no-underline text-inherit hover:bg-rule aria-[current=page]:bg-accent " +
  "aria-[current=page]:text-paper md:block md:min-h-0"

/** A directory row: the same height a finger aims at, but not a link — it
 *  folds, it does not navigate. */
const DIR =
  `flex ${TARGET} items-center gap-0.5 rounded px-1 text-sm text-muted ` +
  "hover:bg-rule hover:text-ink md:min-h-0"

/** What every row of the tree needs from the sidebar: which file is open,
 *  which outlines are broken, and how folders fold. One bag so a recursive
 *  row is not a function of five separate props that always travel together. */
interface TreeView {
  readonly isActive: (file: string) => boolean
  readonly broken: ReadonlyMap<string, BrokenFile>
  readonly collapsed: () => ReadonlySet<string>
  readonly toggle: (path: string) => void
}

export function Sidebar(props: {
  readonly files: ReadonlyArray<string>
  readonly documents: ReadonlyArray<Document>
  /** The file the open page is of, in whichever kind of file it is. */
  readonly active: string | undefined
  readonly broken: ReadonlyMap<string, BrokenFile>
  /** What sits above the tree: the month. */
  readonly children?: JSX.Element
  /** What sits BELOW the tree: the chrome that belongs to the app rather than
   *  to the page — is the server still there, and open the agent. A slot for
   *  the same reason the month is one, and because these two have a second
   *  home: the screens with no sidebar draw them in a corner instead (see
   *  `App.tsx`). */
  readonly footer?: JSX.Element
}) {
  const [open, setOpen] = createSignal(false)

  // Folded directories, keyed by their root-relative path. A Set rather than a
  // boolean per node so a directory that is not in it is simply expanded —
  // the default a reader of a new directory expects, and the one that keeps
  // every nested file a click away without a prior unfold.
  const [collapsed, setCollapsed] = createSignal(new Set<string>())
  const toggle = (path: string) => {
    setCollapsed((current) => {
      const next = new Set(current)
      if (!next.delete(path)) next.add(path)
      return next
    })
  }

  // `createSelector` rather than `props.active === file` in each row, which is
  // what this was: that form subscribes EVERY entry to the open page, so
  // walking from one outline to another re-runs one effect per file in the
  // directory to change two attributes. This notifies exactly the entry that
  // lit and the one that went out — the pattern theme/Picker.tsx already
  // established over fifteen chips, and this list is the one that grows
  // without limit: it is the served directory. One selector for both kinds of
  // file, because an outline and a document cannot both be the open page:
  // what is active is a FILE, and which kind it is is a fact about the
  // directory rather than about the reading.
  //
  // Solid utilization (PR #72) established this pattern and named this item
  // as the reason the O(n) form would hurt once the tree landed on the
  // ported Dropbox corpus.
  const isActive = createSelector(() => props.active)

  // One tree, rebuilt only when the directory's paths move — not when a page
  // changes or a folder folds. Document *text* is not an input: the tree is
  // of paths, and a rewrite of a document's body is not a reshape of the
  // directory. (manifest's equals gates on file+text and patches text in
  // place; the outline collection keeps `order` by reference on a values-only
  // tick — so this memo stays quiet when a body moves and only re-runs when a
  // path arrives or leaves.)
  //
  // The walk mints fresh row objects each time; `<Key by="key">` holds each
  // place across that mint the way Tree.tsx holds outline rows — without it
  // `<For>` would compare by reference and rebuild the whole sidebar DOM on
  // one membership change, which is O(corpus) on the Dropbox-sized tree this
  // item targets.
  const tree = createMemo(() =>
    fileTree(
      props.files,
      props.documents.map((document) => document.file),
    )
  )

  // Getters, not a snapshot: the bag is built once, and a row that reads
  // `view.broken` must still track the prop that moves when a file fails to
  // parse. A plain object closed over `props.broken` at construction would
  // freeze the map the first frame handed it.
  const view: TreeView = {
    isActive,
    get broken() {
      return props.broken
    },
    collapsed,
    toggle,
  }

  return (
    // Below 48rem there is no second column to be, so it is a HEADER above the
    // outline — and behind a BURGER, because everything in it has to fit on a
    // screen 390 points wide and the reader is usually not looking for any of
    // it. A capped, always-open header was the first answer and it was worse
    // in both directions: it took a third of the screen from the outline to
    // show a list nobody had asked for, and the one control that HAS to be
    // reachable — the way into the agent — was somewhere down inside a strip
    // that scrolled. Shut, this is one row and the outline has the rest;
    // open, it is the whole sidebar, chrome and all.
    //
    // Above 48rem none of that applies: there is a column, everything is in
    // it, and the burger is not drawn.
    <nav
      class="overflow-y-auto border-b border-rule p-4 md:max-h-none md:border-b-0 md:border-r"
      data-testid={TESTID.sidebar}
    >
      <div class="flex items-center gap-2">
        <button
          type="button"
          class={`${TARGET_BOX} -ml-2 inline-flex items-center justify-center rounded text-muted hover:text-ink md:hidden`}
          data-testid={TESTID.sidebarToggle}
          data-open={open()}
          aria-expanded={open()}
          aria-label={open() ? "hide the sidebar" : "show the sidebar"}
          onClick={() => setOpen(!open())}
        >
          <span aria-hidden="true" class="text-lg leading-none">☰</span>
        </button>
        <h1 class="m-0 text-base uppercase tracking-widest text-muted">olai</h1>
      </div>

      {/* Everything else. Hidden below 48rem until the burger is pressed, and
          capped when it is so the outline it is a header FOR is still on
          screen under it. Any tap inside SHUTS it: every control in here
          either goes somewhere or opens something over it, and a panel left
          standing on top of what you just asked for is a second tap the
          reader did not ask to make. */}
      <div
        class={`${open() ? "max-h-[42dvh] overflow-y-auto" : "hidden"} mt-4 md:mt-4 md:block md:max-h-none md:overflow-visible`}
        data-testid={TESTID.sidebarBody}
        onClick={() => setOpen(false)}
      >
        {props.children}

        <ul class="m-0 list-none p-0" data-testid={TESTID.outlineList}>
          <Key each={tree()} by="key">
            {(row) => <Entry row={row()} view={view} />}
          </Key>
        </ul>

        <Show when={props.footer}>
          <div class="mt-4 flex flex-wrap items-center gap-2 border-t border-rule pt-4">
            {props.footer}
          </div>
        </Show>

        {/* The last thing in the column, and the only one that is about the
            READER rather than about the directory or the app: which palette
            this browser reads in. Drawn here rather than handed in as a slot
            like the month and the chrome, because it needs nothing from the
            app — no data, and no second home to be placed in.

            The one exception to "any tap in here shuts it": a pick repaints
            the whole page, including this column, so the reader is looking at
            the answer already — and shutting would make comparing two
            palettes on a phone cost a trip through the burger each time. */}
        <div onClick={(event) => event.stopPropagation()}>
          <ThemePicker />
        </div>
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
  // directory re-runs both on every click.
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
        // A fold is not a navigation: keep the burger open so the reader can
        // fold several folders without reopening it each time. The file links
        // still shut it via the body's onClick.
        onClick={(event) => {
          event.stopPropagation()
          props.view.toggle(props.row.path)
        }}
      >
        <span class={`${CONTROL} text-xs`} aria-hidden="true">
          {folded() ? "▸" : "▾"}
        </span>
        <span class="break-all">{props.row.name}</span>
      </button>
      <Show when={!folded()}>
        <ul class="m-0 ml-2 list-none border-l border-rule p-0 pl-2">
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
