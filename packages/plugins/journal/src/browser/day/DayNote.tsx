import { For, Show } from "solid-js"
import { documentBodies } from "olai-plugin-markdown/contract"
import { readLocation } from "../locations.ts"
import { Link } from "olai-plugin-navigation/routing"
import { atFile } from "olai-plugin-navigation/routes"
import { TESTID } from "../../testids.ts"
export function DayNote(props: {readonly file: string}) {
  return <Show when={readLocation(documentBodies).length > 0}>
    <section class="mb-6" data-testid={TESTID.dayNote} data-file={props.file}>
      <h2 class="m-0 mb-2 font-mono text-label text-muted">
        <Link route={atFile(props.file)} class="text-muted no-underline hover:text-ink hover:underline" testid={TESTID.dayNoteLink} tip="Open document">{props.file}</Link>
      </h2>
      <For each={readLocation(documentBodies)}>{entry => entry.value({get file() {return props.file}})}</For>
    </section>
  </Show>
}
