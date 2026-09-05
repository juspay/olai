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
 * THE RECORD rides under that heading, as the same dim `key value` run a
 * node's own page draws (`../props/PropsDrawer.tsx`). A page about a document
 * is where its frontmatter is read — search rows already carried it, the
 * editor is the YAML, and hiding the block from the render (#302) left this
 * page drawing it nowhere. Empty is the honest none: a file that wrote no
 * block looks the way it did before there were properties. The run is off
 * while the editor is open, because the editor is the block, and two
 * spellings of one record on one screen is what the drawer exists not to be.
 *
 * A CONTENTS rides above the body (./Toc.tsx), and it is derived from the same
 * rendering: `outlineOf` reads the heading tree out of the memo `<Markdown>` is
 * about to draw from, on the same key, so surveying a document costs no second
 * pass and nothing on the wire. It arrives when the BODY does, for the same
 * reason the body does — there is nothing to make a contents out of until then.
 *
 * WHAT POINTS AT IT rides under the body (./Referrers.tsx), which is the half
 * of a page a document has not had: every reference on disk points one way, so
 * "what is talking about this file?" was a question nothing could answer until
 * a document travelled with the addresses it points AT and every other one did
 * too (`@olai/format`'s `Face`).
 *
 * AND IT BECOMES WRITABLE, by a declared mode rather than a click in the
 * prose: the body is rendered markdown full of links a reader is entitled to
 * follow, so a click that went to a caret would delete the reading surface to
 * save a press — the note editor's argument, landing on the other side at this
 * size. Edit turns the body into its source and hands the rest to
 * {@link DocEditor}, which owns the draft, the conflict story and the two
 * chords. A document that was MINTED a moment ago (the sidebar's path box, the
 * day page's + day note) opens editing — that is `./minted.ts`'s one-shot — since
 * an empty page with the affordance one more click away is not what "start
 * writing" means.
 */

import { bodyKind, type Custom } from "@olai/format"
import { createMemo, onCleanup, Show } from "solid-js"
import { Dynamic } from "solid-js/web"

import { DeleteFile } from "../file/DeleteFile.tsx"
import { customEntries } from "../props/drawer.ts"
import { PropsDrawer } from "../props/PropsDrawer.tsx"
import { TESTID } from "../testids.ts"
import { DocEditor } from "./DocEditor.tsx"
import { Referrers } from "./Referrers.tsx"
import { isServed, useDocument } from "./documents.tsx"
import { FACES } from "./faces.tsx"
import { consumeMinted } from "./minted.ts"
import { keepDraft, takeDraft } from "./drafts.ts"
import { useHere, useRouter } from "../router.tsx"
import { panesOf } from "../workspace.ts"

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
  // WHICH FACE, off the file's own name — the format's registry answers what
  // kind of body this is, and ./faces.tsx answers what that kind looks like,
  // whether it can be written, and what this page must have before it draws
  // one. A path this page model let through is a file the directory HOLDS, so
  // it is a bodied kind by construction; the fallback is the markdown one
  // because that is what a document's address meant before there was a second
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
          <PropsDrawer entries={customEntries(props.custom)} from={props.file} />
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
      <Referrers file={props.file} />
    </section>
  )
}
