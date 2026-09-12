import { useDocumentReading } from "../reading.tsx"
import { servedDirectory } from "../vault.ts"
import { TESTID } from "olai-plugin-markdown/testids"
/** Markdown's page and editor. The path keys its draft; leaving another
 * capability does not dispose it. Properties and referrers use the metadata
 * reading, while the editor holds the current body as its write baseline. */

import { bodyKind, type Custom } from "@olai/format"
import { createMemo, onCleanup, Show } from "solid-js"

import { DeleteFile } from "../files.tsx"
import { Properties } from "../Properties.tsx"

import { DocEditor } from "./DocEditor.tsx"
import { Referrers } from "./Referrers.tsx"
import { isServed, useDocument } from "./documents.tsx"
import { Rendered } from "./Rendered.tsx"
import { consumeMinted } from "./minted.ts"
import { keepDraft, takeDraft } from "./drafts.ts"
import { useHere, useRouter } from "olai-plugin-navigation/routing"
import { panesOf } from "olai-plugin-navigation/workspace"

/**
 * A document page is a page OF A FILE, and this is what makes that true.
 *
 * KEYED, on the path and pane: without it, going from
 * one document to another is not a mount at all. The route's arm is a `<Match>`
 * whose condition is an object, and Solid compares those as booleans
 * (`!a === !b`), so the arm stays true across `/a.md` → `/b.md` and the
 * page below simply takes a new `file` prop. Everything {@link OneDocument}
 * decides ONCE — whether this document was just minted (and so opens editing),
 * and, through {@link DocEditor}, which file a draft and its `was` belong to —
 * would then be a decision about the file you have stopped reading. The second
 * of those is the sharp one: a draft that followed its typist onto another
 * document could be saved over it, and where the two texts happen to match
 * (two empty notes, two copies of one file) the `was` guard would let it.
 *
 * Phone tabs can reuse this component for the same file in another pane.
 * That pane has its own draft, so the pane is part of the identity too.
 * A different path or pane is a different editor. It is
 * keyed HERE rather than at the router's arm because it is this component's own
 * invariant: a caller that forgot would put the bug back, and callers should
 * not have to know. Same spelling as ./Toc.tsx one level down, for the same
 * reason and against the same defect.
 */

export function DocumentPage(props: {
  readonly file: string
  /** The named facts the file writes about itself — the page reading's
   *  `props`, which is the face's, so this page draws them without fetching
   *  the body. Empty when the file wrote none. */
  readonly custom: Custom
}) {
  const here = useHere()
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
  const reading = useDocumentReading()
  // The body is the editor's baseline and the reading face's text.
  const served = useDocument(() => props.file)
  const pane = useHere()()
  const router = useRouter()
  const route = panesOf(router.workspace())[pane]?.route
  const editor = takeDraft(props.file, pane, route)
  const editing = editor.editing
  if (consumeMinted(props.file)) editor.open()
  onCleanup(() => {
    // Navigation discards the departing editor as before. Rebuilding this
    // same pane keeps its draft, including when another tab changed plugins.
    const now = panesOf(router.workspace())[pane]?.route
    if (now?.kind === "at" && now.address !== null && "path" in now.address && now.address.path === props.file) {
      keepDraft(props.file, pane, now, editor)
    }
  })

  return (
    <section data-testid={TESTID.documentPage} data-file={props.file}>
      <header class="mb-8">
        <div class="flex flex-wrap items-baseline justify-between gap-2">
          <h1 class="m-0 max-w-full break-all font-mono text-sm tracking-tight text-muted">{props.file}</h1>
          {/* The control and the draft it opens read ONE value, so a page cannot
              offer an editor it has nothing to open: `served()` is both the
              condition here and the baseline below. The delete beside it reads
              the SAME condition — a file this page can EDIT is exactly a file
              the op's guards can judge (outlines get theirs beside Start, one
              page over), so neither control exists without the other. */}
          <Show when={isServed(served()) && !editing()}>
            {/* On narrow screens the controls get a full row and the
                confirmation wraps above its choices. The path and question
                must not push either choice outside the viewport. */}
            <div class="flex min-w-0 flex-1 basis-full flex-wrap items-baseline justify-end gap-2 sm:basis-auto">
              <button
                type="button"
                class="cursor-pointer rounded border border-rule bg-transparent px-2 py-0.5 text-[0.8125rem] text-muted hover:bg-rule/60 hover:text-ink"
                data-testid={TESTID.documentEdit}
                onClick={editor.open}
              >
                Edit
              </button>
              <DeleteFile file={props.file} />
            </div>
          </Show>
        </div>
        {/* THE RECORD, as the same run a node's own page draws — under the
            path, above the body. Hidden while editing, because the editor IS
            the YAML (and the prose), and two spellings of one block on one
            screen is the thing the drawer must not be. Honest absence when
            the file wrote none: the run draws nothing, like a row with no
            custom keys. */}
        <Show when={!editing()}>
          <Properties custom={props.custom} from={props.file} />
        </Show>
      </header>
      {/* The face is drawn the moment the route resolves — the heading and the
          file's own rendering are one mount — and what it draws from is its own
          to ask for (./faces.tsx). A path the directory does not have never
          reaches this page: the page model answers that with its own screen
          (../page.ts). */}
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
          />
        )}
      </Show>
      {/* WHO POINTS AT THIS FILE, under the body — the reverse reading a
          document could not have until it had a face (./Referrers.tsx). It is
          drawn whether the body has arrived or not, because it is a fact about
          the DIRECTORY rather than about what this file says: the faces are in
          hand from the first frame, and a section that waited on a body would
          be blank on exactly the saved page whose bytes never cross the
          wire. */}
      <Referrers file={props.file} reading={reading} claims={servedDirectory()?.claims()} href={router.routes.href} />
    </section>
  )
}
