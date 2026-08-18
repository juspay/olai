/**
 * When the markdown EDITOR arrives.
 *
 * The third chunk this client fetches after the page is drawn (`../arriving.ts`
 * holds the five rules, `../markdown/chunk.ts` fetches the renderer, and
 * `../menu/chunk.ts` the `•••` menu's primitive), and the one with the
 * narrowest audience: CodeMirror and its live-preview plugins are ~700 kB of
 * an editor nobody reading an outline has asked for. A reader who never puts a
 * caret in a note never pays for it, and the first paint of a tree of titles
 * carries none of it.
 *
 * WHEN IT IS FETCHED is the first time somebody OPENS a note or puts a caret
 * in prose — because an open note IS this editor now, mounted readonly
 * (`./Mde.tsx`). A reader of an outline of titles still never asks for it, and
 * neither does a row the DENSITY preference unfolded: `../Tree.tsx` mounts the
 * surface for a note somebody opened, and 266 editors is what the other reading
 * costs on this repository's own roadmap.
 *
 * WHAT HAPPENS WHILE IT IS COMING is the reason this is safe to defer at all,
 * and it is different for the two modes. A surface being READ falls back to the
 * page's own markdown rendering — the thing it replaced — so a reader waiting
 * on a chunk sees prose rather than source. A surface being WRITTEN falls back
 * to the TEXTAREA holding the same text: not a spinner, not a disabled box, so
 * a caret opened in the first second of a session lands in something a person
 * can type into, every key works, autosave works, and what changes when the
 * chunk lands is that the markers start hiding. And if it never lands — a fetch
 * that failed, a browser offline — those two ARE the app this repository
 * shipped before this item, which is a strictly better answer than a page that
 * cannot be read or written.
 *
 * The `import()` is a literal here for the same reason it is in the other two:
 * the bundler reads that specifier out of the file it is written in, which is
 * what puts the graph behind it in a chunk of its own rather than merely
 * unreached inside the entry.
 */

import { createArrival } from "../arriving.ts"

const editor = createArrival("the markdown editor", () => import("./codemirror.ts"))

/** Is it here yet — and, if it is not, start fetching it. A signal read, so a
 *  `<Show>` that asks becomes one that swaps the textarea for the editor when
 *  the file lands. */
export const editorReady = editor.ready

/** Why it is not coming, once that is known. Nothing draws a sentence for this
 *  one — see the header: what a reader gets instead is the textarea, which is
 *  an editor rather than a hole — and it is here because `../arriving.ts` says
 *  a failure is a value, and because the console record it makes is the thing
 *  somebody goes looking for. */
export const editorFailure = editor.failure

/** It, for code that has already established {@link editorReady}. */
export const editorNow = editor.now
