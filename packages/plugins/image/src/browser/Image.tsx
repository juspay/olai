import { useHead } from "./vault.ts"
import { servedDirectory } from "./vault.ts"
import { TESTID } from "olai-plugin-image/testids"
import { stemOf } from "@olai/format"


import { usePointed } from "olai-plugin-vault/pointed"

export function Image(props: { readonly file: string }) {
  const src = usePointed(() => props.file, useHead(() => props.file))

  return (
    <img
      src={src()}
      alt={(() => { const claims = servedDirectory()?.claims(); return claims === undefined ? props.file : stemOf(claims, props.file) })()}
      loading="eager"
      fetchpriority="high"
      decoding="async"
      class="block h-auto max-w-full rounded-control border border-rule"
      data-testid={TESTID.imageView}
      data-file={props.file}
    />
  )
}
