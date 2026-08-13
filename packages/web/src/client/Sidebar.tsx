/**
 * The ways around the DIRECTORY: the agenda, the month, and the directory as a
 * TREE.
 *
 * The first two are the journal's two questions and they sit together, above
 * the files: a month is what HAPPENED, read backward a day at a time, and the
 * agenda is the same dates read forward — what is owed. Neither is a thing on
 * disk, which is exactly why they are here rather than in the tree below them.
 *
 * Desktop: a resizable column when open, replaced by the icon rail when
 * minimized (./layout/Rail.tsx). Mobile: a slide-over drawer with scrim under
 * the header — not the old capped close-on-any-tap sheet. App chrome
 * (connection, agent, preferences) lives in the header; this column is only the
 * directory.
 *
 * Directory nodes collapse client-locally like the outline tree's folds
 * (./view.ts): nothing is written, two readers of the same directory may fold
 * it differently, and a fold survives navigation because the tree is of the
 * directory rather than of the open page. Folders start collapsed — a deep
 * corpus is not a wall of paths — and a directory the reader has unfolded
 * stays open until they fold it again. The chain of folders holding the open
 * file is always drawn open so the selection is never hidden under a shut
 * parent (#105).
 *
 * The entry that lights up is the file the open page lives in. A day page
 * lights none. An entry is marked when its file could not be read.
 *
 * ## It is the GROUND, and the rows are what sits on it
 *
 * Since the depth pass this column has no fill and no border of its own on a
 * desktop: it IS the canvas (`./surface.ts`), and everything in it is told by
 * altitude instead. The month is a WELL sunk into it; a tree row is flush with
 * it and LIFTS a pixel under the pointer; the row in force is a raised card
 * wearing the accent spine. The one thing the column still paints is the phone
 * DRAWER, which is the same box floating over the page and therefore needs both
 * an opaque ground and a shadow.
 *
 * ## It is PINNED, for the reason the header is
 *
 * This app scrolls the DOCUMENT, so a column in normal flow is as tall as the
 * page and leaves the screen with it: past the fold the reader had a bare rule
 * down the left and no way back to the directory but scrolling up. Since the
 * header started sticking (#115) that was the last piece of chrome still going
 * — visible in that PR's own evidence as an empty directory column — and the
 * human's answer to the bug it was filed as was: pin it.
 *
 * So on desktop this is `sticky` at `top: var(--height-header)` and exactly
 * `100dvh` minus that tall — the height is what makes the pin mean something,
 * because a sticky box taller than the strip it is pinned in scrolls its own
 * bottom off the screen and pins nothing. The body below the handle already
 * had `min-h-0 flex-1 overflow-y-auto`, so a directory taller than the strip
 * now scrolls WITHIN the column instead of lengthening the page: one scroll
 * region per thing that scrolls, and the page's own scrollbar goes on being
 * the page's.
 *
 * `sticky` and not `fixed`, for the same two reasons the bar gives: the column
 * keeps its own grid track (`App.tsx`'s `--width-sidebar`), so nothing has to
 * pad for it and the resize handle goes on meaning what it says; and no
 * ancestor may take an `overflow` other than `visible` or this silently stops
 * sticking. `100dvh` and not the chat dock's `--visible-h`: that reading is the
 * VISUAL viewport, which is right for a `fixed` box on a phone with a keyboard
 * up and wrong here, where the sticky threshold is a layout-viewport
 * coordinate and the two would disagree by however tall the keyboard is.
 *
 * The mobile drawer is untouched — still `fixed` from the header's seam to the
 * bottom of the screen, still scrim, still close-on-navigate. And #105 is
 * untouched: folders start collapsed, ⌘\ still toggles the column (`keys.ts`),
 * and the collapse affordance is where it was — bottom-right of the column,
 * which is now the bottom-right of the STRIP and therefore on screen at every
 * scroll position rather than parked at the foot of the page.
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
import { SidebarHandle } from "./layout/Handle.tsx"
import { setSidebarOpen } from "./layout/prefs.ts"
import { Link, useRouter } from "./router.tsx"
import { CARD, LIFT, LIFTS, OVER, SPINE } from "./surface.ts"
import { TESTID } from "./testids.ts"
import { CONTROL, TARGET, TARGET_BOX } from "./touch.ts"

/** One file entry's own geometry and type, in every state.
 *
 *  `truncate` rather than `break-all`: a long filename ellipsises with the
 *  full name on `title`, instead of wrapping mid-character (`stamp-reverts.m`
 *  / `d`). `min-w-0 w-full` is what lets a flex row actually shrink to the
 *  column — without them `truncate` is a no-op and the wrap comes back. */
