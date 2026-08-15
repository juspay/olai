/**
 * One file with a BODY, as a page.
 *
 * Every `.md` under the served directory gets one, whether or not a node
 * attaches it: the directory is what is served, and a file in it that no
 * outline happens to name is still a file somebody put there to read. That is
 * also why the sidebar lists documents beside the outlines rather than only
 * under the nodes that point at them.
 *
 * A `.html` gets the same page for the same reason — it is a file in somebody's
 * directory, and this is the address a file that is read rather than edited has
 * (`../routes.ts` argues the prefix). What differs between the two is the BODY
 * and nothing else: the heading, the "no such file" screen, the keying below
 * and the way a body arrives are one page, and which face draws the body is one
 * table (./faces.tsx). A page per kind would have been four copies of the parts
 * that are the same, and the first one to drift would do it silently.
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

import { bodyKind } from "@olai/format"
import { createSignal, Show } from "solid-js"
import { Dynamic } from "solid-js/web"

import { TESTID } from "../testids.ts"
import { DocEditor } from "./DocEditor.tsx"
import { useDocument } from "./documents.tsx"
import { FACES } from "./faces.tsx"
import { consumeMinted } from "./minted.ts"

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
  // WHICH FACE, off the file's own name — the format's registry answers what
  // kind of body this is, and ./faces.tsx answers what that kind looks like and
  // whether it can be written. A path this page model let through is a file the
  // directory HOLDS, so it is a bodied kind by construction; the fallback is
  // the markdown one because that is what a `/doc/` address meant before there
  // was a second kind, and a blank page would be a worse answer than a
  // rendering of the text.
  const face = () => FACES[bodyKind(props.file) ?? "document"]
  // Fresh per page mount — and a page is one FILE (see above), so navigating
  // anywhere else, another document included, closes the editor and the draft
  // goes with it: a draft is an editor's, never a file's.
  const [editing, setEditing] = createSignal(consumeMinted(props.file))

  return (
    <section data-testid={TESTID.documentPage} data-file={props.file}>
      <header class="mb-4 flex items-baseline justify-between gap-2">
        <h1 class="m-0 font-mono text-sm text-muted">{props.file}</h1>
        <Show when={face().edits && document() !== undefined && !editing()}>
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
            fallback={
              /* `<Dynamic>` because the component genuinely arrives at RUNTIME
                 — which kind of file this is, is a fact about the path (the
                 primitive's own rule, stated beside `../menu/NodeMenu.tsx`'s).
                 Calling `face().reads(…)` with a plain object instead would
                 hand it a dead `text`: Solid compiles JSX props into getters,
                 and a document rewritten on disk reaches an open page through
                 exactly that. */
              <Dynamic component={face().reads} file={props.file} text={served().text} />
            }
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
