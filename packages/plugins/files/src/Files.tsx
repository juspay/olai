import { createCarry } from "@olai/web/client/carry.ts"
import { landings } from "./landings.ts"
import type { CarriedPath } from "./carry.ts"
/** THE FILE LIST of the directory column: the Outlines heading and its `+`,
 *  the tree, Reference, and the vault's own `_olai/` files. The Trash is not
 *  drawn here — it is the trash row's own entry at the column's foot. */

import { TESTID } from "olai-plugin-files/testids"
import { type BrokenFile, fileKind, inOlaiDir, isTrashed, nameOf } from "@olai/format"
import { Key } from "@solid-primitives/keyed"
import {
createMemo,
createSelector,
createSignal,
For,
type JSX,
lazy,
Match,
Show,
Switch,
} from "solid-js"
import { servedDirectory } from "./vault.ts"


import { createReferenceFold } from "./fold/reference.ts"
import { CONTROL } from "@olai/ui-primitives/touch.ts"
import { Glyph } from "./glyphs.tsx"
import { drawingOf } from "./drawings.ts"
import { ancestorDirs,dirsIn,type FileRow,fileTree } from "olai-plugin-files/fileTree.ts"
import { openFolders,toggleFolder } from "olai-plugin-files/fold/folders.ts"

import { ENTRY_SHAPE,HEAD_ACTION,REGION,REGION_HEAD,REGION_LABEL,ROW_GAP } from "olai-plugin-layout/entry"
import { atFile,type Route } from "olai-plugin-navigation/routes"
import { Link } from "olai-plugin-navigation/routing"
import { useServed } from "./vault.ts"


import type { SidebarRegionProps } from "olai-plugin-sidebar/contract"
import { fileTypes } from "./contract.ts"
import type { Making } from "olai-plugin-files/making"
import { openNewFile } from "./file/NewFile.tsx"
const NewMenu = lazy(() => import("./NewMenu.tsx"))

const ENTRY = `${ENTRY_SHAPE} ${ROW_GAP}`
const DOOR = `${ENTRY} text-paper/60`

/** A directory row: folds, does not navigate. Same SHAPE and ink as a file —
 *  the padding, the gap, the type — because a muted folder in a column of
 *  files was two lists. Current-page wash is a file's, and a button does not
 *  carry it. */
const DIR = `${ENTRY_SHAPE} ${ROW_GAP}`

const NO_BROKEN: ReadonlyMap<string, BrokenFile> = new Map()

interface TreeView {
  readonly closeDrawer: () => void
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
  const active = createMemo(() => props.active)
  const openAncestry = createMemo(() => {
    const file = active()
    return file === undefined ? new Set<string>() : new Set(ancestorDirs(file))
  }, undefined, { equals: (a, b) => a.size === b.size && [...a].every(key => b.has(key)) })

  // `createSelector` rather than `props.active === file` in each row: that
  // form subscribes every entry to the open page. This notifies exactly the
  // entry that lit and the one that went out.
  const isActive = createSelector(() => props.active)
  // The archives are not in the tree: an `_olai/Trash.olai` is not an outline a
  // reader opens and edits, and the Trash entry at the column's foot (the
  // trash row's own) is its one door. Filtered here rather than upstream because every other reader of
  // `files` — the page model, the trash itself — wants the whole list.
  // THE PATHS, out of the context that holds them under a MEMBERSHIP equality
  // (`./served.tsx`) — not off the faces, and that is the difference between a
  // tree rebuilt when a file arrives and one rebuilt on every keystroke
  // anywhere in the directory. A face changes when its file's content does;
  // this tree is a function of the NAMES.
  const served = useServed()
  // ...and the SECOND rule the tree draws by, which is a ruling and not a
  // preference: the outlines olai named for itself do not sit among the
  // reader's own — the vault group below the tree is their home.
  const tree = createMemo(() => {
    const claims = servedDirectory()?.claims()
    return claims === undefined ? [] : fileTree(claims, served().filter(file => !isTrashed(claims, file) && !inOlaiDir(file)), "nodes")
  })

  const references = createMemo(() => {
    const claims = servedDirectory()?.claims()
    return claims === undefined ? [] : served().filter(file => {
      const kind = fileKind(claims, file)
      return !inOlaiDir(file) && kind !== null && claims.byKind.get(kind)?.holds !== "nodes"
    })
  })
  const referenceTree = createMemo(() => {
    const claims = servedDirectory()?.claims()
    return claims === undefined ? [] : fileTree(claims, references(), "reference")
  })
  const reference = createReferenceFold(active, file => references().includes(file))

