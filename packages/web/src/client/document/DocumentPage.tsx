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
 * WHAT IT ASKS THE WIRE FOR IS NOTHING. Every face asks for what it draws from
 * (./faces.tsx) — the markdown one for the document's body, the hypertext one
 * for the revision that says the file moved, its frame having fetched the file
 * over HTTP already — so a kind's cost on the wire is a fact about that kind
 * and a page cannot pay it twice. That is what stopped a previewed saved page
 * crossing the wire with the first copy gating the second (PR #206's deferral),
 * and it is what let this page stop holding a body of its own when the editor
 * became the face rather than a mode over it.
 *
 * The heading is the path, in the same voice a day page names its date: what
 * is IN the document is the document's own business, and a `# Title` on its
 * first line is about to render itself. The path is what the sidebar, the URL
 * and a `doc` field all call this page, so it is what the page calls itself.
 *
 * THE BODY OF A `.md` IS AN EDITOR, and there is no verb on this page to make
 * it one: it is mounted READING and a click in the prose puts the caret where
 * the finger went (`./DocEditor.tsx`, which owns the contents, the draft, the
 * autosave and the conflict story). So the header carries the path and nothing
 * else — the Edit control that used to sit in it went with the mode it opened.
 */

import { bodyKind } from "@olai/format"
import { Show } from "solid-js"
import { Dynamic } from "solid-js/web"

import { TESTID } from "../testids.ts"
import { FACES } from "./faces.tsx"

/**
 * A document page is a page OF A FILE, and this is what makes that true.
 *
 * KEYED, on the path, and it is not belt-and-braces: without it, going from
 * one document to another is not a mount at all. The route's arm is a `<Match>`
 * whose condition is an object, and Solid compares those as booleans
 * (`!a === !b`), so the arm stays true across `/doc/a.md` → `/doc/b.md` and the
 * page below simply takes a new `file` prop. Everything the face below decides
 * ONCE — whether this document was just minted (and so opens with the caret in
 * it), and which file a draft and its `was` belong to — would then be a
 * decision about the file you have stopped reading. The second of those is the
 * sharp one: a draft that followed its typist onto another document could be
 * saved over it, and where the two texts happen to match (two empty notes, two
 * copies of one file) the `was` guard would let it.
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
  // kind of body this is, and ./faces.tsx answers what that kind looks like. A
  // path this page model let through is a file the directory HOLDS, so it is a
  // bodied kind by construction; the fallback is the markdown one because that
  // is what a `/doc/` address meant before there was a second kind, and a blank
  // page would be a worse answer than a rendering of the text.
  const face = () => FACES[bodyKind(props.file) ?? "document"]

  return (
    <section data-testid={TESTID.documentPage} data-file={props.file}>
      <header class="mb-4 flex items-baseline justify-between gap-2">
        <h1 class="m-0 font-mono text-sm text-muted">{props.file}</h1>
      </header>
      {/* The face is drawn the moment the route resolves — the heading and the
          file's own body are one mount — and what it draws from is its own to
          ask for (./faces.tsx). A path the directory does not hold never
          reaches this page: the page model answers that with its own screen
          (../page.ts).

          `<Dynamic>` because the component genuinely arrives at RUNTIME — which
          kind of file this is, is a fact about the path (the primitive's own
          rule, stated beside `../menu/NodeMenu.tsx`'s). Calling `face()(…)` with
          a plain object instead would hand it a dead `file`: Solid compiles JSX
          props into getters, and this page is keyed on the path, so the two
          agree only through one. */}
      <Dynamic component={face()} file={props.file} />
    </section>
  )
}
