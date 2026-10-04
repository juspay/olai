import { createMemo, For, Show } from "solid-js"
import type { Route } from "olai-plugin-navigation/contract"
import { Markdown } from "@olai/markdown-ui/Markdown.tsx"
import { transcriptRows, sayingRows } from "../wire.ts"
import { chatWire } from "./wire.ts"
import type { Roster } from "./agents/answered.tsx"
import { createRows } from "./chat/order.ts"
import { createTail, grownText } from "./chat/growing.ts"
import { servedDirectory } from "./vault.ts"
import { LOOK } from "./agents/roster.ts"

export const previewNode = (route: Route) => route.kind === "at" &&
  (route.address?.kind === "node" || route.address?.kind === "row") ? route.address.id : undefined

/** A read-only wire lease: no conversation UI, wake, visit or composer is
 * acquired by hovering. The roster is already owned by chat's activation. */
export function ChatLinkPreview(props: { readonly route: Route; readonly roster: Roster }) {
  // LinkPreview.Preview guarantees one immutable route per mount.
  const node = previewNode(props.route)!
  const id = () => node
  const transcript = chatWire().streams.transcript.useCollection({ node: id() }, transcriptRows)
  const tail = createTail(chatWire().streams.saying.useCollection({ node: id() }, sayingRows).fold)
  const ordered = createRows(transcript.fold)
  const keys = createMemo(() => {
    const messages = ordered.keys().filter(key => {
      const row = transcript.byKey(key)?.()
      return row?.kind === "user" || row?.kind === "agent"
    })
    // Two turns, including all assistant paragraphs belonging to each prompt.
    let turns = 0
    for (let at = messages.length - 1; at >= 0; at--) {
      if (transcript.byKey(messages[at]!)?.()?.kind === "user" && ++turns === 2) return messages.slice(at)
    }
    return messages
  })
  return <>
    <div class="text-xs text-muted">{props.roster.at(id())?.file} › Chat</div>
    <strong>{props.roster.at(id())?.title ?? `#${id()}`}</strong>
    <Show when={props.roster.at(id())}>{row => <span class="ml-2 rounded border border-rule/60 px-1 text-xs">{LOOK[row().standing].label}</span>}</Show>
    <div class="mt-2 space-y-2"><For each={keys()}>{key => {
      const row = () => transcript.byKey(key)?.()
      const text = () => {
        const entry = row(), latest = tail.tail()
        return entry ? latest && tail.of() === key ? grownText(entry, latest) : entry.text : ""
      }
      return <div class="text-sm"><span class="text-xs text-muted">{row()?.kind === "user" ? "You" : "Agent"}</span>
        <Markdown claims={servedDirectory()?.claims()} members={servedDirectory()?.members()} from="" source={text()} class="olai-md-compact line-clamp-3" />
      </div>
    }}</For></div>
    <Show when={keys().length === 0}><p class="text-sm text-muted">No turns yet.</p></Show>
  </>
}
