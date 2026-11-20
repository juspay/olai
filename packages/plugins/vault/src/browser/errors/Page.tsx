import { TESTID } from "olai-plugin-vault/testids"
import type { Verdict } from "@olai/format"

import { SHEET } from "olai-plugin-layout/sheet"
import { PAGE_TITLE } from "@olai/web/client/look.ts"

import { Lede } from "@olai/web/client/errors/Lede.tsx"
import { Report } from "./Report.tsx"

export function Page(props: { readonly verdict: Verdict }) {
  const errors = () => props.verdict.findings
  return (
    <main class={`${SHEET} max-w-none px-8 py-10`} data-testid={TESTID.errorView}>
      <h1 class={`${PAGE_TITLE} mb-2 italic text-alarm`}>
        {errors().length === 0
          ? "olai can't read this folder"
          : `${errors().length} ${errors().length === 1 ? "error" : "errors"}`}
      </h1>
      <Lede>
        {errors().length === 0
          ? "Loading the details…"
          : "olai can't read this folder, so there is nothing to show yet. Your outlines are not the problem. Check that the folder exists and that olai is allowed to open it; this page updates on its own once it can."}
      </Lede>
      <Report errors={errors()} />
    </main>
  )
}