  // THE VAULT'S OWN FILES — the `_olai/` outlines, every one the directory
  // holds except the archive (which the `isTrashed` rule above already
  // spends): the quiet group at the column's foot. No records are walked here;
  // the directory supplies path membership.
  const vault = createMemo(() => {
    const claims = servedDirectory()?.claims()
    return claims === undefined ? [] : served().filter(file => !isTrashed(claims, file) && inOlaiDir(file))
  })

  // Folding a folder is remembered, and the write drops folders that are not in
  // the directory any more (./fold/folders.ts). Which those are is read off the
  // TREE — one answer to "what folders are there", the walk that decides what is
  // on screen — and asked on the click rather than memoised, because that is the
  // only moment anybody wants it.
  const toggle = (path: string) => toggleFolder(path, dirsIn([...tree(), ...referenceTree()]))

  const view: TreeView = {
    closeDrawer: () => props.onClose(),
    isActive,
    get broken() {
      return (servedDirectory()?.broken() ?? NO_BROKEN)
    },
    expanded: openFolders,
    openAncestry,
    toggle,
  }

  // THE KINDS A READER CAN START HERE, as the `+` menu lists them: each kind's
  // own row contributes its item (`files.types`), and a kind that cannot mint
  // right now (no outline row configured) has none. No kinds, no `+` — a
  // button that opens an empty menu is a dead control.
  const kinds = () => props.slots.read(fileTypes)
  const makings = createMemo(() => kinds().flatMap(({ value }) => { const making = value.making(); return making === undefined ? [] : [making] }))

  return <>
          <section class={REGION} data-testid={TESTID.sidebarFiles}>
            <div class={REGION_HEAD}>
              <h2 class={REGION_LABEL}>Outlines</h2>
              <Show when={makings().length > 0}>
                <NewFileButton items={makings()} />
              </Show>
            </div>
            {/* The path boxes the `+` menu opens — an outline's
                (./outline/NewOutline.tsx) and a document's
                (./document/NewDocument.tsx), both the one box
                (./file/NewFile.tsx). Drawn under the heading that asked for
                them, above the list they will add to; each draws nothing until
                its item is picked. */}
            <For each={kinds()}>{({ value: kind }) => <kind.Create />}</For>
            <ul class="m-0 list-none p-0" data-testid={TESTID.outlineList}>
              <Key each={tree()} by="key">
                {(row) => <Entry row={row()} view={view} />}
              </Key>
            </ul>
          </section>

          <Show when={references().length > 0}>
            <section class={REGION} data-testid={TESTID.reference} data-count={references().length}>
              <button type="button" class={`${ENTRY} w-full text-paper/60`} data-testid={TESTID.referenceToggle} aria-expanded={reference.open()} onClick={reference.toggle}>
                <span class={`${CONTROL} text-paper/60`} aria-hidden="true"><svg class="size-2.5 shrink-0 transition-transform duration-100" classList={{ "-rotate-90": !reference.open() }} viewBox="0 0 10 10" fill="currentColor"><path d="M2 3.25 L8 3.25 L5 7.25 Z" /></svg></span>
                <Glyph of="folder" />
                <span>Reference</span><span class="ml-auto tabular-nums text-label">{references().length}</span>
              </button>
              <Show when={reference.open()}>
                <ul class="m-0 list-none p-0" data-testid={TESTID.referenceList}>
                  <Key each={referenceTree()} by="key">{row => <Entry row={row()} view={view} />}</Key>
                </ul>
              </Show>
            </section>
          </Show>

          {/* THE VAULT'S OWN FILES — the `_olai/` outlines (Pins, Settings,
              the Inbox), under ONE special parent named after the house
              itself (ruled 2026-08-31: one mechanism, one parent for the
              vault's own furniture). The parent is no page: the rows under
              it are the doors, each in the quiet ink of a door rather than
              the list's — not this reader's corpus, but pages this reader
              may well open (the watch's config is the one the drawer's
              wrench lands on).

              DRAWN ONLY WHEN IT HOLDS SOMETHING. The Trash used to nest here
              too and kept the group always drawn; it is the trash row's own
              `foot` entry now (2026-09 simplification), pinned at the
              column's foot by the sidebar, so a directory with no `_olai/`
              file shows no empty parent (the shelf's own rule: never an
              empty box). */}
          <Show when={vault().length > 0}>
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
                        broken={(servedDirectory()?.broken() ?? NO_BROKEN)}
                      />
                    )}
                  </Key>
                </ul>
              </li>
            </ul>
          </section>
          </Show>
