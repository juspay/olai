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
 *
 * A CONTENTS rides above the body (./Toc.tsx), and it is derived from the same
 * rendering: `outlineOf` reads the heading tree out of the memo `<Markdown>` is
 * about to draw from, on the same key, so surveying a document costs no second
 * pass and nothing on the wire. It arrives when the BODY does, for the same
 * reason the body does — there is nothing to make a contents out of until then.
 *
 * AND IT BECOMES WRITABLE, by a declared mode rather than a click in the
 * prose: the body is rendered markdown full of links a reader is entitled to
 * follow, so a click that went to a caret would delete the reading surface to
 * save a press — the note editor's argument, landing on the other side at this
 * size. Edit turns the body into its source and hands the rest to
 * {@link DocEditor}, which owns the draft, the conflict story and the two
 * chords. A document that was MINTED a moment ago (the sidebar's path box, a
 * bare calendar day) opens editing — that is `./minted.ts`'s one-shot — since
 * an empty page with the affordance one more click away is not what "start
 * writing" means.
 */

import { createMemo, createSignal, Show } from "solid-js"

import { markdownReady } from "../markdown/chunk.ts"
import { Markdown } from "../markdown/Markdown.tsx"
import { outlineOf } from "../markdown/render.ts"
import { TESTID } from "../testids.ts"
import { DocEditor } from "./DocEditor.tsx"
import { useDocument } from "./documents.tsx"
import { consumeMinted } from "./minted.ts"
import { Toc } from "./Toc.tsx"

/**
 * A document page is a page OF A FILE, and this is what makes that true.
 *
 * KEYED, on the path, and it is not belt-and-braces: without it, going from
 * one document to another is not a mount at all. The route's arm is a `<Match>`
 * whose condition is an object, and Solid compares those as booleans
 * (`!a === !b`), so the arm stays true across `/doc/a.md` → `/doc/b.md` and the
 * page below simply takes a new `file` prop. Everything {@link OneDocument}
 * decides ONCE — whether this document was just minted (and so opens editing),
 * and, through {@link DocEditor}, which file a draft and its `was` belong to —
 * would then be a decision about the file you have stopped reading. The second
 * of those is the sharp one: a draft that followed its typist onto another
 * document could be saved over it, and where the two texts happen to match
 * (two empty notes, two copies of one file) the `was` guard would let it.
 *
 * So identity is the PATH, and a different path is a different page. It is
 * keyed HERE rather than at the router's arm because it is this component's own
 * invariant: a caller that forgot would put the bug back, and callers should
 * not have to know. Same spelling as ./Toc.tsx one level down, for the same
 * reason and against the same defect.
 */
export function DocumentPage(props: { readonly file: string }) {
  return (
    <Show when={props.file} keyed>
      {(file) => <OneDocument file={file} />}
    </Show>
  )
}

function OneDocument(props: { readonly file: string }) {
  const document = useDocument(() => props.file)
  // Fresh per page mount — and a page is one FILE (see above), so navigating
  // anywhere else, another document included, closes the editor and the draft
  // goes with it: a draft is an editor's, never a file's.
  const [editing, setEditing] = createSignal(consumeMinted(props.file))

  return (
    <section data-testid={TESTID.documentPage} data-file={props.file}>
      <header class="mb-4 flex items-baseline justify-between gap-2">
        <h1 class="m-0 font-mono text-sm text-muted">{props.file}</h1>
        <Show when={document() !== undefined && !editing()}>
          <button
            type="button"
            class="cursor-pointer rounded border border-rule bg-transparent px-2 py-0.5 text-[0.8125rem] text-muted hover:bg-rule/60 hover:text-ink"
            data-testid={TESTID.documentEdit}
            onClick={() => setEditing(true)}
          >
            Edit
          </button>
        </Show>
      </header>
      {/* No placeholder: the body of a document this directory HAS is on its
          way, and a "reading…" line under a heading that is already drawn
          would be a spinner for one frame. A path the directory does not have
          never reaches this page — the page model answers that with its own
          screen (../page.ts). */}
      <Show when={document()}>
        {(served) => (
          <Show
            when={editing()}
            fallback={<Rendered file={props.file} text={served().text} />}
          >
            <DocEditor
              file={props.file}
              served={served().text}
              onDone={() => setEditing(false)}
            />
          </Show>
        )}
      </Show>
    </section>
  )
}

/** The reading face: the contents, then the body — exactly what the page was
 *  before it could edit, in a component so the mode switch above stays one
 *  `Show` rather than two trees interleaved. */
function Rendered(props: { readonly file: string; readonly text: string }) {
  // Empty until the markdown chunk lands, for the same reason the body is the
  // file's own text until then: there is nothing to make a contents out of
  // until something has read the headings. The `<Markdown>` under it is what
  // asks for the chunk; this memo re-runs when it arrives (../markdown/chunk.ts).
  const headings = createMemo(() =>
    markdownReady() ? outlineOf(props.text, props.file) : [],
  )
  return (
    <>
      <Toc file={props.file} headings={headings()} />
      <Markdown
        source={props.text}
        from={props.file}
        testid={TESTID.documentBody}
      />
    </>
  )
}
