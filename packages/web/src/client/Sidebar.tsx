/**
 * The ways around the DIRECTORY: the agenda, the month, and the directory as a
 * TREE.
 *
 * The first two are the journal's two questions and they sit together, above
 * the files: a month is what HAPPENED, read backward a day at a time, and the
 * agenda is the same dates read forward — what is owed. Neither is a thing on
 * disk, which is exactly why they are here rather than in the tree below them.
 *
 * BELOW BOTH, and directly above the files, sits the reader's own short list —
 * the pinned shelf (./pins/Shelf.tsx). It is neither of the journal's questions
 * and not a thing on disk that this column walks: it is a handful of doors
 * somebody kept. It went above the agenda first and was moved here (human,
 * 2026-08-19), and the order is the argument: the journal's two questions are
 * what the directory has to SAY, and a shelf in front of them puts a reader's
 * own bookmarks ahead of the news. Beside the tree it is what it actually is —
 * a shortcut INTO the files, a hand's width from the list it shortcuts. It
 * draws nothing when there are no pins, so a directory that has never used one
 * has the column it always had.
 *
 * Desktop: a resizable column when open, replaced by the icon rail when
 * minimized (./layout/Rail.tsx). Mobile: a slide-over drawer with scrim under
 * the header — not the old capped close-on-any-tap sheet. The column is the
 * directory. App chrome that sits at the foot of the phone drawer (preferences)
 * arrives as {@link Sidebar.foot} so this module does not import it.
 *
 * Directory nodes fold client-locally like the outline tree's folds, and are
 * REMEMBERED the same way (./fold/folders.ts): nothing is written to the
 * directory, two readers of it may fold it differently, and a folder left open
 * is still open after a reload — which is the same 2026-08-13 ruling that made
 * a node's fold a preference rather than a page's. Folders start collapsed — a
 * deep corpus is not a wall of paths — and a directory the reader has unfolded
 * stays open until they fold it again. The chain of folders holding the open
 * file is always drawn open so the selection is never hidden under a shut
 * parent (#105).
 *
 * The entry that lights up is the file the open page lives in. A day page
 * lights none. An entry is marked when its file could not be read.
 *
 * ## What the tree does NOT draw, and the two doors under it
 *
 * The outlines olai NAMED FOR ITSELF — everything under `_olai/` — are left
 * out of the tree, because every one of them already has a door in this very
 * column and a second row for it is noise on top of a reader's own files
 * (human, 2026-08-20, off #282's shots). A **Prefs** switch draws them again
 * for somebody who wants to open `Pins.olai` as an outline; it is browser-
 * local and off by default, and the rule it moves is a DRAWING rule and
 * nothing more — search, the agents, `list_outlines`, the trash page and the
 * shelf read the same set either way (./settings/hiddenOutlines.ts).
 *
 * So the foot of this column is where those files get their names back:
 * **Inbox** and **Trash**, in that order — what comes IN, then what was thrown
 * out. The trash is a page rather than a file you edit and is left out of the
 * tree whichever way the switch is set; the inbox is an ordinary outline, so
 * its entry lights up like a tree row, wears the same ⚠ when its file will not
 * parse, and is drawn only when the directory actually has one.
 *
 * ONE EXCEPTION to the hiding, and it is the reason the rule takes the broken
 * map: an outline that could not be READ keeps its row whichever way the
 * switch is set, because the ⚠ on it is the only word this app says about a
 * file it could not parse without somebody opening the page to find out.
 *
 * Every row says what KIND it is in a glyph before its name (./file/icons.tsx)
 * — an olai outline, a document, a folder. Three kinds drawn in one ink was a
 * bug filed from a screenshot: the only thing separating an outline from a
 * document was four characters of extension, and the only thing marking a
 * folder was a triangle every fold control in the app has. The glyph takes the
 * row's own ink rather than a colour per kind, which is what keeps this
 * Workflowy-quiet and not a file manager. A folder is not muted against a
 * file: the glyph already says which is which, and two inks in one column
 * was two lists. The name is the stem; the suffix is the glyph's.
 *
 * The AGENDA entry says one more thing, and it is the only news this column
 * carries: work that has slipped puts it in the app's alarm (a filled chip
 * counting what is late, on a washed and weighted row), work due today gives it
 * the same chip in the quiet face a date badge wears when it is not late, and
 * an agenda with neither is the entry it always was. What that mark is drawn
 * from is `./agenda/owed.ts`; what it is drawn FOR arrives as a prop, because
 * the number beside the word has to be the page's own answer and not a second
 * walk over the same directory.
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

import { type BrokenFile, inboxIn, isTrashed } from "@olai/format"
import { Key } from "@solid-primitives/keyed"
import {
  createMemo,
  createSelector,
  type JSX,
  Match,
  Show,
  Switch,
} from "solid-js"

import type { Owed } from "@olai/surface"

import { markOf, unchanged } from "./agenda/owed.ts"
import { NewDocument } from "./document/NewDocument.tsx"
import { NewOutline } from "./outline/NewOutline.tsx"
import { ROW_TESTID } from "./file/kinds.ts"
import { useServed } from "./served.tsx"
import { Glyph } from "./file/icons.tsx"
import { ancestorDirs, dirsIn, type FileRow, fileTree } from "./fileTree.ts"
import { openFolders, toggleFolder } from "./fold/folders.ts"
import { LAYER, WITHIN } from "./layer.ts"
import { ENTRY_SHAPE, REGION, ROW_GAP } from "./layout/entry.ts"
import { SidebarHandle } from "./layout/Handle.tsx"
import { setSidebarOpen } from "./layout/prefs.ts"
import { drawnInTree } from "./settings/hiddenOutlines.ts"
import { Shelf } from "./pins/Shelf.tsx"
import { Link, useRouter } from "./router.tsx"
import { TESTID } from "./testids.ts"
import { CONTROL, TARGET_BOX } from "./touch.ts"
import { atFile } from "./routes.ts"

/** One file entry. Workflowy-quiet: soft hover, a wash when current.
 *
 *  The gap is HERE and not in the shape above, because it is the tree's rows
 *  that have more than one thing on them. The agenda's entry is the same
 *  SHAPE and not this, so nothing about that row moves; `Trash` borrows this
 *  one and has a single child, where a gap is inert. */
