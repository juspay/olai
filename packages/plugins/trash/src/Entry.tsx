import type { FileKind } from "@olai/format"
import { CONTROL } from "@olai/ui-primitives/touch.ts"
import { Glyph } from "@olai/web/client/file/icons.tsx"
import { TESTID } from "@olai/web/client/testids.ts"
import { ENTRY_SHAPE,ROW_GAP } from "olai-plugin-layout/entry"
import type { Route } from "olai-plugin-navigation/routes"
import { Link,useRouter } from "olai-plugin-navigation/routing"
import { Show,type JSX } from "solid-js"
const DOOR = `${ENTRY_SHAPE} ${ROW_GAP} text-paper/65`
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


export function Trash() {
  const router = useRouter()

  return (
    <DoorRow
      route={{ kind: "trash" }}
      testid={TESTID.trashLink}
      current={router.route().kind === "trash"}
    >
      {/* Not a file: no glyph, like the parent — a file kind's drawing
          would lie about a page that is none of them. */}
      <FileAnatomy of={null} name="Trash" broken={false} />
    </DoorRow>
  )
}

