/**
 * One document, as a page.
 *
 * Every `.md` under the served directory gets one, whether or not a node
 * attaches it: the directory is what is served, and a file in it that no
 * outline happens to name is still a file somebody put there to read. That is
 * also why the sidebar lists documents beside the outlines rather than only
 * under the nodes that point at them.
 *
 * The page is handed a PATH and reads the body itself (../document/documents.tsx),
 * which is the shape of the wire: the directory's paths are known to every tab,
 * and a body travels to the tab that opens it. So the heading is on screen the
 * moment the route resolves, and the text follows — one frame later on a fresh
 * open, not at all if the reader moves on first.
 *
 * The heading is the path, in the same voice a day page names its date: what
 * is IN the document is the document's own business, and a `# Title` on its
 * first line is about to render itself. The path is what the sidebar, the URL
 * and a `doc` field all call this page, so it is what the page calls itself.
 */

import { Show } from "solid-js"

import { Markdown } from "../markdown/Markdown.tsx"
import { TESTID } from "../testids.ts"
import { useDocument } from "./documents.tsx"

export function DocumentPage(props: { readonly file: string }) {
  const document = useDocument(() => props.file)

  return (
    <section data-testid={TESTID.documentPage} data-file={props.file}>
      <header class="mb-4">
        <h1 class="m-0 font-mono text-sm text-muted">{props.file}</h1>
      </header>
      {/* No placeholder: the body of a document this directory HAS is on its
          way, and a "reading…" line under a heading that is already drawn
          would be a spinner for one frame. A path the directory does not have
          never reaches this page — the page model answers that with its own
          screen (../page.ts). */}
      <Show when={document()}>
        {(served) => (
          <Markdown
            source={served().text}
            from={props.file}
            testid={TESTID.documentBody}
          />
        )}
      </Show>
    </section>
  )
}