const ENTRY = `${ENTRY_SHAPE} ${ROW_GAP}`

/** A DOOR at the foot of the column: Inbox, then Trash. Neither is a row of
 *  the tree above them — each opens a file that tree does not draw — and the
 *  quiet ink is what says so, since a door drawn in the list's own ink would
 *  read as one more file. Spelled once because there are two of them now, and
 *  `_olai/` is where "whatever comes next" goes (docs/format.md). */
const DOOR = `${ENTRY} text-paper/65`

/** A directory row: folds, does not navigate. Same SHAPE and ink as a file —
 *  the padding, the gap, the type — because a muted folder in a column of
 *  files was two lists. Current-page wash is a file's, and a button does not
 *  carry it. */
const DIR = `${ENTRY_SHAPE} ${ROW_GAP}`

interface TreeView {
  readonly isActive: (file: string) => boolean
  readonly broken: ReadonlyMap<string, BrokenFile>
  /** Directories the reader has unfolded, and this browser remembers. Absent =
   *  collapsed (the default). */
  readonly expanded: () => ReadonlySet<string>
  /** Directory chain of the open file — always drawn open so the selection
   *  is reachable. Does not write into `expanded`; a preference the reader
   *  set earlier still sits there for when the selection moves away. */
  readonly openAncestry: () => ReadonlySet<string>
  readonly toggle: (path: string) => void
}

