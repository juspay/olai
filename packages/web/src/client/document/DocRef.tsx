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
 *
 * IT DRAWS MARKDOWN, ALWAYS, and that is safe to assume rather than a case it
 * forgot: `doc` names a DOCUMENT, checked by the validator against the `.md`
 * files served (`@olai/format`'s `checkDocs`), so a node cannot attach the
 * `.html` beside it. That refusal is where this assumption is kept — a
 * membership test against the set's bodied files would have widened it, and
 * what arrives here would be markup drawn through the markdown pipeline. The
 * two shapes below are why the rule is that way round: one line of a file under
 * a row, and a whole file under a title, are neither of them a sealed frame
 * (./Hypertext.tsx).
 *
 * The inline shape is drawn under the zoomed node's own title, so it is set
 * like a note and not like a page: `olai-md-compact` clamps its headings
 * below that title, which is the same class `Note.tsx` adds for the same
 * reason. Without it a document opening with `# Title` draws that line at
 * exactly the size of the node title above it. The document's OWN page is the
 * other case and keeps the full scale — there is no title over it there.
 */

import { createMemo, Show } from "solid-js"

import { Markdown } from "../markdown/Markdown.tsx"
import { Link } from "../router.tsx"
import { TESTID } from "../testids.ts"
import { TARGET } from "../touch.ts"
import { useDocument } from "./documents.tsx"
import { firstLine } from "./preview.ts"

export function DocRef(props: {
  /** The document's path, resolved against the outline that named it. */
  readonly file: string
  /** Draw the whole document, not a line of it. */
  readonly inline?: boolean
}) {
  // The body is asked for HERE, by the row that is showing it — one narrowed
  // per-key subscription, shared with every other place drawing the same
  // document (./documents.tsx). What that costs is the documents DRAWN, never
  // the directory: a corpus of thousands is thousands of paths in the sidebar
  // and the bodies of what is on screen. The honest edge is that the preview
  // below is one line read out of a whole body, so an outline attaching
  // hundreds of documents at once pays for hundreds of them — the answer to
  // that is a preview on the wire, once something measures it needing one
  // (docs/brainstorming/surface-mcp-viewing.md). It is the same question the
  // `heads` member answered for a `.html` page: a reader that wants a small
  // fact about a file should be able to ask for the small fact. This one has
  // not been measured, and a `doc` naming a `.html` — which draws a line out
  // of a saved page nobody asked to see — is where it would bite first.
  const document = useDocument(() => props.file)
  // Two memos, and the first is why the second is cheap. Every frame the store
  // publishes mints a new entry, so a preview read off the record would
  // re-scan the file on every save to it; read off the TEXT, which is a string
  // and compares by value, it re-scans only when the body actually changed.
  const text = createMemo(() => document()?.text ?? "")
  const preview = createMemo(() => firstLine(text()))

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
          // A target where a finger is what taps it, a line of text where the
          // pointer is a mouse (../touch.ts).
          class={`inline-flex ${TARGET} items-center font-mono text-[0.8125rem] text-accent no-underline hover:underline md:min-h-0`}
          testid={TESTID.docLink}
          title="open this document"
        >
          {props.file}
        </Link>
        {/* The preview is the ELSEWHERE shape only: under the whole document,
            a line of it would be the same words twice. */}
        <Show when={props.inline !== true}>
          <span class="truncate text-muted">{preview()}</span>
        </Show>
      </div>

      <Show when={props.inline === true && document()}>
        {(served) => (
          <Markdown
            source={served().text}
            from={props.file}
            class="olai-md-compact mt-2"
            testid={TESTID.documentBody}
          />
        )}
      </Show>
    </div>
  )
}