const ENTRY =
  `flex min-w-0 w-full ${TARGET} items-center rounded-lg px-2 py-0.5 text-[0.8125rem] ` +
  "leading-snug no-underline text-ink md:min-h-0"

/**
 * …and WHICH ALTITUDE it is at, which is the whole of what the depth pass
 * changed here.
 *
 * At rest a row is part of the ground: ink on the canvas, no fill of its own,
 * because a directory of forty files drawn as forty cards is a column of cards
 * and not a directory. Under the pointer it LIFTS off the desk, which is this
 * app's one way of saying a thing can be pressed (`./surface.ts`).
 *
 * The row IN FORCE is already up, so it does not lift — the same argument a day
 * being read makes about its own hover (`./calendar/Day.tsx`) — and it wears the
 * accent SPINE, one of the two lines the pass kept on purpose.
 *
 * The two answers are BUILT ONCE, at module scope, rather than composed per row:
 * there are exactly two of them, a directory is forty rows, and this is read
 * again every time the selection moves.
 */
const AT_REST = `${ENTRY} ${LIFTS}`
const IN_FORCE = `${ENTRY} ${SPINE} font-semibold`

const entryLook = (current: boolean): string => (current ? IN_FORCE : AT_REST)

/** A directory row: folds, does not navigate. Lifts like a file entry — it is
 *  as pressable as one — and never lights, because a folder is not a page. */
const DIR =
  `flex min-w-0 w-full ${TARGET} items-center gap-0.5 rounded-lg px-1 py-0.5 text-[0.8125rem] ` +
  `leading-snug text-muted ${LIFTS} hover:text-ink md:min-h-0`

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
  // Unfolded directories, keyed by their root-relative path. A Set rather than
  // a boolean per node so a directory that is not in it is simply collapsed —
  // the default a deep corpus wants, and the same shape the outline tree uses
  // for folds (./view.ts), only inverted: there the set holds what is shut
  // because nodes start open; here it holds what is open because folders
  // start shut (#105).
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

  // `createSelector` rather than `props.active === file` in each row: that
  // form subscribes every entry to the open page. This notifies exactly the
  // entry that lit and the one that went out.
  const isActive = createSelector(() => props.active)
  const tree = createMemo(() => fileTree(props.files, props.documents))

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
    <>
      {/* Mobile scrim: under the header so app chrome stays tappable (#101). */}
      <Show when={props.open}>
        <button
          type="button"
          class="fixed inset-x-0 bottom-0 top-[var(--height-header,3rem)] z-30 bg-ink/40 md:hidden"
          data-testid={TESTID.sidebarScrim}
          aria-label="close the directory"
          onClick={() => props.onClose()}
        />
      </Show>

      <nav
        class={
          // Mobile closed: `hidden` (off-screen translate still counts as
          // visible to Playwright). Mobile open: FIXED under the header —
          // never also `relative` (that utility wins the cascade and demotes
          // the drawer into flow offsets). Desktop: a STICKY column, pinned
          // under the header (see the note above).
          (props.open ? "flex " : "hidden ") +
          // No border and no paper: this column IS the ground, and the
          // furniture in it (the month, the tree rows) is what sinks into or
          // rises off it (./surface.ts). The `bg-canvas` earns its place on the
          // PHONE, where the same box is a drawer over the page and has to be
          // opaque — and the shadow with it, because a drawer floating over the
          // page is the one time this column is above something.
          `z-40 flex-col ${OVER} md:shadow-none ` +
          // Wide enough that the month's 7 day cells still hit 44×44 — this
          // width MINUS the body's `p-4` is the grid they divide, so anything
          // that pads a box between the two spends that budget. The month's own
          // well is `md:px-2` for exactly this reason (`./calendar/Calendar.tsx`),
          // and a phone scenario measures it (`packages/tests`, on_a_phone).
          "fixed bottom-0 left-0 top-[var(--height-header,3rem)] w-[min(22rem,92vw)] " +
          // `top-` above is BOTH positions' offset — the drawer's inset and
          // this column's sticky threshold are the same seam, so they read the
          // same token. `bottom`/`left` are the drawer's alone and must not
          // survive here: an inset on a sticky box is a constraint against the
          // scrollport, not a place to sit.
          "md:sticky md:bottom-auto md:left-auto md:flex " +
          "md:h-[calc(100dvh-var(--height-header,3rem))] md:w-full md:translate-x-0"
        }
        data-testid={TESTID.sidebar}
        data-open={props.open ? "true" : "false"}
      >
        {/* Desktop: collapse sits at the bottom of the column so it cannot
            cover the calendar's month-step chevrons (top-right of the body). */}
        <button
          type="button"
          class={`absolute bottom-2 right-2 z-10 hidden ${TARGET_BOX} items-center justify-center rounded-lg ${CARD} ${LIFT} text-muted hover:text-ink md:inline-flex md:min-h-8 md:min-w-8`}
          data-testid={TESTID.sidebarCollapse}
          aria-label="collapse the sidebar to the icon rail"
          title="collapse sidebar"
          onClick={() => setSidebarOpen(false)}
        >
          <svg viewBox="0 0 16 16" class="size-4" aria-hidden="true" fill="currentColor">
            <path d="M9.78 3.22a.75.75 0 0 1 0 1.06L6.56 8l3.22 3.72a.75.75 0 1 1-1.06 1.06l-4-4a.75.75 0 0 1 0-1.06l4-4a.75.75 0 0 1 1.06 0z" />
          </svg>
        </button>
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
          <Agenda />
          {props.children}

          <ul class="m-0 min-w-0 list-none p-0" data-testid={TESTID.outlineList}>
            <Key each={tree()} by="key">
              {(row) => <Entry row={row()} view={view} />}
            </Key>
          </ul>
        </div>
      </nav>
    </>
  )
}

