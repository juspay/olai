/**
 * ODU'S FACE — the mark over a sentence odu put into somebody's conversation,
 * and it is odu's OWN LOGO rather than olai's drawing of one.
 *
 * `logo.svg` in juspay/odu: a rounded tile, a `$ odu` wordmark, a three-node
 * pipeline, the Tamil ஓடு. It arrives through the NPINS ODU PIN — the same
 * `npins/sources.json` revision `@odu/run-client` hydrates from — read by
 * {@link ../../default.nix}, turned into a TypeScript module by
 * `@olai/plugin-kit`, and copied beside this file by `just install`.
 *
 * {@link BrandMark} is the nested viewport and the per-instance ids. This
 * file is three imports wrapping it. The gradients and the dark tile ARE
 * the logo, so the mark carries odu's palette rather than `currentColor`.
 */

import { BrandMark } from "@olai/plugin-kit"

import { MARK_BODY, MARK_TOKEN, MARK_VIEWBOX } from "./mark.generated.ts"

export const OduMark = () => (
  <BrandMark viewBox={MARK_VIEWBOX} token={MARK_TOKEN} body={MARK_BODY} />
)
