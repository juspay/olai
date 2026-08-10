/**
 * A node's `doc`, wherever that node is drawn.
 *
 * Two shapes, and which one you get is a property of the page rather than of
 * the node: ZOOMED on the node, the document is the rest of the page and is
 * drawn in full under the note, because that is what the node was saying —
 * "the rest is in the file". Anywhere else the node is one row among many, so
 * it shows the file's name and the document's first line, and the name is the
 * link to the document's own page.
 *
 * Both carry the same `data-doc`: the RESOLVED path, which is the thing the
 * `doc` field means once the outline it was written in is taken into account.
 */

import { Show } from "solid-js"

import { Markdown } from "../markdown/Markdown.tsx"
import { Link } from "../router.tsx"
import { TESTID } from "../testids.ts"
import { useDocument } from "./documents.tsx"
import { firstLine } from "./preview.ts"

export function DocRef(props: {
  /** The document's path, resolved against the outline that named it. */
  readonly file: string
  /** Draw the whole document, not a line of it. */
  readonly inline?: boolean
}) {
  const document = useDocument(() => props.file)

  return (
    <div
      class="mt-1"
      data-testid={TESTID.docRef}
      data-doc={props.file}
      data-inline={props.inline === true ? "true" : undefined}
    >
      <div class="flex items-baseline gap-2 text-sm">
        <Link
          route={{ kind: "document", file: props.file }}
          class="font-mono text-[0.8125rem] text-accent no-underline hover:underline"
          testid={TESTID.docLink}
          title="open this document"
        >
          {props.file}
        </Link>
        {/* The preview is the ELSEWHERE shape only: under the whole document,
            a line of it would be the same words twice. */}
        <Show when={props.inline !== true}>
          <span class="truncate text-muted">{firstLine(document()?.text ?? "")}</span>
        </Show>
      </div>

      <Show when={props.inline === true && document()}>
        {(served) => (
          <Markdown
            source={served().text}
            from={served().file}
            class="mt-2"
            testid={TESTID.documentBody}
          />
        )}
      </Show>
    </div>
  )
}