/** The way to what is owed, above the month.
 *
 *  Whether it is the page being read is asked of the ROUTE rather than passed
 *  down beside the open file: the agenda belongs to no outline — it crosses all
 *  of them — so `active` has nothing to say about it, and the router is already
 *  what every link in this column goes through. */
function Agenda() {
  const router = useRouter()

  return (
    <Link
      route={{ kind: "agenda" }}
      class={`${entryLook(router.route().kind === "agenda")} mb-2`}
      testid={TESTID.agendaLink}
      current={router.route().kind === "agenda"}
    >
      Agenda
    </Link>
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
  // Ancestry wins over the default (collapsed) so the open file is never
  // buried; a reader preference in `expanded` still wins over the default for
  // every other folder (#105).
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
        <span class="min-w-0 truncate" title={props.row.name}>
          {props.row.name}
        </span>
      </button>
      {/* No guide line down the children: the indent already says whose they
          are, and a hairline that repeats it is exactly the kind the depth pass
          removed. (The OUTLINE's own indent keeps its guide — nesting there can
          run deep enough that the indent alone stops being readable.) */}
      <Show when={!folded()}>
        <ul class="m-0 ml-2 min-w-0 list-none p-0 pl-2">
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
    <li class="mb-1 min-w-0">
      <Link
        route={
          outline
            ? { kind: "outline", file: props.row.file }
            : { kind: "document", file: props.row.file }
        }
        class={entryLook(props.view.isActive(props.row.file))}
        title={props.row.name}
        testid={outline ? TESTID.outlineLink : TESTID.documentLink}
        current={props.view.isActive(props.row.file)}
        broken={outline && props.view.broken.has(props.row.file)}
      >
        <span class="min-w-0 flex-1 truncate">{props.row.name}</span>
        <Show when={outline && props.view.broken.has(props.row.file)}>
          <span class="ml-1 text-alarm" title="this file could not be read">
            ⚠
          </span>
        </Show>
      </Link>
    </li>
  )
}
