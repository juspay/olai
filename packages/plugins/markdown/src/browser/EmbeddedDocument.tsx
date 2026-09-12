/** Body-only document rendering, used by providers such as the journal. */
import { servedDirectory } from "./vault.ts"
import { TESTID } from "olai-plugin-markdown/testids"
import { proseIn } from "@olai/format"
import { createMemo, Show } from "solid-js"
import { Markdown } from "@olai/markdown-ui/Markdown.tsx"

import { isServed, useDocument } from "./document/documents.tsx"
import { BodyRefused } from "./document/BodyRefused.tsx"
export function EmbeddedDocument(props: {readonly file: string}) {
  const document = useDocument(() => props.file)
  const served = createMemo(() => { const entry = document(); return isServed(entry) ? entry : undefined })
  return <>
    <Show when={served()}>{entry => <Markdown claims={servedDirectory()?.claims()} source={proseIn(entry().text)} from={props.file} class="olai-md-compact" testid={TESTID.documentBody} />}</Show>
    <Show when={document()?.refused}><BodyRefused /></Show>
  </>
}
