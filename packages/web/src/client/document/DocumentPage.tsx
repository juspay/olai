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
 * The page is handed a PATH and hands that path on, which is the shape of the
 * wire: the directory's paths are known to every tab, and what a file SAYS
 * travels to the reader who opens it. So the heading is on screen the moment
 * the route resolves, and what is in the file follows — one frame later on a
 * fresh open, not at all if the reader moves on first.
 *
 * WHAT IT ASKS THE WIRE FOR is the body, and only because of the EDITOR: a
 * draft is a change to a text, judged against the text it was read from, so
 * this page has to be holding one to open a caret over it. The reading faces
 * ask for themselves (./faces.tsx) — the markdown one for the document's body,
 * the hypertext one for the revision that says the file moved, its frame having
 * fetched the file over HTTP already. So a page whose face cannot be written
 * opens no body at all, which is what stopped a previewed saved page crossing
 * the wire twice with the first copy gating the second (PR #206's deferral).
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
  // WHICH FACE, off the file's own name — the format's registry answers what
  // kind of body this is, and ./faces.tsx answers what that kind looks like,
  // whether it can be written, and what this page must have before it draws
  // one. A path this page model let through is a file the directory HOLDS, so
  // it is a bodied kind by construction; the fallback is the markdown one
  // because that is what a `/doc/` address meant before there was a second
  // kind, and a blank page would be a worse answer than a rendering of the
  // text.
  const face = () => FACES[bodyKind(props.file) ?? "document"]
  // THE BODY, AND ONLY FOR A PAGE THAT MIGHT WRITE IT — the draft below is a
  // change to a text, judged against the text it was read from, so the editor
  // is the one thing here that cannot be given the file and left to fetch what
  // it draws. A face that does not edit names no file, so no per-key
  // subscription opens, the server is never told this reader opened the file,
  // and a saved page's bytes stay on the disk its frame fetches them from over
  // HTTP. That is what a `.html` preview costs this tab: nothing
  // (./documents.tsx, and ./faces.tsx's `edits`).
  const served = useDocument(() => (face().edits ? props.file : undefined))
  // Fresh per page mount — and a page is one FILE (see above), so navigating
  // anywhere else, another document included, closes the editor and the draft
  // goes with it: a draft is an editor's, never a file's.
  const [editing, setEditing] = createSignal(consumeMinted(props.file))

  return (
    <section data-testid={TESTID.documentPage} data-file={props.file}>
      <header class="mb-4 flex items-baseline justify-between gap-2">
        <h1 class="m-0 font-mono text-sm text-muted">{props.file}</h1>
        {/* The control and the draft it opens read ONE value, so a page cannot
            offer an editor it has nothing to open: `served()` is both the
            condition here and the baseline below. */}
        <Show when={served() !== undefined && !editing()}>
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
      {/* The face is drawn the moment the route resolves — the heading and the
          file's own rendering are one mount — and what it draws from is its own
          to ask for (./faces.tsx). A path the directory does not have never
          reaches this page: the page model answers that with its own screen
          (../page.ts). */}
      <Show
        when={editing() ? served() : undefined}
        fallback={
          /* `<Dynamic>` because the component genuinely arrives at RUNTIME —
             which kind of file this is, is a fact about the path (the
             primitive's own rule, stated beside `../menu/NodeMenu.tsx`'s).
             Calling `face().reads(…)` with a plain object instead would hand it
             a dead `file`: Solid compiles JSX props into getters, and this page
             is keyed on the path, so the two agree only through one. */
          <Dynamic component={face().reads} file={props.file} />
        }
      >
        {(body) => (
          <DocEditor
            file={props.file}
            served={body().text}
            onDone={() => setEditing(false)}
          />
        )}
      </Show>
    </section>
  )
}
