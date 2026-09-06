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
 * before, and a day with neither says so and offers + day note.
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

import { For, Show } from "solid-js"
import { documentBodies } from "olai-plugin-markdown/contract"
import { readLocation } from "olai-plugin-ui-renderer/contract"
import { Link } from "olai-plugin-navigation/routing"
import { atFile } from "olai-plugin-navigation/routes"
import { TESTID } from "../../testids.ts"
export function DayNote(props: {readonly file: string}) {
  return <Show when={readLocation(documentBodies).length > 0}>
    <section class="mb-6" data-testid={TESTID.dayNote} data-file={props.file}>
      <h2 class="m-0 mb-2 font-mono text-xs text-muted">
        <Link route={atFile(props.file)} class="text-muted no-underline hover:text-ink hover:underline" testid={TESTID.dayNoteLink} title="open this document">{props.file}</Link>
      </h2>
      <For each={readLocation(documentBodies)}>{entry => entry.value({get file() {return props.file}})}</For>
    </section>
  </Show>
}
