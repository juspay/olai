import { createCarry } from "@olai/web/client/carry.ts"
import { Tip } from "@olai/web/client/Tip.tsx"
import { landings } from "./landings.ts"
import type { CarriedPath } from "./carry.ts"

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
import { ancestorDirs,dirsIn,type FileRow,fileTree,rowKey } from "olai-plugin-files/fileTree.ts"
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
const DOOR = `${ENTRY} text-muted`

const DIR = `${ENTRY_SHAPE} ${ROW_GAP}`

const NO_BROKEN: ReadonlyMap<string, BrokenFile> = new Map()

interface TreeView {
  readonly closeDrawer: () => void
  readonly isActive: (file: string) => boolean
  readonly broken: ReadonlyMap<string, BrokenFile>
  readonly expanded: () => ReadonlySet<string>
  readonly openAncestry: () => ReadonlySet<string>
  readonly toggle: (path: string) => void
}


export function Files(props: SidebarRegionProps & {readonly active: string | undefined}) {
  const active = createMemo(() => props.active)
  const openAncestry = createMemo(() => {
    const file = active()
    return file === undefined ? new Set<string>() : new Set(ancestorDirs(file))
  }, undefined, { equals: (a, b) => a.size === b.size && [...a].every(key => b.has(key)) })

  const isActive = createSelector(() => props.active)
  const served = useServed()
  const tree = createMemo(() => {
    const claims = servedDirectory()?.claims()
    return claims === undefined ? [] : fileTree(claims, served().filter(file => !isTrashed(claims, file) && !inOlaiDir(file)), "nodes")
  })

  const references = createMemo(() => {
    const claims = servedDirectory()?.claims()
    return claims === undefined ? [] : served().filter(file => {
      const claim = claims.byKind.get(fileKind(claims, file) ?? "")
      return !inOlaiDir(file) && claim !== undefined && claim.holds !== "nodes" && claim.elsewhere !== true
    })
  })
  const referenceTree = createMemo(() => {
    const claims = servedDirectory()?.claims()
    return claims === undefined ? [] : fileTree(claims, references(), "reference")
  })
  const reference = createReferenceFold(active, file => references().includes(file))

  const vault = createMemo(() => {
    const claims = servedDirectory()?.claims()
    return claims === undefined ? [] : served().filter(file => !isTrashed(claims, file) && inOlaiDir(file))
  })

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
            <For each={kinds()}>{({ value: kind }) => <kind.Create />}</For>
            <ul class="m-0 list-none p-0" data-testid={TESTID.outlineList}>
              <Key each={tree()} by={rowKey}>
                {(row) => <Entry row={row()} view={view} />}
              </Key>
            </ul>
          </section>

          <Show when={references().length > 0}>
            <section class={REGION} data-testid={TESTID.reference} data-count={references().length}>
              <button type="button" class={`${ENTRY} w-full text-muted`} data-testid={TESTID.referenceToggle} aria-expanded={reference.open()} onClick={reference.toggle}>
                <span class={`${CONTROL} text-muted`} aria-hidden="true"><svg class="size-2.5 shrink-0 transition-transform duration-100" classList={{ "-rotate-90": !reference.open() }} viewBox="0 0 10 10" fill="currentColor"><path d="M2 3.25 L8 3.25 L5 7.25 Z" /></svg></span>
                <Glyph of="folder" />
                <span>Reference</span><span class="ml-auto tabular-nums text-label">{references().length}</span>
              </button>
              <Show when={reference.open()}>
                <ul class="m-0 list-none p-0" data-testid={TESTID.referenceList}>
                  <Key each={referenceTree()} by={rowKey}>{row => <Entry row={row()} view={view} />}</Key>
                </ul>
              </Show>
            </section>
          </Show>

          <Show when={vault().length > 0}>
          <section class={REGION}>
            <ul class="m-0 list-none p-0">
              <li class="mb-0.5">
                <div class={DIR} data-testid={TESTID.vaultGroup}>
                  <span class={CONTROL} aria-hidden="true" />
                  <span class="min-w-0 truncate">olai</span>
                </div>
                <ul class="m-0 ml-2.5 list-none border-l border-rule p-0 pl-1.5">
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
function NewFileButton(props: { readonly items: ReadonlyArray<Making> }) {
  const [menu, setMenu] = createSignal<HTMLElement | null>(null)
  let shutting = false
  return <>
    <Tip text="New outline or document">
      <button type="button" class={HEAD_ACTION} data-testid={TESTID.newFile}
        aria-label="New outline or document" aria-haspopup="menu" aria-expanded={menu() !== null}
        onPointerDown={() => { shutting = menu() !== null }}
        onClick={(event) => {
          event.stopPropagation()
          if (shutting) { shutting = false; setMenu(null); return }
          setMenu(menu() === null ? event.currentTarget : null)
        }}>
        <PlusGlyph />
      </button>
    </Tip>
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
  readonly tip?: string
  readonly label?: string
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
        tip={props.tip}
        label={props.label}
        broken={props.broken}
      >
        {props.children}
      </Link>
    </li>
  )
}