</>
}
/** THE `+` ON THE OUTLINES HEADING: a real button (Tab reaches it, Enter and
 *  Space press it) that opens the new-file menu (`./NewMenu.tsx`) under
 *  itself. Picking an item opens that kind's path box under the heading. */
function NewFileButton(props: { readonly items: ReadonlyArray<Making> }) {
  const [menu, setMenu] = createSignal<HTMLElement | null>(null)
  // A press on the `+` while its menu is up is the menu's outside-press: it
  // has already shut by the time the click lands, and the click must not open
  // it again.
  let shutting = false
  return <>
    <button type="button" class={HEAD_ACTION} data-testid={TESTID.newFile}
      aria-label="New file" title="New outline or document" aria-haspopup="menu" aria-expanded={menu() !== null}
      onPointerDown={() => { shutting = menu() !== null }}
      onClick={(event) => {
        // The sidebar body puts the phone drawer away on any click that
        // bubbles to it; opening a menu is not leaving.
        event.stopPropagation()
        if (shutting) { shutting = false; setMenu(null); return }
        setMenu(menu() === null ? event.currentTarget : null)
      }}>
      <PlusGlyph />
    </button>
    <Show when={menu()}>{anchor => <NewMenu anchor={anchor()} items={props.items}
      close={() => setMenu(null)} pick={(making) => { setMenu(null); openNewFile(making.of) }} />}</Show>
  </>
}

function PlusGlyph() {
  return <svg viewBox="0 0 16 16" class="size-3.5" aria-hidden="true" fill="currentColor">
    <path d="M8 2.75a.75.75 0 0 1 .75.75v3.75h3.75a.75.75 0 0 1 0 1.5H8.75v3.75a.75.75 0 0 1-1.5 0V8.75H3.5a.75.75 0 0 1 0-1.5h3.75V3.5A.75.75 0 0 1 8 2.75z" />
  </svg>
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
  readonly of: string | null | undefined
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
        <span class="text-alarm" title="This file couldn't be read">
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
 * It is a FILE PAGE, not a page of its own the way Trash is: `Settings.olai`
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
  const name = () => {
    const claims = servedDirectory()?.claims()
    return claims === undefined ? props.file : nameOf(claims, props.file)
  }
  const of = () => servedDirectory()?.kindOf(props.file) ?? null
  const unreadable = () => servedDirectory()?.claims().byKind.get(of() ?? "")?.holds === "nodes" && props.broken.has(props.file)
  return (
    <DoorRow
      route={atFile(props.file)}
      testid={TESTID.vaultLink}
      current={props.isActive(props.file)}
      broken={unreadable()}
      title={props.file}
    >
      <FileAnatomy of={of()} name={name()} broken={unreadable()} />
    </DoorRow>
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
        aria-label={folded() ? `Expand ${props.row.name}` : `Collapse ${props.row.name}`}
        title={props.row.path}
        onClick={(event) => {
          event.stopPropagation()
          props.view.toggle(props.row.path)
        }}
      >
        <span class={`${CONTROL} text-paper/60`} aria-hidden="true">
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
  const carry = createCarry(() => ({ kind: "files.path", path: props.row.file } satisfies CarriedPath), landings, { onLift: props.view.closeDrawer })
  // Only the ⚠ is asked of the kind here, and it is not one of `./file/kinds.ts`
  // answers: a file that could not be READ is a fact about this row's file, and
  // only an outline's unreadability costs the reader a tree.
  const outline = () => servedDirectory()?.claims().byKind.get(props.row.of)?.holds === "nodes"

  return (
    <li class="mb-0.5" onPointerDown={carry.grab} onContextMenu={carry.heldMenu} draggable={false} onDragStart={event => event.preventDefault()} on:click={{ capture: true, handleEvent: carry.click }}>
      <Link
        route={atFile(props.row.file)}
        class={ENTRY}
        testid={drawingOf(props.row.of)?.testid ?? TESTID.fileLink}
        current={props.view.isActive(props.row.file)}
        broken={outline() && props.view.broken.has(props.row.file)}
        title={props.row.file}
      >
        <FileAnatomy
          of={props.row.of}
          name={props.row.name}
          broken={outline() && props.view.broken.has(props.row.file)}
        />
      </Link>
    </li>
  )
}
