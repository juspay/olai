import { useHead } from "./vault.ts"
import { TESTID } from "olai-plugin-pdf/testids"
import { mediaHref } from "@olai/surface"


import { usePointed } from "olai-plugin-vault/pointed"

const PDF_TYPE = "application/pdf"

export function Pdf(props: { readonly file: string }) {
  const src = usePointed(() => props.file, useHead(() => props.file))

  return (
    <object
      data={src()}
      type={PDF_TYPE}
      class="block h-[80dvh] w-full rounded-control border border-rule"
      data-testid={TESTID.pdfEmbed}
      data-file={props.file}
      aria-label={props.file}
    >
      <p class="m-0 p-4 text-muted">
        This browser can't show a PDF here.{" "}
        <a class="underline" href={mediaHref(props.file)} target="_blank" rel="noreferrer">
          Open {props.file}
        </a>
      </p>
    </object>
  )
}
