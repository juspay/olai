import { inboxIn } from "@olai/format"
import { definePlugin } from "@olai/plugin-api"
import { createInboxHeld } from "@olai/web/client/inbox.ts"
import { Effect } from "effect"
import { navigation } from "olai-plugin-navigation/contract"
import { fileNamed } from "olai-plugin-navigation/routes"
import { regions,type SidebarRegionProps } from "olai-plugin-sidebar/contract"
import { rendererSlots } from "olai-plugin-ui-renderer/contract"
import { fileAccess } from "olai-plugin-vault/contract"
import { directory } from "olai-plugin-vault/file-state"
import { useServed } from "olai-plugin-vault/files"
import { createMemo,Show } from "solid-js"
import { Inbox } from "./Inbox.tsx"
import { capturePalette } from "./Palette.tsx"
function Entry(props: SidebarRegionProps & {active:()=>string|undefined}) {
 const count=createInboxHeld(); const served = useServed(); const inbox = createMemo(() => inboxIn(served()))
 return <Show when={inbox()}>{file => <Inbox file={file()} isActive={file => props.active() === file} broken={directory()?.broken().has(file()) === true} count={count().count}/>}</Show>
}
export const components={palette:capturePalette}
export default definePlugin({name:"capture", needs:[rendererSlots, navigation, fileAccess], apply:Effect.gen(function*(){
 const nav=yield* navigation
 yield* (yield* rendererSlots).contribute(regions, {at:"primary" as const, Body:props=><Entry {...props} active={()=>fileNamed(nav.route())??nav.focused()?.file}/>})
})})
