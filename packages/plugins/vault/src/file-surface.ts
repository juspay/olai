/** vault owns these wire descriptors as well as their live handlers.
 * The descriptor imports are inert schemas; loading this contract acquires no
 * runtime state. Stable root tags preserve clients without moving ownership
 * back into the host. */
import { NOTHING_WRONG, Verdict } from "@olai/format"
import { defineSurface } from "@kolu/surface/define"
import { Schema } from "effect"
import { Head, Manifest } from "@olai/surface"
const sameSet = (a: Manifest, b: Manifest): boolean => (a === null) === (b === null)
export const surface = defineSurface({
cells: {
// Wire-read-only: the server is the only writer, and a write verb it never
    // serves would crash surface's boot walk.
    errors: {
      /**
       * THE VALIDATOR'S VERDICT, as the format shapes it (`@olai/format`'s
       * `verdict.ts`) — not the flat list of rows this used to be.
       *
       * The rows are still in it and still travel whole, because the surface
       * that has to show every one of them is a REAL surface: a directory that
       * never loaded has no tree to put a banner over, so the error page is the
       * page and nothing may be summarised away. What changed is that a surface
       * drawn over something still live no longer has the rows as its only
       * option — `summary(n)` is a bounded per-file face, and the banner draws
       * that (`@olai/web`'s `errors/Banner.tsx`, and `last-good-banner-flood`
       * for what drawing the rows there cost).
       *
       * NO `arrayKey`, and it is a decision rather than an omission — the one
       * cell here with a list a `<For>` draws by reference and nothing to
       * identify a row by. An `OutlineError` is a site, a code and a sentence;
       * `file` is the only required, non-nullable field that looks like an
       * identity and a broken outline reports several errors against the same
       * one. A key that repeats inside its own array is a key that decides
       * identity by collision, so this merges the way an undeclared list does:
       * replaced. (It is a struct now rather than a list, so the question is
       * settled a second way — a cell whose value is a struct is replaced.)
       */
      schema: Verdict,
      default: NOTHING_WRONG,
      verbs: ["get"],
    },
/** Whether there is a set — see {@link Manifest}. Wire-read-only for the
     *  same reason the entries are: the directory is the disk's.
     *
     *  `equals` is what keeps it quiet: the server writes this cell on every
     *  revision, because that is when it learns anything, and almost every
     *  revision has nothing new to say about whether a directory loaded. */
    manifest: {
      schema: Manifest,
      default: null,
      verbs: ["get"],
      equals: sameSet,
    }
},
collections: {
/**
     * EVERY SERVED FILE, one HEAD each and no content — see {@link Head}.
     *
     * THE DIRECTORY, as a browser holds it. This is the whole of what a tab
     * knows about the vault since PR 10 of
     * `https://github.com/juspay/oss.olai/blob/main/projects/olai/brainstorming/vault-in-browser.md`: the sidebar's tree is these paths, a page model
     * asks these for membership, the palette draws these titles, and everything
     * else a screen shows comes from that page's own reading (`./page.ts`).
     * `outlines` used to answer the first four of those, by handing every tab
     * every record of every file.
     *
     * `deltas` here, and the omission next door, are the same decision read
     * twice. The batched verb is a push of every entry, which for `documents`
     * is every body and is exactly what that collection exists to stop
     * sending; for this one it is a path, an integer and a face per file, which
     * is what a key set plus a title costs. So the cheap member takes the cheap
     * verb, and a tab watching one file for changes opens no stream of its own:
     * it reads the entry it wants out of the one snapshot-then-delta stream the
     * sidebar's paths already arrive on.
     *
     * IT IS A SUPERSET OF {@link documents}' KEYS, and that direction is what a
     * reader may rely on: the file list comes from HERE, so a head missing for
     * a file the directory holds is a file the sidebar stops listing, and a
     * bodied file's head is always here to open its body against. Every slice
     * is cut in one function, from one binding of one list, through one `keyOf`
     * (`@olai/server`'s `published.ts`, where that is spelled out and asserted)
     * — so breaking it takes an edit rather than a drift.
     *
     * Read-only on the wire, like every other file-shaped member: what a head
     * says is what the disk said.
     */
    heads: {
      /** Root-relative, `/`-spelled — the same spelling every other member
       *  here is keyed by, and the one every `file:line` names. */
      keySchema: Schema.String,
      schema: Head,
      verbs: ["keys", "get", "deltas"],
    }
}
})
export const faces = { browser: { errors: "resource", manifest: "resource", heads: "resource" }, agent: { errors: "resource" } } as const
