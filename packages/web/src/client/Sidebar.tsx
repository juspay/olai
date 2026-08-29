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
 * ## What the tree does NOT draw, and where those files live instead
 *
 * The outlines olai NAMED FOR ITSELF — everything under `_olai/` — are not
 * rows of the reader's own corpus, and they are not hidden either: the
 * column gives them a HOME OF THEIR OWN, the quiet group at its foot
 * below the tree, in the register the Trash door beside it already uses
 * (human, 2026-08-29: the *Hidden outlines* switch went entirely — in
 * place of a toggle that suppressed a path, a first-class seat for the
 * vault's own furniture, the way a trash has always had one). `Kolu.olai`,
 * `Inbox.olai`, `Properties.olai`, `Pins.olai` — each is simply a page
 * that exists: it opens like any outline, lights its row when it is the
 * page being read, and wears the ⚠ when it will not parse, because an
 * unreadable file is never a silent one. `_olai/Trash.olai` is the ONE
 * absence, on the archive's own rule: it is not a file you edit, and the
 * Trash entry is its door.
 *
 * **Inbox** sits beside Agenda at the top — a primary destination, not a
 * door at the foot (human, 2026-08-20, screenshot ruling). It is an ordinary
 * outline, so its entry lights up like a tree row, wears the same ⚠ when its
 * file will not parse, and is drawn only when the directory actually has one.
 * It wears Agenda's own count badge: how many top-level captures still await
 * processing (a finished branch does not), hidden at zero. **Trash** stays at the foot, below the tree, because
 * that is where a trash sits.
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

import { type BrokenFile, fileKind, inboxIn, inOlaiDir, isTrashed, stemOf } from "@olai/format"
import { Key } from "@solid-primitives/keyed"
import {
  createMemo,
  createSelector,
  type JSX,
  Match,
  Show,
  Switch,
} from "solid-js"

import type { InboxHeld, Owed } from "@olai/surface"

import { markOf, unchanged } from "./agenda/owed.ts"
import { NewDocument } from "./document/NewDocument.tsx"
import { NewOutline } from "./outline/NewOutline.tsx"
import { ROW_TESTID } from "./file/kinds.ts"
import { useServed } from "./served.tsx"
import { Glyph } from "./file/icons.tsx"
import { ancestorDirs, dirsIn, type FileRow, fileTree } from "./fileTree.ts"
import { openFolders, toggleFolder } from "./fold/folders.ts"
import { LAYER, WITHIN } from "./layer.ts"
import { CHIP_QUIET } from "./layout/chip.ts"
import { CountChip } from "./layout/CountChip.tsx"
import { ENTRY_SHAPE, REGION, ROW_GAP } from "./layout/entry.ts"
import { SidebarHandle } from "./layout/Handle.tsx"
import { setSidebarOpen } from "./layout/prefs.ts"
import { Shelf } from "./pins/Shelf.tsx"
import { Link, useRouter } from "./router.tsx"
import { TESTID } from "./testids.ts"
import { CONTROL, TARGET_BOX } from "./touch.ts"
import { atFile, type Route } from "./routes.ts"

/** One file entry. Workflowy-quiet: soft hover, a wash when current.
 *
 *  The gap is HERE and not in the shape above, because it is the tree's rows
 *  that have more than one thing on them. The agenda's entry is the same
 *  SHAPE and not this, so nothing about that row moves; `Trash` borrows this
 *  one and has a single child, where a gap is inert. */
const ENTRY = `${ENTRY_SHAPE} ${ROW_GAP}`

/** A DOOR at the foot of the column: Trash. It is not a row of the tree above
 *  it — it opens a file that tree does not draw — and the quiet ink is what
 *  says so, since a door drawn in the list's own ink would read as one more
 *  file. Inbox used to sit here; it moved up beside Agenda (human,
 *  2026-08-20). */
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
  /** How full the inbox is, counted where the set is (`./inbox.ts`'s cell) —
   *  top-level captures that still await processing, zero when there is none
   *  or every capture is already processed. The door's presence is still a
   *  question about the PATHS (`inboxIn`); this is only the number it
   *  wears. */
  readonly inboxHeld: InboxHeld
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
  // ...and the SECOND rule the tree draws by, which is a ruling and not a
  // preference: the outlines olai named for itself do not sit among the
  // reader's own — the column's FOOT is their home (the vault group below),
  // the way the Trash has always had its own there.
  const tree = createMemo(() =>
    fileTree(
      served().filter((file) => !isTrashed(file) && !inOlaiDir(file)),
    ),
  )

  // THE VAULT'S OWN FILES — the `_olai/` outlines, every one the directory
  // holds except the archive (which the `isTrashed` rule above already
  // spends): the quiet group at the column's foot. Reading the PATHS off the
  // same list the tree reads is the `inboxIn` argument one memo down: no
  // records are walked here, and path-only membership equality (`./served.tsx`)
  // is what keeps this answer from minting on a frame.
  const vault = createMemo(() =>
    served().filter((file) => !isTrashed(file) && inOlaiDir(file))
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
  // records any more (https://github.com/juspay/oss.olai/blob/main/projects/olai/brainstorming/vault-in-browser.md), so resolving a
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
          <Show when={inbox()}>
            {(file) => (
              <Inbox
                file={file()}
                isActive={isActive}
                broken={props.broken.has(file())}
                count={props.inboxHeld.count}
              />
            )}
          </Show>
          {props.children}

          {/* THE SHELF, between the month and the files — which is where a
              reader's own short list belongs (human, 2026-08-19). Inbox used
              to sit at the foot and now sits beside Agenda above the month
              (human, 2026-08-20); the shelf did not move with it. A pinned
              outline is a hand's width from the outline list it is a shortcut
              into. It draws nothing at all when there are no pins
              (`./pins/Shelf.tsx`), so the ordinary column is exactly the
              column it always was. */}
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

          {/* THE COLUMN'S FOOT — the vault's own furniture, then the way
              OUT of the directory: one list, one mechanism (`DoorRow`),
              because the group and the Trash are the same thing — doors
              onto pages the tree does not draw, differing only in who is
              named. The `_olai/` outlines sit above the Trash and in its
              own register (the quiet ink of a door rather than the list's):
              not this reader's corpus, but pages this reader may well open
              — the watch's config is the one the drawer's wrench lands on.
              An empty group is simply no rows (the shelf's own rule: never
              an empty box); the Trash is always there, always was. Inbox
              used to sit here; it moved up beside Agenda (human,
              2026-08-20). */}
          <section class={REGION}>
            <ul class="m-0 list-none p-0">
              <Key each={vault()} by={(file) => file}>
                {(file) => (
                  <VaultFile
                    file={file()}
                    isActive={isActive}
                    broken={props.broken}
                  />
                )}
              </Key>
              <Trash />
            </ul>
          </section>
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
            face here. The chip itself is the column's one count badge
            (`./layout/CountChip.tsx`), so Inbox cannot spell a lookalike. */}
        <CountChip
          count={mark().count}
          paint={mark().chip}
          testid={TESTID.agendaCount}
        />
      </Link>
    </div>
  )
}

