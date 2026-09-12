/** The served directory is HANDED IN by the component that declared
 *  `vault.files`, rather than read out of a module signal this row's other
 *  activation happened to have set (`./state.ts`). */
import { Show } from "solid-js"
import { NOTHING_WRONG } from "@olai/format"
import { client } from "../client.ts"
import { Page } from "./errors/Page.tsx"
import { Banner } from "./errors/Banner.tsx"
import { troubleIn } from "./errors/banner.ts"
import type { Directory } from "./state.ts"
export function Status(props: { readonly served: Directory }) {
 const errors=client().cells.errors.use()
 const problems=()=>errors.value()??NOTHING_WRONG
 const trouble=()=>troubleIn(props.served.broken(),problems())
 return <Show when={props.served.standing()==="loaded"} fallback={
   <Show when={props.served.standing()==="never"} fallback={<p class="p-8 text-muted">Reading…</p>}>
     <Page verdict={problems()} />
   </Show>
 }><Show when={trouble()}>{it=><div class="px-4 pt-4 md:px-12 lg:pl-16"><Banner trouble={it()}/></div>}</Show></Show>
}
