/**
 * The day's own note, at the top of the day.
 *
 * A document whose basename is the date IS that day's note (`@olai/format`'s
 * `noteDateOf`), and this is what that means on screen: the file's own
 * Markdown, in full, through the same pipeline every other rendering on this
 * page goes through — because it is the same language, and a second way of
 * drawing a `.md` would be a second dialect for the one file a person writes in
 * every day.
 *
 * FIRST, above the dated nodes, and that ordering is the composition: what
 * somebody wrote about the day is the day's own account of itself, and the
 * query's answer — the nodes that happen to carry this date — reads as the
 * record beneath it. Neither replaces the other, which is the whole of the
 * amendment to "the journal is a query": a day with a note and no nodes is a
 * page of prose, a day with nodes and no note is exactly the page it was
 * before, and a day with neither is still inert.
 *
 * The heading is the PATH and it is a link to `/<path>`, in the same voice
 * the day page names its date and a document page names itself: what is IN the
 * file is about to render itself, and the path is what the sidebar, the URL and
 * this heading all agree to call it. The link is the way from the day to the
 * document's own page, where the contents and the full scale are.
 *
 * No TABLE OF CONTENTS, for the reason the document drawn under a zoomed node
 * has none: a contents belongs to a document's own page, and this is a day's.
 * And the body is set `olai-md-compact`, like a note and like that inline
 * document, because a `# Heading` on the first line of a daily note would
 * otherwise be drawn larger than the date at the top of the page.
 */

import { Show } from "solid-js"

import { useDocument } from "../document/documents.tsx"
import { Markdown } from "../markdown/Markdown.tsx"
import { Link } from "../router.tsx"
import { TESTID } from "../testids.ts"
import { atFile } from "../routes.ts"

export function DayNote(props: { readonly file: string }) {
  // The body is asked for by the page SHOWING it, exactly as a `doc` reference
  // asks (../document/documents.tsx): one narrowed subscription per path, and
  // it stops arriving when the reader leaves the day.
  const document = useDocument(() => props.file)

  return (
    <section class="mb-6" data-testid={TESTID.dayNote} data-file={props.file}>
      <h2 class="m-0 mb-2 font-mono text-xs text-muted">
        <Link
          route={atFile(props.file)}
          class="text-muted no-underline hover:text-ink hover:underline"
          testid={TESTID.dayNoteLink}
          title="open this document"
        >
          {props.file}
        </Link>
      </h2>
      {/* No placeholder: the body of a document this directory HAS is on its
          way, and the day below it is already drawn. */}
      <Show when={document()}>
        {(served) => (
          <Markdown
            source={served().text}
            from={props.file}
            class="olai-md-compact"
            testid={TESTID.documentBody}
          />
        )}
      </Show>
    </section>
  )
}
