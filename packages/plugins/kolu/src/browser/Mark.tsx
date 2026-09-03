/**
 * KOLU'S FACE — the mark over a sentence kolu put into somebody's conversation,
 * and it is kolu's OWN LOGO rather than olai's drawing of one.
 *
 * `packages/client/favicon.svg` in juspay/kolu: three bold rounded bars in a
 * rainbow. It arrives through the NPINS KOLU PIN — the same
 * `npins/sources.json` revision every `@kolu/*` source hydrates from — read
 * by {@link ../../default.nix}, turned into a TypeScript module by
 * `@olai/plugin-kit`, and copied beside this file by `just install`.
 *
 * {@link BrandMark} is the nested viewport and the per-instance ids. This
 * file is three imports wrapping it. The gradients ARE the logo, so the
 * mark carries kolu's palette rather than `currentColor`.
 */

import { BrandMark } from "@olai/plugin-kit"

import { MARK_BODY, MARK_TOKEN, MARK_VIEWBOX } from "./mark.generated.ts"

export const KoluMark = () => (
  <BrandMark viewBox={MARK_VIEWBOX} token={MARK_TOKEN} body={MARK_BODY} />
)