/**
 * THE FOOT'S ONE MECHANISM — a door in the quiet register, its `li` and its
 * `Link` spoken once: every seat below the tree is this row, a vault file's
 * or the Trash's. What differs between them is only who is named — and which
 * of the two CURRENT-page answers each keeps (a file's open page, the route's
 * for a page that belongs to no outline).
 *
 * It exists because the group above it used to be hand-drawn beside the
 * Trash's own shell, two skeletons for one register (the hickey/lowy bar:
 * the special section gets no special mechanics).
 */
function DoorRow(props: {
  readonly route: Route
  readonly testid: string
  readonly current: boolean
  readonly title?: string
  readonly broken?: boolean
  readonly children: JSX.Element
}) {
  return (
    <li class="mb-0.5">
      <Link
        route={props.route}
        class={DOOR}
        testid={props.testid}
        current={props.current}
        title={props.title}
        broken={props.broken}
      >
        {props.children}
      </Link>
    </li>
  )
}

/**
 * ONE OF THE VAULT'S OWN FILES — a seat of the quiet group at the column's
 * foot, the `DoorRow` dressed as a file page.
 *
 * It is a FILE PAGE, not a page of its own the way Trash is: `Kolu.olai`
 * opens like any outline, so the seat lights the current-page wash off the
 * open page's file exactly as a tree row does, and wears the same ⚠ when
 * the file will not read — an unreadable `_olai/Pins.olai` used to be the
 * one exception the hiding switch kept a row for, precisely because
 * swallowing the mark would be the silent failure the corpus's own rules
 * refuse.
 *
 * QUIET INK, deliberately: the register is the Trash door's (`DOOR`), and it
 * is how the group reads as the house's furniture rather than as a few more
 * of the reader's own outlines parked lower — the 2026-08-29 design's one
 * treatment for what there used to be a switch about.
 */