export function Sidebar(props: {
  readonly active: string | undefined
  readonly broken: ReadonlyMap<string, BrokenFile>
  /** What is owed as of today, counted where the set is (./dates.ts's `owed`
   *  stream) — the app's ONE subscription to it, so the column and the rail it
   *  collapses into cannot say different numbers. `undefined` only while the
   *  first frame is still arriving, and then the entry claims nothing. */
  readonly owed: Owed | undefined
  readonly children?: JSX.Element
  /**
   * Phone drawer footer. App chrome that is not the directory — preferences —
   * is composed here by the caller so this column does not import it.
   * Always mounted on a phone even while the drawer is `hidden`, so opening
   * it and putting the drawer away does not unmount the panel.
   */
  readonly foot?: JSX.Element
  /**
   * Mobile drawer open. Desktop always draws the column when this component
   * is mounted (the parent swaps in the rail when minimized).
   */
  readonly open: boolean
  /** Shut the mobile drawer (navigation, scrim). */
  readonly onClose: () => void
}) {
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
  // The archives are not in the tree: an `_olai/Trash.olai` is not an outline a
  // reader opens and edits, and the Trash entry below the tree is its one
  // door. Filtered here rather than upstream because every other reader of
  // `files` — the page model, the trash itself — wants the whole list.
  // THE PATHS, out of the context that holds them under a MEMBERSHIP equality
  // (`./served.tsx`) — not off the faces, and that is the difference between a
  // tree rebuilt when a file arrives and one rebuilt on every keystroke
  // anywhere in the directory. A face changes when its file's content does;
  // this tree is a function of the NAMES.
  const served = useServed()
  // ...and the SECOND rule the tree draws by, which is a preference rather
  // than a ruling: the outlines olai named for itself are left out unless this
  // browser asked for them (./settings/hiddenOutlines.ts). Each of them has a
  // door of its own in this very column, so the rows were a second way in
  // stacked on top of a reader's own files. It is handed the BROKEN map for
  // the exception that rule keeps — a file nobody could read keeps its row,
  // because the ⚠ on it is the only place this column says so.
  const tree = createMemo(() =>
    fileTree(
      drawnInTree(served().filter((file) => !isTrashed(file)), props.broken),
    ),
  )

  // WHICH FILE THE INBOX IS, read off the same resolver the server captures
  // through (`@olai/format`'s `inboxIn`) — never a path this column composes,
  // or a directory keeping `notes/inbox.olai` would be offered a door onto a
  // file that does not exist. `undefined` is a directory that has never
  // captured, and then there is no entry: minting one is the capture's job.
  //
  // The whole served list rather than the outlines alone: the walk matches a
  // full basename, so nothing but an outline can answer it.
  //
  // AND IT IS READ HERE rather than published, which is the line the shelf
  // sits on the other side of: a browser holds no view of the DIRECTORY's
  // records any more (docs/brainstorming/vault-in-browser.md), so resolving a
  // shelf — every pin's live title — is the server's. This is a reading of the
  // PATHS, and a browser holds every one of those already: it is the same list
  // the tree above is built from, and one more pass over it is not a vault
  // walk.
  const inbox = createMemo(() => inboxIn(served()))

  // Folding a folder is remembered, and the write drops folders that are not in
  // the directory any more (./fold/folders.ts). Which those are is read off the
  // TREE — one answer to "what folders are there", the walk that decides what is
  // on screen — and asked on the click rather than memoised, because that is the
  // only moment anybody wants it.
  const toggle = (path: string) => toggleFolder(path, dirsIn(tree()))

  const view: TreeView = {
    isActive,
    get broken() {
      return props.broken
    },
    expanded: openFolders,
    openAncestry,
    toggle,
  }

  return (
    <>
      {/* Mobile scrim: under the header so app chrome stays tappable (#101). */}
      <Show when={props.open}>
        <button
          type="button"
          class={`fixed inset-x-0 bottom-0 top-[var(--height-header)] ${LAYER.page} bg-ink/40 md:hidden`}
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
          `${LAYER.chrome} olai-frame flex-col border-r border-paper/20 ` +
          // Wide enough that the month's 7 day cells still hit 44×44.
          "fixed bottom-0 left-0 top-[var(--height-header)] w-[min(22rem,92vw)] " +
          // `top-` above is BOTH positions' offset — the drawer's inset and
          // this column's sticky threshold are the same seam, so they read the
          // same token. `bottom`/`left` are the drawer's alone and must not
          // survive here: an inset on a sticky box is a constraint against the
          // scrollport, not a place to sit.
          "md:sticky md:bottom-auto md:left-auto md:flex " +
          "md:h-[calc(100dvh-var(--height-header))] md:w-full md:translate-x-0"
        }
        data-testid={TESTID.sidebar}
        data-open={props.open ? "true" : "false"}
      >
        {/* Desktop: collapse sits at the bottom of the column so it cannot
            cover the calendar's month-step chevrons (top-right of the body). */}
        <button
          type="button"
          class={`absolute bottom-2 right-2 ${WITHIN.raised} hidden ${TARGET_BOX} items-center justify-center rounded-full border border-paper/20 bg-ink text-paper/65 hover:bg-paper/10 hover:text-paper md:inline-flex md:min-h-8 md:min-w-8`}
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
          class="olai-scroll min-h-0 flex-1 overflow-y-auto p-3"
          data-testid={TESTID.sidebarBody}
          // Any navigation (day, outline, document) bubbles here and puts the
          // mobile drawer away. Folder folds stop propagation so a reader can
          // open several without reopening the drawer each time.
          onClick={() => props.onClose()}
        >
          <Agenda owed={props.owed} />
          {props.children}

          {/* THE SHELF, between the journal's two questions and the files —
              which is where a reader's own short list belongs (human,
              2026-08-19). Above the agenda it sat in front of the news; here it
              is the last thing said about the DIRECTORY before the directory
              itself, and a pinned outline is a hand's width from the outline
              list it is a shortcut into. It draws nothing at all when there are
              no pins (`./pins/Shelf.tsx`), so the ordinary column is exactly
              the column it always was. */}
          <Shelf />

          {/* THE DIRECTORY ITSELF — the tree, and the two ways to add to it,
              in one region because the second is about the first.

              NO LABEL over it, where the shelf has one, and the reason is a
              budget rather than a preference: this column is one screen tall
              and the month above is most of it, so every line of chrome here
              is a line the TREE loses on a short screen — which a scenario
              holds ("the file tree is still on screen"). What needed naming
              was the list that is new to a reader; the tree is what the column
              IS, and the rule above it says where it starts. */}
          <section class={REGION} data-testid={TESTID.sidebarFiles}>
            <ul class="m-0 list-none p-0" data-testid={TESTID.outlineList}>
              <Key each={tree()} by="key">
                {(row) => <Entry row={row()} view={view} />}
              </Key>
            </ul>
            {/* Directly under the tree, because the tree is what it adds to:
                the two ways to a FILE that does not exist yet — an outline
                (./outline/NewOutline.tsx) and a document
                (./document/NewDocument.tsx), both drawing the one path box
                (./file/NewFile.tsx). The outline first, because the tree above
                it is mostly outlines and because that is the file this app is
                about.

                Set off by a hairline of their own INSIDE the region rather than
                made a region of their own: they belong to the tree — a reader
                looking for "how do I make one" looks at the end of the list of
                them — and what they needed was to stop reading as two more
                files, which is what a rule and a gap say. */}
            <div class="mt-2 border-t border-paper/15 pt-2">
              <NewOutline />
              <NewDocument />
            </div>
          </section>

          {/* And below all of it, the two doors that are not rows of the tree
              above them — one INTO the directory and one out of it. Their own
              region, because neither is about the files listed above.

              They are here together because they are the same kind of thing
              now: with `_olai/` out of the tree by default
              (./settings/hiddenOutlines.ts), the foot of this column is where
              the files olai named for itself get their names back. The Inbox
              first — what comes IN is read before what was thrown out — and it
              draws nothing at all until the directory has an inbox, which is
              the rule the shelf above already keeps. */}
          <div class={REGION}>
            <Show when={inbox()}>
              {(file) => (
                <Inbox
                  file={file()}
                  isActive={isActive}
                  broken={props.broken.has(file())}
                />
              )}
            </Show>
            <Trash />
          </div>
        </div>
        <Show when={props.foot}>
          {(foot) => (
            <div class="shrink-0 border-t border-paper/15 p-3">
              {foot()}
            </div>
          )}
        </Show>
      </nav>
    </>
  )
}

