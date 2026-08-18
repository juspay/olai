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
 * WHAT HAPPENS WHILE IT IS COMING is the reason this is safe to defer at all:
 * the editor's fallback is a TEXTAREA holding the same text
 * (`./Mde.tsx`) — not a spinner, not a disabled box. So a caret opened in the
 * first second of a session lands in something a person can type into, every
 * key works, autosave works, and what changes when the chunk lands is that the
 * markers start hiding. And if it never lands — a fetch that failed, a browser
 * offline — that textarea is the editor, permanently, which is exactly the
 * editor this app shipped before this item and a strictly better answer than a
 * page that cannot be written.
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
