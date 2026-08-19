/**
 * The fourth way to say what is wrong, and the only one that is not about the
 * files: THIS APP'S OWN CODE threw while drawing the page.
 *
 * The other three (./Page.tsx, ./Banner.tsx, ./Broken.tsx) are errors as DATA —
 * a set that did not validate, read off the wire and rendered deliberately.
 * None of them can catch a bug in the client, because a client that has thrown
 * mid-render is not running the code that would draw them: Solid unmounts the
 * subtree that faulted, and what a reader gets is a white tab with the truth in
 * a console they have no reason to open. That is exactly how #70's `RangeError`
 * arrived, and the person who hit it could say nothing about it but "it went
 * blank".
 *
 * So this is drawn by `SurfaceFaultBoundary` around the whole shell
 * (../main.tsx). The boundary owns catching, recording and PRINTING — `text`
 * arrives already printed by the framework's `thrownText`, verbatim and never
 * empty — and this component keeps only the LOOK: it says what that white tab
 * could not — WHAT threw, unsummarised, the same promise ./Report.tsx makes
 * about the format's own errors — and the two ways out of a render with no
 * state left worth resuming.
 *
 * TWO, because a reload alone can be a loop. `reloadForUpdate` is the
 * framework's reload, for the reason ../connection/Connection.tsx gives — it
 * lands on the `no-store` shell and the bundle that shell names rather than on
 * whatever a cache still remembers, which matters more here than anywhere,
 * since a stale bundle may be the very thing that threw. But a fault is usually
 * deterministic FOR THE PAGE it happened on: #70's crashed on opening a day, and
 * a reader sitting on `/d/2026-08-09` can press Reload all afternoon. So there
 * is also the way out of that page — a real document navigation to `/`, not a
 * `<Link>`, whose router lives inside the tree that has just come down. It is
 * what ./NotFound.tsx already does with the sidebar: a dead end is not a reason
 * to strand somebody.
 */

import { reloadForUpdate } from "@kolu/surface-app/lifecycle"

import { Lede } from "./Lede.tsx"
import { PAGE_TITLE } from "../look.ts"
import { Reload } from "../Reload.tsx"
import { hrefOf } from "../routes.ts"
import { TESTID } from "../testids.ts"
import { TARGET } from "../touch.ts"

export function Fault(props: { readonly text: string }) {
  return (
    <main class="min-h-dvh max-w-none bg-paper px-8 py-10" data-testid={TESTID.fault}>
      <h1 class={`${PAGE_TITLE} mb-2 italic text-alarm`}>This page broke</h1>
      <Lede>
        Not the outlines — olai itself. Something in this page threw while it was
        being drawn, so what was on screen is gone and nothing here will update
        again. Nothing this app draws touches the files on disk.
      </Lede>
      {/* Verbatim, and scrollable rather than wrapped away: this text is what
          a bug report is made of, and a fault surface that summarised the
          fault would be the white tab with extra steps. */}
      <pre
        class="mb-4 max-w-full overflow-x-auto rounded border border-rule bg-rule/30 p-3 text-xs text-ink"
        data-testid={TESTID.faultDetail}
      >
        {props.text}
      </pre>
      <div class="flex flex-wrap items-center gap-4">
        <Reload onReload={reloadForUpdate} />
        {/* Quieter than the button on purpose: leaving the page is the second
            answer, and it is the right one only once the first has been tried.
            A plain `<a>` — this is a document navigation, which is the whole
            point of offering it. */}
        <a
          class={`inline-flex ${TARGET} items-center text-sm text-muted underline md:min-h-0`}
          // Through `routes.ts` like every other address this app writes: it is
          // the one bijection between a URL and what it means, and it is pure —
          // nothing about the page being down stops it answering.
          href={hrefOf({ kind: "outline", file: null })}
          data-testid={TESTID.faultHome}
        >
          Start over on the first outline
        </a>
      </div>
    </main>
  )
}
