/**
 * What is wrong right now, over what was right last.
 *
 * The store keeps its last good snapshot when a set stops validating, so the
 * tree under this banner is real — just older than the files on disk. That is
 * the whole reason the errors ride a separate subscription from the snapshot:
 * a dangling reference in one file must not blank a page someone was reading.
 *
 * It says "not the files as they are now" rather than counting errors in the
 * heading, because the count is right below it and the STALENESS is the thing
 * a reader cannot see by looking at the tree.
 *
 * IT DRAWS THE VERDICT'S BOUNDED FACE and never the rows (`@olai/format`'s
 * `summary`). This banner is over SOMEBODY ELSE'S PAGE — every page in the app
 * — and it used to inline the full enumeration: one outline failing typed
 * validation put 135 rows above every open document, so each page opened on a
 * wall of another file's errors (`last-good-banner-flood`). One line per broken
 * file, the state and the count, and the rows where a reader asked for them.
 *
 * THE CLAMP AND THE BOUND ARE DIFFERENT THINGS and they live apart: the bound
 * is the format's — `summary(n)` has no way to hand back a row, so no surface
 * drawing it can flood — and the clamp is a knob about THIS banner, which is
 * why it and the two readings around it are one module over where a test can
 * ask them (./banner.ts, and the debate's finding 5 on why a knob is not a
 * receptacle).
 *
 * IT DOES NOT SEND ANYBODY ANYWHERE, and that is deliberate rather than terse.
 * The obvious sentence — "open a file named here to see what it says" — is a
 * door to nowhere for the case this banner is most often drawn over: a file
 * that PARSED and says something the set cannot hold has no pane of its own
 * (./Broken.tsx is drawn from the set's `broken`, which is the files that would
 * not parse), so opening it shows the last good tree and no rows at all. Until
 * that pane exists the honest sentence is the one below — every outline in the
 * app is the last good copy, this one included — and pointing at a destination
 * that has nothing to show is the door module's own sin said in prose.
 */

import type { Verdict } from "@olai/format"
import { createMemo, For, Show } from "solid-js"

import { TESTID } from "../testids.ts"
import { bannerFace, SAID, wentAway } from "./banner.ts"
import { Lede } from "./Lede.tsx"

export function Banner(props: { readonly verdict: Verdict }) {
  const face = createMemo(() => bannerFace(props.verdict))

  return (
    <aside
      class="mb-6 rounded border border-alarm bg-alarm/5 px-4 py-3"
      data-testid={TESTID.staleBanner}
    >
      <h2 class="m-0 mb-1 text-base font-bold text-alarm">
        Showing the last good version
      </h2>
      <Show
        when={wentAway(face())}
        fallback={
          <Lede>
            The files on disk no longer validate, so every outline in the app —
            including the one below — is the last good copy rather than what is
            there now. Fix what is named here and it catches up on its own;
            nothing needs reloading.
          </Lede>
        }
      >
        <Lede>
          The served directory cannot be read right now, so the outline below is
          the one from before it went away. Nothing here is wrong with your
          files, and nothing needs reloading — it catches up on its own once the
          directory can be read again.
        </Lede>
      </Show>
      <ul class="m-0 mt-2 list-none p-0">
        <For each={face().files}>
          {(one) => (
            <li
              class="mb-1 border-l-[3px] border-alarm py-0.5 pl-3"
              data-testid={TESTID.brokenFileLine}
              data-file={one.file}
              data-state={one.state}
            >
              <code class="mr-2 font-mono text-[0.8125rem] text-muted">
                {one.file}
              </code>
              <span>
                {SAID[one.state]} — {one.count}{" "}
                {one.count === 1 ? "error" : "errors"}
              </span>
            </li>
          )}
        </For>
      </ul>
      <Show when={face().more > 0}>
        <Lede testid={TESTID.brokenFileMore}>
          …and {face().more} more {face().more === 1 ? "file" : "files"}.
        </Lede>
      </Show>
    </aside>
  )
}
