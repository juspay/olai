/** Dispatch registered content. A missing capability leaves its address in
 * history, with a readable empty seat; another content provider remains live. */
import { content } from "olai-plugin-navigation/contract"
import { useHere,useRouter } from "olai-plugin-navigation/routing"
import { panesOf } from "olai-plugin-navigation/workspace"
import {readLocation} from "olai-plugin-ui-renderer/contract"
import { createMemo,Show } from "solid-js"
export function PageView() {
  const router = useRouter(), here = useHere()
  const route = createMemo(() => panesOf(router.workspace())[here()]!.route)
  const handler = createMemo(() => readLocation(content).find(({value}) => value.matches(route()))?.value)
  return <Show when={handler()} keyed fallback={<p class="p-8 text-muted">No enabled content provider handles this address.</p>}>{entry => <entry.Page route={route()} index={here()} />}</Show>
}
