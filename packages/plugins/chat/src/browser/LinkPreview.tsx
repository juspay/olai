import { createMemo, For, Show } from "solid-js"
import type { Route } from "olai-plugin-navigation/contract"
import { Markdown } from "@olai/markdown-ui/Markdown.tsx"
import { transcriptRows, sayingRows } from "../wire.ts"
import { chatWire } from "./wire.ts"
import type { Roster } from "./agents/answered.tsx"
import { useRows } from "./chat/order.ts"
import { createTail, grownText } from "./chat/growing.ts"
import { servedDirectory } from "./vault.ts"
import { LOOK } from "./agents/roster.ts"
import { itemKey } from "@olai/format"
import { chatPage } from "./agents/route.ts"

export const previewNode = (route: Route) => {
  const chat = chatPage.value(route)
  if (chat !== null) return itemKey(chat)
  return route.kind === "at" && (route.address?.kind === "node" || route.address?.kind === "row")
    ? route.address.id : undefined
}

export function ChatLinkPreview(props: { readonly route: Route; readonly roster: Roster }) {
  const node = previewNode(props.route)!
  const transcript = chatWire().streams.transcript.useCollection({ node }, transcriptRows)
  const tail = createTail(chatWire().streams.saying.useCollection({ node }, sayingRows).fold)
  const ordered = useRows(transcript.fold)
  const keys = createMemo(() => {
    const messages = ordered.keys().filter(key => {
      const row = transcript.byKey(key)?.()
      return row?.kind === "user" || row?.kind === "agent"
    })
    let turns = 0
    for (let at = messages.length - 1; at >= 0; at--) {
      if (transcript.byKey(messages[at]!)?.()?.kind === "user" && ++turns === 2) return messages.slice(at)
    }
    return messages
  })
  return <>
    <div class="text-xs text-muted">{props.roster.at(node)?.file} › Chat</div>
    <strong>{(() => { const row = props.roster.at(node); return row === undefined ? `#${node}` : props.roster.named(row).name })()}</strong>
    <Show when={props.roster.at(node)}>{row => <span class="ml-2 rounded border border-rule/60 px-1 text-xs">{LOOK[row().standing].label}</span>}</Show>
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
