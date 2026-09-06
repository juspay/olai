import type { Navigation } from "olai-plugin-navigation/contract"
import { useHere,useRouter } from "olai-plugin-navigation/routing"
import { pageView,titles,type TitleProps } from "olai-plugin-outlines/contract"
import { readLocation } from "olai-plugin-ui-renderer/contract"
import { For } from "solid-js"
import { useTrashUndo } from "./history.ts"
import { TrashPage } from "./TrashPage.tsx"
export function TrashPageView() {
 const nav=useRouter() as Navigation, here=useHere(), history=useTrashUndo()
 nav.report(here,()=>({title:"Trash",history}))
 return <For each={readLocation(pageView)}>{entry=>entry.value({render: body=><TrashPage
  files={body.drawn.kind==="trash"?body.drawn.files:[]}
  groups={body.drawn.kind==="trash"?body.drawn.groups:[]}
  records={body.page.kind==="trash"?body.page.records:0}
 />})}</For>
}
export function NodeTitle(props:TitleProps) {
 return <For each={readLocation(titles)}>{entry=>entry.value(props)}</For>
}