/** The way to what is owed, above the month — and, when something IS owed, the
 *  news that it is.
 *
 *  Whether it is the page being read is asked of the ROUTE rather than passed
 *  down beside the open file: the agenda belongs to no outline — it crosses all
 *  of them — so `active` has nothing to say about it, and the router is already
 *  what every link in this column goes through.
 *
 *  What it MARKS is not asked of anything: the two numbers arrive as a prop,
 *  off the one `owed` subscription this client opens (../dates.ts). A count
 *  derived here would be a second reading of the same directory, free to
 *  disagree with the page one click away — which is the whole of why this entry
 *  takes the COUNTS and not a set to walk, and since `vault-in-browser`'s PR 4
 *  there is no set on this side to walk anyway.
 *
 *  The facts ride a WRAPPER rather than the link, the way a calendar cell
 *  carries its four (./calendar/Day.tsx): `<Link>` spells the `data-` it knows
 *  about, and "how many are late" is not a fact about links.
 *
 *  ON THE AGENDA ITSELF the current-page wash wins the row and the alarm keeps
 *  the chip, and that is the cascade doing what it should: `aria-[current=page]`
 *  is an attribute-qualified selector and outranks a plain utility, so the entry
 *  says "you are here" while the chip goes on saying how many. A reader standing
 *  on the page has the OVERDUE section itself in front of them; the alarm's job
 *  is to reach somebody who is somewhere else. */
