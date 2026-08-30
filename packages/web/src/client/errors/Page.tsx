/**
 * The whole page, for the one thing that leaves nothing else to draw: the
 * served DIRECTORY could not be read.
 *
 * There is no sidebar and no tree under this, because there is no listing — a
 * mount that went away, a folder that will not open, a disk with no room to
 * answer a stat. Every row the store has is here, naming the path and carrying
 * whatever detail it had. Nothing is summarised away, because a reader who has
 * to re-run the server to find the second error is a reader we have failed.
 *
 * IT USED TO BE THE PAGE FOR A BROKEN SET, and since the per-file ruling
 * (2026-08-29) there is no such thing. A directory with a broken outline in it
 * LOADS: that file keeps its place, draws its own rows on its own page
 * (./Broken.tsx) and every other file is live — so the sentence this page used
 * to open with, "nothing is served until these are fixed", is not true of
 * anything any more. What is left here is the case where the store never had a
 * set to publish at all, which is why it is reached off the directory's own
 * `never` state (../App.tsx) rather than off a verdict being non-empty.
 *
 * WHICH A SERVED DIRECTORY NO LONGER REACHES, said plainly because it decides
 * how much this page is worth: the store fails to OPEN over a root it cannot
 * list, so `olai web` refuses to start rather than serving a page that says so.
 * What keeps this here is the wire: `Manifest` is `NullOr` and a tab resolves
 * that state on its own evidence (`../directory.ts`, `manifest-fold-skew`), so
 * the client owes it an answer whether or not this server produces it.
 *
 * The DEGRADED cases are elsewhere and deliberately quieter, because in both of
 * them something real is still on screen: ./Banner.tsx over live pages, naming
 * the files that are broken, and ./Broken.tsx in one file's own place.
 */

import type { Verdict } from "@olai/format"

import { SHEET } from "../layout/sheet.ts"
import { PAGE_TITLE } from "../look.ts"
import { TESTID } from "../testids.ts"
import { Lede } from "./Lede.tsx"
import { Report } from "./Report.tsx"

export function Page(props: { readonly verdict: Verdict }) {
  // THE ROWS THEMSELVES, and this is the one surface entitled to every one of
  // them: there is no tree under this page to keep, so a summary here would be
  // a reader re-running the server to find the second error. The BOUNDED face
  // is for a banner over something still live (./Banner.tsx).
  const errors = () => props.verdict.findings
  return (
    <main class={`${SHEET} max-w-none px-8 py-10`} data-testid={TESTID.errorView}>
      <h1 class={`${PAGE_TITLE} mb-2 italic text-alarm`}>
        {errors().length === 0
          ? "Nothing to serve"
          : `${errors().length} ${errors().length === 1 ? "error" : "errors"}`}
      </h1>
      <Lede>
        {errors().length === 0
          // The page is decided by the directory's own state and the report
          // arrives on its own subscription — so for the frame between them
          // there is nothing served and nothing yet to say about it.
          ? "The served directory has never loaded. Fetching the report…"
          : "Nothing has been served from this directory yet, so there is no sidebar and no tree. Nothing below is about the CONTENTS of your outlines — a directory that cannot be listed has no files to be wrong — and it catches up on its own once it can be read again."}
      </Lede>
      <Report errors={errors()} />
    </main>
  )
}