function VaultFile(props: {
  readonly file: string
  readonly isActive: (file: string) => boolean
  readonly broken: ReadonlyMap<string, BrokenFile>
}) {
  const of = fileKind(props.file)
  const unreadable = () => of === "outline" && props.broken.has(props.file)
  return (
    <DoorRow
      route={atFile(props.file)}
      testid={TESTID.vaultLink}
      current={props.isActive(props.file)}
      broken={unreadable()}
      title={props.file}
    >
      {/* The tree rows' own seat for a fold control, held here too, so the
          glyph lands in the same column as the tree's — one column of
          names, the quiet ink said why these ones are quiet. */}
      <span class={CONTROL} aria-hidden="true" />
      <Show when={of}>{(kind) => <Glyph of={kind()} />}</Show>
      <span class="min-w-0 truncate">{stemOf(props.file)}</span>
      <Show when={unreadable()}>
        <span class="text-alarm" title="this file could not be read">
          ⚠
        </span>
      </Show>
    </DoorRow>
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
    <DoorRow
      route={{ kind: "trash" }}
      testid={TESTID.trashLink}
      current={router.route().kind === "trash"}
    >
      Trash
    </DoorRow>
  )
}

/** The way to what has been CAPTURED — the outline a `⌘K` `+` lands in, one
 *  click from wherever the reader is, beside Agenda.
 *
 *  It is an entry rather than a tree row for the reason the Trash is one: the
 *  file it opens is a file olai named for itself, and the tree does not draw
 *  those — the vault group at the column's foot now holds those rows, so
 *  that is never the reason the door exists. It is a door beside Agenda
 *  because that is where you REACH it (human, 2026-08-20). Unlike the Trash:
 *  it is a FILE PAGE —
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
 *  whichever file the directory's inbox is, and a reader's own outline is
 *  never the vault group's business.
 *
 *  AND IT IS MARKED when its file could not be read, exactly as a tree row is:
 *  this is the door onto an ordinary outline, so an outline that will not parse
 *  has to say so where the reader meets it.
 *
 *  THE COUNT is Agenda's own badge (`./layout/CountChip.tsx`, the quiet
 *  paint), of the top-level captures that still await processing. Hidden
 *  at zero, which is the same ruling the agenda's quiet face already
 *  keeps — and an inbox of only done rows or finished branches is that
 *  zero. */
function Inbox(props: {
  readonly file: string
  readonly isActive: (file: string) => boolean
  readonly broken: boolean
  readonly count: number
}) {
  return (
    <div class="mb-1" data-testid={TESTID.inboxHeld} data-count={String(props.count)}>
      <Link
        route={atFile(props.file)}
        class={`${ENTRY_SHAPE} ${ROW_GAP}`}
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
        <CountChip
          count={props.count}
          paint={CHIP_QUIET}
          testid={TESTID.inboxCount}
        />
      </Link>
    </div>
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