function Agenda(props: { readonly owed: Owed | undefined }) {
  const router = useRouter()
  // A memo, and it holds its answer by the COUNTS rather than by identity: a
  // mark is minted afresh on every frame, so one compared by reference would
  // rewrite this entry's class, label, title and three `data-` facts for a
  // frame that said what the last one did (`./agenda/owed.ts`'s `unchanged`).
  const mark = createMemo(() => markOf(props.owed), undefined, { equals: unchanged })

  return (
    <div
      class="mb-1"
      data-testid={TESTID.agendaOwed}
      data-owed={mark().face}
      data-overdue={String(mark().owed.overdue)}
      data-today={String(mark().owed.today)}
    >
      <Link
        route={{ kind: "agenda" }}
        // The SHAPE plus the mark's ink and ground: one utility per property,
        // whichever face it is wearing.
        class={`${ENTRY_SHAPE} ${mark().entry}`}
        testid={TESTID.agendaLink}
        current={router.route().kind === "agenda"}
        label={mark().said}
        title={mark().said}
      >
        Agenda
        {/* Whether there is a chip at all is the table's ruling, read off the
            paint it did or did not hand back — never a second reading of the
            face here. `ml-auto` is this row's business, not the table's. */}
        <Show when={mark().chip !== ""}>
          <span
            class={`ml-auto shrink-0 ${mark().chip}`}
            data-testid={TESTID.agendaCount}
          >
            {mark().count}
          </span>
        </Show>
      </Link>
    </div>
  )
}

/** The way to what was put away, at the foot of the column — below the file
 *  tree because that is where a trash sits, and OUTSIDE it because an archive
 *  is not an outline to open and edit ({@link fileTree} never sees one).
 *  Always drawn, like the agenda: an empty trash is a fact a reader may want,
 *  not a control to hide until it would say something.
 *
 *  Whether it is the page being read is asked of the ROUTE, exactly as the
 *  agenda asks: the trash belongs to no one file — it is every archive under
 *  the directory — so `active` has nothing to say about it. */
function Trash() {
  const router = useRouter()

  return (
    <Link
      route={{ kind: "trash" }}
      class={DOOR}
      testid={TESTID.trashLink}
      current={router.route().kind === "trash"}
    >
      Trash
    </Link>
  )
}

