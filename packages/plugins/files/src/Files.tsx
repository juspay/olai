import { type BrokenFile,type FileKind,fileKind,inboxIn,inOlaiDir,isTrashed,stemOf } from "@olai/format"
import { Key } from "@solid-primitives/keyed"
import {
createMemo,
createSelector,
For,
type JSX,
Match,
Show,
Switch,
} from "solid-js"
import { directory } from "./state.ts"


import { CONTROL } from "@olai/ui-primitives/touch.ts"
import { Glyph } from "@olai/web/client/file/icons.tsx"
import { ROW_TESTID } from "@olai/web/client/file/kinds.ts"
import { ancestorDirs,dirsIn,type FileRow,fileTree } from "olai-plugin-files/fileTree.ts"
import { openFolders,toggleFolder } from "olai-plugin-files/fold/folders.ts"
import { TESTID } from "@olai/web/client/testids.ts"
import { ENTRY_SHAPE,REGION,ROW_GAP } from "olai-plugin-layout/entry"
import { atFile,type Route } from "olai-plugin-navigation/routes"
import { Link } from "olai-plugin-navigation/routing"
import { useServed } from "olai-plugin-vault/files"


import type { SidebarRegionProps } from "olai-plugin-sidebar/contract"
import { vaultEntries } from "olai-plugin-sidebar/contract"
import { fileTypes } from "./contract.ts"

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


export function Files(props: SidebarRegionProps & {readonly active: string | undefined}) {
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
      return directory()!.broken()
    },
    expanded: openFolders,
    openAncestry,
    toggle,
  }

  return <>
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
              <For each={props.slots.read(fileTypes)}>{({ value: kind }) => <kind.Create />}</For>
            </div>
          </section>

          {/* THE COLUMN'S FOOT — the vault's own furniture, under ONE
              special parent named after the house itself: the `_olai/`
              outlines AND the way out (the Trash) nest under "olai"
              (ruled 2026-08-31: one mechanism, one parent, one door for
              the vault's own furniture — the Trash's top-level entry used
              to sit alone here and is absorbed). The parent is no page:
              the rows under it are the doors, each in the quiet ink of a
              door rather than the list's — not this reader's corpus, but
              pages this reader may well open (the watch's config is the
              one the drawer's wrench lands on). An empty group is the
              parent and the Trash alone (the shelf's own rule: never an
              empty box); the Trash is always there, always was. Inbox
              used to sit here; it moved up beside Agenda (human,
              2026-08-20). */}
          <section class={REGION}>
            <ul class="m-0 list-none p-0">
              <li class="mb-0.5">
                {/* THE PARENT — the door in name only: no page behind it,
                    so it is not a `DoorRow`; the underlined rows are the
                    doors. It reads as the tree's folders read (the DIR
                    register) so the furniture looks nested the way
                    everything nested looks — there is no fold in this one,
                    though: a parent you could collapse is the hiding
                    switch wearing a tree's clothes. */}
                <div class={DIR} data-testid={TESTID.vaultGroup}>
                  {/* No glyph, no page: `FileAnatomy` reads `of: null` as
                      the plain name — the one component, the one column
                      it is about. */}
                  <FileAnatomy of={null} name="olai" broken={false} />
                </div>
                <ul class="m-0 ml-2 list-none border-l border-paper/20 p-0 pl-2">
                  <Key each={vault()} by={(file) => file}>
                    {(file) => (
                      <VaultFile
                        file={file()}
                        isActive={isActive}
                        broken={directory()!.broken()}
                      />
                    )}
                  </Key>
                  <For each={props.slots.read(vaultEntries)}>{({ value: Entry }) => <Entry {...props} />}</For>
                </ul>
              </li>
            </ul>
          </section>
</>
}
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

/** ONE FILE-ROW BODY, for every row that opens a file page — the
 *  fold-control's own seat (held even where nothing folds, so the glyph
 *  lands in the tree's one column), the kind's glyph, the truncating
 *  name and the ⚠ a file that could not be read wears. The tree's `File`
 *  and the `olai` parent's `VaultFile` rows both wear it: two lists
 *  agreeing about one anatomy is not two lists that remembered the same
 *  four elements by luck, it is one. */
function FileAnatomy(props: {
  readonly of: FileKind | null | undefined
  readonly name: string
  readonly broken: boolean
}) {
  return (
    <>
      {/* The fold control's box, empty: a file has no triangle, and leaving
          the cell out put its glyph where a folder's triangle sits — so the
          four drawings that were supposed to be one column
          (`./file/icons.tsx`) never were. The outline tree already holds
          this seat open (`./Tree.tsx`'s HOVER_CELL fallback). */}
      <span class={CONTROL} aria-hidden="true" />
      {/* Which kind of file this is — the thing four characters of extension
          were carrying on their own (`./file/icons.tsx`). */}
      <Show when={props.of ?? undefined}>{(of) => <Glyph of={of()} />}</Show>
      <span class="min-w-0 truncate">{props.name}</span>
      <Show when={props.broken}>
        {/* No margin of its own: the row has one gap and this is on it. */}
        <span class="text-alarm" title="this file could not be read">
          ⚠
        </span>
      </Show>
    </>
  )
}

/**
 * ONE OF THE VAULT'S OWN FILES — nested under the foot's `olai` parent,
 * the `DoorRow` dressed as a file page. The body is the tree's own
 * (`FileAnatomy`): tests assert the rows' agreement by asking one
 * component of both.
 *
 * It is a FILE PAGE, not a page of its own the way Trash is: `Kolu.olai`
 * opens like any outline, so the seat lights the current-page wash off the
 * open page's file exactly as a tree row does, and wears the same ⚠ when
 * the file will not read — an unreadable `_olai/Pins.olai` used to be the
 * one exception the hiding switch kept a row for, precisely because
 * swallowing the mark would be the silent failure the corpus's own rules
 * refuse.
 *
 * NESTED, so the foot marks it the way a tree's child is marked (the
 * spine on the left), and the quiet ink says what stays true of any of
 * these: the house's furniture, not another outline of the reader's own
 * parked lower.
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
      <FileAnatomy of={of} name={stemOf(props.file)} broken={unreadable()} />
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
 *  paint), of the rows the inbox holds that are marked `todo` or `doing`,
 *  at any depth — unmarked rows are furniture and a placement is not a
 *  node. Hidden at zero, which is the same ruling the agenda's quiet face
 *  already keeps — and an inbox holding nothing marked is that zero. */

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
        <FileAnatomy
          of={props.row.of}
          name={props.row.name}
          broken={outline && props.view.broken.has(props.row.file)}
        />
      </Link>
    </li>
  )
}
