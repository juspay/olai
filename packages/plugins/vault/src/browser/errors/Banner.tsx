import { TESTID } from "olai-plugin-vault/testids"
import { Key } from "@solid-primitives/keyed"
import { Show } from "solid-js"

import { Link } from "olai-plugin-navigation/routing"
import { atFile } from "olai-plugin-navigation/routes"

import { SAID, type Trouble } from "./banner.ts"
import { Lede } from "@olai/web/client/errors/Lede.tsx"

export function Banner(props: { readonly trouble: Trouble }) {
  const face = () => props.trouble.face
  const named = () => face().files.length + face().more

  return (
    <aside
      class="mb-6 rounded-control border border-alarm bg-alarm/10 px-4 py-3"
      data-testid={TESTID.staleBanner}
    >
      <Show
        when={props.trouble.kind === "files"}
        fallback={
          <>
            <h2 class="m-0 mb-1 text-title font-bold text-alarm">
              Showing the last good version
            </h2>
            <Lede>
              olai can't read this folder right now, so this is the version
              from before. Your files are fine, and there is nothing to reload:
              this updates on its own once the folder can be read again.
            </Lede>
          </>
        }
      >
        <h2 class="m-0 mb-1 text-title font-bold text-alarm">
          {named() === 1 ? "One file is broken" : `${named()} files are broken`}
        </h2>
        <Lede>
          Everything else works as usual. Open a broken file to see what is
          wrong; once it is fixed it comes back on its own.
        </Lede>
      </Show>
      <ul class="m-0 mt-2 list-none p-0">
        <Key each={face().files} by="file">
          {(one) => (
            <li
              class="mb-1 border-l-[3px] border-alarm py-0.5 pl-3"
              data-testid={TESTID.brokenFileLine}
              data-file={one().file}
              data-state={one().state}
            >
              <Show
                when={props.trouble.kind === "files"}
                fallback={
                  <code class="mr-2 font-mono text-body text-muted">{one().file}</code>
                }
              >
                <Link
                  route={atFile(one().file)}
                  class="mr-2 font-mono text-body text-muted underline"
                  testid={TESTID.brokenFileLink}
                  broken
                >
                  {one().file}
                </Link>
              </Show>
              <span>
                {SAID[one().state]} — {one().count}{" "}
                {one().count === 1 ? "error" : "errors"}
              </span>
            </li>
          )}
        </Key>
      </ul>
      <Show when={face().more > 0}>
        <Lede testid={TESTID.brokenFileMore}>
          …and {face().more} more {face().more === 1 ? "file" : "files"}.
        </Lede>
      </Show>
    </aside>
  )
}