/** The way to what has been CAPTURED — the outline a `⌘K` `+` lands in, one
 *  click from wherever the reader is.
 *
 *  It is an entry rather than a tree row for the reason the Trash is one: the
 *  file it opens is a file olai named for itself, and the tree stopped drawing
 *  those (./settings/hiddenOutlines.ts). Unlike the Trash it is a FILE PAGE —
 *  an ordinary outline you can type into — so the entry lights up the way a
 *  tree row does, off the open page's file, rather than off the route.
 *
 *  DRAWN ONLY WHEN THERE IS ONE. A directory that has never captured has no
 *  inbox, and minting one is the capture's job — a door offering to create a
 *  file is a second way to mint the one file whose whole promise is that it is
 *  minted by the write that fills it (`@olai/server`'s `edit.ts`: one op, so a
 *  refused capture leaves nothing behind).
 *
 *  A reader whose inbox is their OWN file — a root `Inbox.olai`, a
 *  `notes/inbox.olai` — sees it here and in the tree, which is the double the
 *  shelf has always had for a root `Pins.olai`: this entry is a door onto
 *  whichever file the directory's inbox is, and hiding somebody's own outline
 *  is not this switch's business.
 *
 *  AND IT IS MARKED when its file could not be read, exactly as a tree row is:
 *  this is the door onto an ordinary outline, so an outline that will not parse
 *  has to say so where the reader meets it. */
function Inbox(props: {
  readonly file: string
  readonly isActive: (file: string) => boolean
  readonly broken: boolean
}) {
  return (
    <Link
      route={atFile(props.file)}
      class={DOOR}
      testid={TESTID.inboxLink}
      current={props.isActive(props.file)}
      broken={props.broken}
      title={props.file}
    >
      Inbox
      <Show when={props.broken}>
        {/* No margin of its own: the row has one gap and this is on it — the
            tree's own mark, said the same way (see `File` below). */}
        <span class="text-alarm" title="this file could not be read">
          ⚠
        </span>
      </Show>
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
        title={props.row.path}
        onClick={(event) => {
          event.stopPropagation()
          props.view.toggle(props.row.path)
        }}
      >
        <span class={`${CONTROL} text-paper/55`} aria-hidden="true">
          {/* Same weight as the glyphs beside it, not a font triangle at
              0.55rem: that mark sat in the same cell and still read as a
              different drawing. */}
          <svg
            class="size-2.5 shrink-0 transition-transform duration-100"
            classList={{ "-rotate-90": folded() }}
            viewBox="0 0 10 10"
            fill="currentColor"
          >
            <path d="M2 3.25 L8 3.25 L5 7.25 Z" />
          </svg>
        </span>
        {/* The triangle says whether it is OPEN; this says it is a folder at
            all — which the triangle cannot, because every fold control in the
            app is one (`./file/icons.tsx`). The triangle sits in CONTROL, and
            a file row holds that same box empty, so this glyph and a file's
            occupy one column. */}
        <Glyph of="folder" />
        <span class="min-w-0 truncate">{props.row.name}</span>
      </button>
      <Show when={!folded()}>
        <ul class="m-0 ml-2 list-none border-l border-paper/20 p-0 pl-2">
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
  // Only the ⚠ is asked of the kind here, and it is not one of `./file/kinds.ts`
  // answers: a file that could not be READ is a fact about this row's file, and
  // only an outline's unreadability costs the reader a tree.
  const outline = props.row.of === "outline"

  return (
    <li class="mb-0.5">
      <Link
        route={atFile(props.row.file)}
        class={ENTRY}
        testid={ROW_TESTID[props.row.of]}
        current={props.view.isActive(props.row.file)}
        broken={outline && props.view.broken.has(props.row.file)}
        title={props.row.file}
      >
        {/* The fold control's box, empty: a file has no triangle, and leaving
            the cell out put its glyph where a folder's triangle sits — so the
            four drawings that were supposed to be one column (`./file/icons.tsx`)
            never were. The outline tree already holds this seat open
            (`./Tree.tsx`'s HOVER_CELL fallback). */}
        <span class={CONTROL} aria-hidden="true" />
        {/* Which kind of file this is — the thing four characters of extension
            were carrying on their own (`./file/icons.tsx`). */}
        <Glyph of={props.row.of} />
        <span class="min-w-0 truncate">{props.row.name}</span>
        <Show when={outline && props.view.broken.has(props.row.file)}>
          {/* No margin of its own: the row has one gap and this is on it. */}
          <span class="text-alarm" title="this file could not be read">
            ⚠
          </span>
        </Show>
      </Link>
    </li>
  )
}
