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
import { PAGE_INSET } from "olai-plugin-layout/clearance"
export function Status(props: { readonly served: Directory }) {
 const errors=client().cells.errors.use()
 const problems=()=>errors.value()??NOTHING_WRONG
 const trouble=()=>troubleIn(props.served.broken(),problems())
 return <Show when={props.served.standing()==="loaded"} fallback={
   <Show when={props.served.standing()==="never"} fallback={<p class={`${PAGE_INSET} text-muted`}>Loading…</p>}>
     <Page verdict={problems()} />
   </Show>
 }><Show when={trouble()}>{it=><div class={PAGE_INSET}><Banner trouble={it()}/></div>}</Show></Show>
}
