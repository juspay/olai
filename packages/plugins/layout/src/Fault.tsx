import { TESTID } from "olai-plugin-layout/testids"
import { reloadForUpdate } from "@kolu/surface-app/lifecycle"

import { Lede } from "@olai/web/client/errors/Lede.tsx"
import { PAGE_TITLE } from "@olai/web/client/look.ts"
import { Reload } from "@olai/web/client/Reload.tsx"
import { HOME_ROUTE, hrefOfPlain } from "olai-plugin-navigation/routes"

import { TARGET } from "@olai/ui-primitives/touch.ts"

export function Fault(props: { readonly text: string }) {
  return (
    <main class="min-h-dvh max-w-none bg-paper px-8 py-10" data-testid={TESTID.fault}>
      <h1 class={`${PAGE_TITLE} mb-2 italic text-alarm`}>Something went wrong on this page</h1>
      <Lede>
        Your files are safe. Reload to try again.
      </Lede>
      <div class="mb-6 flex flex-wrap items-center gap-4">
        <Reload onReload={reloadForUpdate} />
        <a
          class={`inline-flex ${TARGET} items-center text-body text-muted underline md:min-h-0`}
          href={hrefOfPlain(HOME_ROUTE)}
          data-testid={TESTID.faultHome}
        >
          Go home
        </a>
      </div>
      <details class="max-w-full">
        <summary class="cursor-pointer text-body text-muted hover:text-ink">Details</summary>
        <pre
          class="mt-2 max-w-full overflow-x-auto rounded-control border border-rule bg-rule/20 p-3 font-mono text-label text-ink"
          data-testid={TESTID.faultDetail}
        >
          {props.text}
        </pre>
      </details>
    </main>
  )
}
