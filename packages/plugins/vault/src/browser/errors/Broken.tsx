import { TESTID } from "olai-plugin-vault/testids"
import { type BrokenFile, stageOf } from "@olai/format"

import { PAGE_TITLE } from "@olai/web/client/look.ts"

import { Lede } from "@olai/web/client/errors/Lede.tsx"
import { Rows } from "./Report.tsx"

export function Broken(props: { readonly file: BrokenFile }) {
  const count = () => props.file.errors.length
  const unparsed = () => props.file.errors.some((error) => stageOf(error.code) === "line")

  return (
    <section class="max-w-4xl" data-testid={TESTID.outlineFailure} data-file={props.file.file}>
      <h1 class={`${PAGE_TITLE} mb-2 italic text-alarm`}>
        {count()} {count() === 1 ? "error" : "errors"} in this file
      </h1>
      <Lede>
        {unparsed()
          ? "Some lines couldn't be read, so this outline can't be shown. "
          : "Something in it conflicts with your other outlines, so it can't be shown. "}
        Every other outline still works, and this one comes back on its own
        once these are fixed.
      </Lede>
      <Rows errors={props.file.errors} />
    </section>
  )
}
