/** vault owns these wire descriptors as well as their live handlers.
 * The descriptor imports are inert schemas; loading this contract acquires no
 * runtime state. Stable root tags preserve clients without moving ownership
 * back into the host. */
import { NOTHING_WRONG, Verdict } from "@olai/format"
import { defineSurface } from "@kolu/surface/define"
import { Schema } from "effect"
import { Head, Manifest } from "./wire.ts"
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
     * (`./wire.ts`'s `headProjection`, where that is spelled out and asserted)
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
/**
 * WHICH FACE SEES WHAT — this row's whole grant, over this row's own spec.
 *
 * The general rule these three are decided by — a cell is exposable iff its
 * value is O(1)-ish, and the render-shaped/request-shaped split beside it — is
 * `@olai/surface/host`'s `hostFaces`. This row is where that rule bites
 * hardest, because the three members below are the three answers it gives.
 */
/**
 * WHAT AN AGENT MAY SEE OF THIS ROW AS A `surface://` RESOURCE — a THIRD
 * projection, and not a fourth face.
 *
 * `faces` above says which of this row's tags each WIRE caller may reach.
 * This says which of its members the MCP adapter publishes as a resource at
 * all, because that adapter needs the member's KIND to build a URI and a tag
 * set has thrown that away. The two answer different questions and a member on
 * one and not the other is an ordinary state: every `ops.*` on `faces.agent` is
 * reachable and is no resource, because a procedure is not a thing with an
 * address.
 *
 * IT WAS `@olai/bundle`'s `MCP`, one flat map naming three rows' members from a
 * package none of them could edit. #546 sent each line home, and juspay/kolu#2234
 * is what made a per-sibling map the framework's own shape: the adapter takes a
 * rooted bundle, resolves each row's map against that row's spec, and mints
 * `surface://collections/<row>/<member>` from the key it was mounted under.
 *
 * THE RULE THIS IS WRITTEN AGAINST is the wire-cost one in
 * `@olai/surface`'s `host.ts`: a cell is exposable only if its value is
 * O(1)-ish, and anything O(corpus) must be a COLLECTION, whose resource reads
 * the KEY SET and hands a body one at a time.
 */
export const resources = {
  // What is wrong across the set right now — and NOT how current the set is,
  // which is a different fact and lives on a read's own vintage. A CELL, and
  // eligible, because per-file breakage does not come through it: that rides
  // `OutlineEntry.broken` on the outlines collection, per entity, leaving this
  // one holding cross-file failures only.
  errors: "resource",
} as const

export const faces = {
  browser: {
    // WHAT IS WRONG ACROSS THE SET RIGHT NOW, on both faces — the one member
    // here that is, and the reason it is worth saying out loud.
    //
    // It carries the store's other kind of failure too: a directory that could
    // not be READ, as an `unreadable-directory` error (`@olai/store`'s
    // `Codec.unreadable`). That lands here rather than needing a second channel
    // precisely because this is ONE member with two faces on it — the browser
    // draws it as the banner over its last-good tree and an agent reads the
    // identical rows off `surface://cells/errors`: the same fact, in the same
    // vocabulary, at the same instant. "MCP and Web ops must be consistent" is
    // a property of this line rather than something two renderers have to be
    // kept in step about, which is the argument for putting it on the cell
    // rather than on the reply of whichever verb noticed.
    errors: "resource",
    // WHETHER THERE IS A SET — the browser's alone, and the sharpest case of
    // the render/request asymmetry in the tree.
    //
    // A render-shaped consumer genuinely needs the "has this directory ever
    // loaded" bit, because a page has to draw something before it has heard. A
    // request-shaped one gets it for free: `resources/read` blocks on the first
    // frame either way, so "the store has not loaded yet" is absorbed by the
    // read waiting rather than needing a tri-state.
    //
    // IT IS ALSO THE MEMBER THE COST RULE WAS WRITTEN ABOUT, and the absence
    // from the agent face is older than the cell's present shape. It used to be
    // `NullOr({ documents: Array({ file, text }) })` — nothing but the corpus of
    // `.md` bodies — so `surface://cells/manifest` would have handed an agent
    // every document in the served directory as one blob, re-read in full
    // whenever any one of them changed. `snapshot-scale` cut the documents out
    // into `olai-plugin-markdown`'s collection, which is what the rule says to
    // do; what is left is a fact with no fields whose whole job is the
    // never-loaded bit. So the cell was never exposed to an agent and now has
    // nothing to expose: no URI was published and withdrawn.
    manifest: "resource",
    // EVERY SERVED FILE, ONE HEAD EACH — the browser's alone, and it answers a
    // question only a render-shaped consumer asks.
    //
    // A tab keeps a `.html` on screen and has to notice the file moving
    // underneath it without ever wanting what it now says (the frame fetches
    // that over HTTP), which is a subscription no request-shaped reader has an
    // analogue of. An agent reads a body when it wants one and hears about the
    // change on `notifications/resources/updated` for the key it already holds;
    // a second resource carrying the revision it would then read anyway is a
    // URI published for nobody. It costs nothing to add the day something asks.
    heads: "resource",
  },
  agent: {
    // ...AND THE OTHER HALF OF THE MEMBER ABOVE.
    //
    // A CELL, and eligible, because per-file breakage does NOT come through it
    // — that rides `OutlineEntry.broken` on `olai-plugin-outlines`' collection,
    // per entity — leaving this one holding cross-file failures only. It is the
    // lesser instance of the cost rule: a corpus that somehow produced
    // thousands of cross-file errors would want the treatment `manifest` got.
    //
    // WHAT IT DOES NOT SAY is how CURRENT the set is, and that was this
    // comment's old claim: that an agent could tell a stale-but-valid tree from
    // a current one through this cell. That was grok's opening position in the
    // 2026-08-25 lowy-electricity sitting, retracted by him in round two and
    // signed retracted in the closing. The cell was EMPTY for the thirty
    // minutes the server spent answering with week-old truth, because nothing
    // was invalid. Validity and currency are two axes, and the second one is
    // the vintage on a read's own answer (`@olai/store`, and
    // `olai-plugin-mcp`'s `tools.ts` for the face an agent reads it on).
    errors: "resource",
  },
} as const
