import type { Navigation } from "olai-plugin-navigation/contract"
import { useHere,useRouter } from "olai-plugin-navigation/routing"
import { pageView,titles,type TitleProps } from "olai-plugin-outlines/contract"
import { readLocation } from "./locations.ts"
import type { Directory } from "olai-plugin-vault/file-state"
import { For, Show } from "solid-js"
import { useTrashUndo } from "./history.ts"
import { TrashPage } from "./TrashPage.tsx"
export function TrashPageView(props: { readonly files: Directory }) {
 const nav=useRouter() as Navigation, here=useHere(), history=useTrashUndo()
 nav.report(here,()=>({title:"Trash",history}))
 return <Show when={props.files.outlineRow() === undefined || props.files.claims().byKind.has(props.files.outlineRow()!)} fallback={<main class="p-8"><h1>Trash</h1><p>the {props.files.outlineRow()} row is off.</p></main>}><For each={readLocation(pageView)}>{entry=>entry.value({render: body=><TrashPage
  files={body.drawn.kind==="trash"?body.drawn.files:[]}
  groups={body.drawn.kind==="trash"?body.drawn.groups:[]}
  records={body.page.kind==="trash"?body.page.records:0}
 />})}</For></Show>
}
export function NodeTitle(props:TitleProps) {
 return <For each={readLocation(titles)}>{entry=>entry.value(props)}</For>
}
