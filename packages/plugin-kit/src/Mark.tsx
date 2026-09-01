/**
 * A TENANT'S BRAND ASSET, DRAWN IN CORE'S VIEWPORT.
 *
 * `@olai/plugin-api`'s `PluginMark` is a `<g>` in a `0 0 16 16` box the app
 * owns. A real logo has a coordinate system of its own, so this opens a
 * nested viewport inside that box: `width="100%"`/`height="100%"` resolve
 * against whatever core established — this file never spells `16` — and
 * `preserveAspectRatio="xMidYMid meet"` centres and fits the artwork.
 *
 * THE BYTES ARE A BUILD-TIME CONSTANT out of a content-addressed Nix store
 * path, produced by {@link ./mark/inline.ts} — never network, never vault,
 * never anything a person typed. `innerHTML` is the same warrant
 * the transform's own warrant: it refuses `<script>`,
 * `<style>`, `<foreignObject>`, inline handlers and off-document `href` at
 * build time.
 *
 * THE IDS ARE MADE UNIQUE PER INSTANCE HERE. The build pass rewrites every
 * id to carry {@link ./mark/inline.ts}'s `MARK_TOKEN`; `createUniqueId()`
 * swaps that token for a document-unique prefix. Core cannot do this
 * namespacing: computing an address out of a plugin's name is exactly what
 * the fence exists to refuse.
 *
 * A tenant's `Mark.tsx` is three imports wrapping this. Bumping the pin is
 * the whole of updating the logo.
 */

import { createUniqueId, type JSX } from "solid-js"

export interface BrandMarkProps {
  readonly viewBox: string
  readonly token: string
  readonly body: string
}

export const BrandMark = (props: BrandMarkProps): JSX.Element => {
  const uid = createUniqueId()
  return (
    <g>
      <svg
        x="0"
        y="0"
        width="100%"
        height="100%"
        viewBox={props.viewBox}
        preserveAspectRatio="xMidYMid meet"
        innerHTML={props.body.replaceAll(props.token, `${uid}-`)}
      />
    </g>
  )
}
