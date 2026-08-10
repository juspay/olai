/**
 * One document, as a page.
 *
 * Every `.md` under the served directory gets one, whether or not a node
 * attaches it: the directory is what is served, and a file in it that no
 * outline happens to name is still a file somebody put there to read. That is
 * also why the sidebar lists documents beside the outlines rather than only
 * under the nodes that point at them.
 *
 * The heading is the path, in the same voice a day page names its date: what
 * is IN the document is the document's own business, and a `# Title` on its
 * first line is about to render itself. The path is what the sidebar, the URL
 * and a `doc` field all call this page, so it is what the page calls itself.
 */

import type { Document } from "@olai/format"

import { Markdown } from "../markdown/Markdown.tsx"
import { TESTID } from "../testids.ts"

export function DocumentPage(props: { readonly document: Document }) {
  return (
    <section data-testid={TESTID.documentPage} data-file={props.document.file}>
      <header class="mb-4">
        <h1 class="m-0 font-mono text-sm text-muted">{props.document.file}</h1>
      </header>
      <Markdown
        source={props.document.text}
        from={props.document.file}
        testid={TESTID.documentBody}
      />
    </section>
  )
}
