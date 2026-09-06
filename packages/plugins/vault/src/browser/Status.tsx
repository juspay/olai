import { Show } from "solid-js"
import { NOTHING_WRONG } from "@olai/format"
import { client } from "olai-plugin-vault/client"
import { Page } from "./errors/Page.tsx"
import { Banner } from "./errors/Banner.tsx"
import { troubleIn } from "./errors/banner.ts"
import { directory } from "./state.ts"
export function Status() {
 const errors=client().cells.errors.use()
 const problems=()=>errors.value()??NOTHING_WRONG
 const trouble=()=>troubleIn(directory()?.broken()??new Map(),problems())
 return <Show when={directory()?.standing()==="loaded"} fallback={
   <Show when={directory()?.standing()==="never"} fallback={<p class="p-8 text-muted">Reading…</p>}>
     <Page verdict={problems()} />
   </Show>
 }><Show when={trouble()}>{it=><div class="px-4 pt-4 md:px-12 lg:pl-16"><Banner trouble={it()}/></div>}</Show></Show>
}
