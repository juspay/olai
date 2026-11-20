import { usePaneId } from "olai-plugin-navigation/routing"
import { useDocumentReading } from "../reading.tsx"
import { servedDirectory } from "../vault.ts"
import { TESTID } from "olai-plugin-markdown/testids"
import { bodyKind, type Custom } from "@olai/format"
import { createMemo, createSignal, Show } from "solid-js"

import { DeleteFile } from "../files.tsx"
import { Properties } from "../Properties.tsx"
import { NoteLine } from "../NoteLine.tsx"

import { DocEditor } from "./DocEditor.tsx"
import { Referrers } from "./Referrers.tsx"
import { isServed, useDocument, useDocumentEditor } from "./documents.tsx"
import { Rendered } from "./Rendered.tsx"
import { consumeMinted } from "./minted.ts"
import { referrersMemory } from "../memory.ts"

import { useRouter } from "olai-plugin-navigation/routing"

/** Solid compares a `<Match>` condition object as a boolean (`!a === !b`), so the
 * route's arm stays true across `/a.md` → `/b.md` and this page is not remounted.
 * Keyed on file and pane so that it is. */

export function DocumentPage(props: {
  readonly file: string
  readonly custom: Custom
}) {
  const here = usePaneId()
  const identity = createMemo(() => ({ file: props.file, pane: here() }), undefined, {
    equals: (a, b) => a.file === b.file && a.pane === b.pane,
  })
  return (
    <Show when={identity()} keyed>
      {({ file }) => <OneDocument file={file} custom={props.custom} />}
    </Show>
  )
}

function OneDocument(props: { readonly file: string; readonly custom: Custom }) {
  const [nudge, setNudge] = createSignal<string | null>(null)
  const reading = useDocumentReading()
  const served = useDocument(() => props.file)
  const pane = usePaneId()()
  const router = useRouter()
  const editor = useDocumentEditor(pane, props.file)
  const editing = editor.editing
  if (consumeMinted(props.file)) editor.open()


  return (
    <section data-testid={TESTID.documentPage} data-file={props.file}>
      <header class="mb-6">
        <div class="flex flex-wrap items-baseline justify-between gap-2">
          <h1 class="m-0 max-w-full break-all font-mono text-label tracking-tight text-muted">{props.file}</h1>
          <Show when={isServed(served()) && !editing()}>
            {/* The path and question must not push either choice outside the
                viewport. */}
            <div class="flex min-w-0 flex-1 basis-full flex-wrap items-baseline justify-end gap-2 sm:basis-auto">
              <button
                type="button"
                class="cursor-pointer rounded-control border border-rule bg-transparent px-2 py-0.5 text-label text-muted hover:bg-ink/5 hover:text-ink"
                data-testid={TESTID.documentEdit}
                onClick={editor.open}
              >
                Edit
              </button>
              <DeleteFile file={props.file} />
            </div>
          </Show>
        </div>
        <NoteLine file={props.file} />
        {/* Hidden while editing, because the editor IS the YAML (and the
            prose), and two spellings of one block on one screen is the thing
            the drawer must not be. */}
        <Show when={!editing()}>
          <Properties custom={props.custom} from={props.file} />
        </Show>
      </header>
      <Show
        when={editing() && isServed(served()) ? served() : undefined}
        fallback={
          <Rendered file={props.file} />
        }
      >
        {(body) => (
          <DocEditor
            file={props.file}
            served={body().text ?? ""}
            draft={editor.draft(body().text ?? "")}
            onDone={editor.close}
            onNudge={setNudge}
          />
        )}
      </Show>
      <Show when={nudge()}>{text => <div data-testid={TESTID.documentNudge} class="text-label text-alarm">{text()}</div>}</Show>
      <Referrers file={props.file} reading={reading} claims={servedDirectory()?.claims()} href={router.routes.href} memory={referrersMemory.read()!} />
    </section>
  )
}
