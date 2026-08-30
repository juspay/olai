/**
 * WHAT IS WRONG WITH THE DIRECTORY — over pages that are not.
 *
 * Since the per-file ruling (2026-08-29) a broken outline costs the reader that
 * outline and nothing else: the tree under this banner is not old, it is LIVE,
 * and so is every other page in the app. So the ordinary sentence here is a
 * signpost rather than a warning about the thing you are looking at — one line
 * per broken file, naming it, saying what is the matter and how many rows are
 * waiting there, and LINKING to the page that shows them.
 *
 * IT LINKS NOW, and that is the ruling arriving rather than a change of taste.
 * The sentence this replaces refused to send anybody anywhere, and said why:
 * the case it was most often drawn over was a file that PARSED and said
 * something the set could not hold, which had no pane of its own — opening it
 * showed the last good tree and no rows at all, so the obvious door was a door
 * to nowhere. Every broken file has a page now (./Broken.tsx, drawn from the
 * set's `broken`, which is every kind of broken), so the door goes somewhere and
 * not offering it would be the sin the old comment was avoiding.
 *
 * THE OTHER SENTENCE is the one thing that is still about staleness, and it is
 * not about anybody's outlines: the served directory could not be READ, so what
 * is on screen is from before it went away. WHICH of the two this is, is not
 * decided here — it arrives decided (./banner.ts's `Trouble`), so there is no
 * arm order in this file for the precedence between them to depend on and no
 * way to draw a list of files over a directory nobody can currently see.
 *
 * IT DRAWS THE BOUNDED FACE and never the rows (`@olai/format`'s `summaryOf`).
 * This banner is over SOMEBODY ELSE'S PAGE — every page in the app — and it
 * used to inline the full enumeration: one outline failing typed validation put
 * 135 rows above every open document, so each page opened on a wall of another
 * file's errors (`last-good-banner-flood`). One line per broken file, the state
 * and the count, and the rows on the page a reader asked for them on.
 *
 * THE CLAMP AND THE BOUND ARE DIFFERENT THINGS and they live apart: the bound
 * is the format's — `summaryOf(n)` has no way to hand back a row, so no surface
 * drawing it can flood — and the clamp is a knob about THIS banner, which is
 * why it and the reading around it are one module over where a test can ask
 * them (./banner.ts, and the debate's finding 5 on why a knob is not a
 * receptacle).
 */

import { For, Show } from "solid-js"

import { Link } from "../router.tsx"
import { atFile } from "../routes.ts"
import { TESTID } from "../testids.ts"
import { SAID, type Trouble } from "./banner.ts"
import { Lede } from "./Lede.tsx"

export function Banner(props: { readonly trouble: Trouble }) {
  const face = () => props.trouble.face
  const named = () => face().files.length + face().more

  return (
    <aside
      class="mb-6 rounded border border-alarm bg-alarm/5 px-4 py-3"
      data-testid={TESTID.staleBanner}
    >
      <Show
        when={props.trouble.kind === "files"}
        fallback={
          <>
            <h2 class="m-0 mb-1 text-base font-bold text-alarm">
              Showing the last good version
            </h2>
            <Lede>
              The served directory cannot be read right now, so the outline below
              is the one from before it went away. Nothing here is wrong with
              your files, and nothing needs reloading — it catches up on its own
              once the directory can be read again.
            </Lede>
          </>
        }
      >
        <h2 class="m-0 mb-1 text-base font-bold text-alarm">
          {named() === 1 ? "One file is broken" : `${named()} files are broken`}
        </h2>
        <Lede>
          Everything else here is live and can be edited — a broken file costs
          you that file and nothing else. Open one to see what it says; fix it
          and it comes back on its own, with nothing to reload.
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
              {/* A LINK ONLY WHERE THERE IS A PAGE. A directory that went away
                  names the path it could not read, and that path is the served
                  root rather than a file anybody can open. `Link` and not an
                  `<a>`, so ⌘-click and the split-pane gesture work here the way
                  they work on every other address this app draws
                  (../router.tsx). */}
              <Show
                when={props.trouble.kind === "files"}
                fallback={
                  <code class="mr-2 font-mono text-[0.8125rem] text-muted">{one.file}</code>
                }
              >
                <Link
                  route={atFile(one.file)}
                  class="mr-2 font-mono text-[0.8125rem] text-muted underline"
                  testid={TESTID.brokenFileLink}
                  broken
                >
                  {one.file}
                </Link>
              </Show>
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