function FileAnatomy(props: {
  readonly of: string | undefined
  readonly name: string
  readonly broken: boolean
}) {
  return (
    <>
      <span class={CONTROL} aria-hidden="true" />
      <Show when={props.of}>{(of) => <Glyph of={of()} />}</Show>
      <span class="min-w-0 truncate">{props.name}</span>
      <Show when={props.broken}>
        {/* A bare span's `aria-label` is not a name the platform exposes, so
            the sentence rides a `role="img"`. */}
        <Tip text="This file couldn't be read">
          <span class="text-alarm" role="img" aria-label="This file couldn't be read">
            ⚠
          </span>
        </Tip>
      </Show>
    </>
  )
}

function VaultFile(props: {
  readonly file: string
  readonly isActive: (file: string) => boolean
  readonly broken: ReadonlyMap<string, BrokenFile>
}) {
  const name = () => {
    const claims = servedDirectory()?.claims()
    return claims === undefined ? props.file : nameOf(claims, props.file)
  }
  const of = () => servedDirectory()?.kindOf(props.file) ?? undefined
  const unreadable = () => servedDirectory()?.claims().byKind.get(of() ?? "")?.holds === "nodes" && props.broken.has(props.file)
  return (
    <DoorRow
      route={atFile(props.file)}
      testid={TESTID.vaultLink}
      current={props.isActive(props.file)}
      broken={unreadable()}
      tip={props.file}
      label={props.file}
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
      <Tip text={props.row.path}>
        <button
          type="button"
          class={DIR}
          data-testid={TESTID.fileDirToggle}
          data-path={props.row.path}
          aria-expanded={!folded()}
          aria-label={folded() ? `Expand ${props.row.name}` : `Collapse ${props.row.name}`}
          onClick={(event) => {
            event.stopPropagation()
            props.view.toggle(props.row.path)
          }}
        >
          <span class={`${CONTROL} text-muted`} aria-hidden="true">
            <svg
              class="size-2.5 shrink-0 transition-transform duration-100"
              classList={{ "-rotate-90": folded() }}
              viewBox="0 0 10 10"
              fill="currentColor"
            >
              <path d="M2 3.25 L8 3.25 L5 7.25 Z" />
            </svg>
          </span>
          {/* A bare span's `aria-label` is not a name the platform exposes, so
              the path rides a `role="img"`. */}
          <span role="img" aria-label={props.row.path}>
            <Glyph of="folder" />
          </span>
          <span class="min-w-0 truncate">{props.row.name}</span>
        </button>
      </Tip>
      <Show when={!folded()}>
        <ul class="m-0 ml-2.5 list-none border-l border-rule p-0 pl-1.5">
          <Key each={props.row.children} by={rowKey}>
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
  const outline = () => servedDirectory()?.claims().byKind.get(props.row.of)?.holds === "nodes"

  return (
    <li class="mb-0.5" onPointerDown={carry.grab} onContextMenu={carry.heldMenu} draggable={false} onDragStart={event => event.preventDefault()} on:click={{ capture: true, handleEvent: carry.click }}>
      <Link
        route={atFile(props.row.file)}
        class={ENTRY}
        testid={drawingOf(props.row.of)?.testid ?? TESTID.fileLink}
        current={props.view.isActive(props.row.file)}
        broken={outline() && props.view.broken.has(props.row.file)}
        tip={props.row.file}
        label={props.row.file}
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
