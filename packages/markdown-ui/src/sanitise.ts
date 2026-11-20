import { defaultSchema } from "rehype-sanitize"
import type { Options as SanitiseSchema } from "rehype-sanitize"

import { ANCHOR_CLASS } from "./anchors.ts"

/** One entry of an attribute allowlist. Spelled from the schema rather than
 *  imported: `hast-util-sanitize` is `rehype-sanitize`'s dependency and not
 *  ours to declare (bunfig.toml's isolated linker nests it out of sight). */
type Definition = NonNullable<SanitiseSchema["attributes"]>[string][number]

/** A tag's allowlist with one more class VALUE admitted. `hast-util-sanitize`
 *  resolves an attribute against the FIRST entry naming it, so this edits the
 *  default's own entry rather than appending a second one. */
const admittingClass = (tag: string, value: string): Definition[] =>
  [...(defaultSchema.attributes?.[tag] ?? [])].map((entry) =>
    Array.isArray(entry) && entry[0] === "className" ? [...entry, value] : entry
  )

export const MESSAGE_PROTOCOL = "message"

export const SANITISE: SanitiseSchema = {
  ...defaultSchema,
  clobberPrefix: "",
  attributes: { ...defaultSchema.attributes, a: admittingClass("a", ANCHOR_CLASS) },
  protocols: {
    ...defaultSchema.protocols,
    href: [...(defaultSchema.protocols?.["href"] ?? []), MESSAGE_PROTOCOL],
  },
}
