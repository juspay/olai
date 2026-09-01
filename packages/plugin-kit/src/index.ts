/**
 * @olai/plugin-kit — WHAT A PLUGIN'S FACE IN A CONVERSATION IS MADE OF.
 *
 * Two things, and they are one concern: a sentence a plugin puts into chat
 * has a FACE (the mark) and a SUBJECT (the node it is ringing about). Both
 * used to live inside the first tenant that needed them. The second tenant
 * made that a copy, and a copy is how a third tenant gets browbeaten into a
 * third costume of the same mechanism.
 *
 * Tenants declare data. This package is the mechanism:
 *
 * - {@link BrandMark} — the nested viewport around a generated SVG body.
 * - `@olai/plugin-kit/ref`'s {@link nodeRef} — the backtick spelling the
 *   panel already makes pressable. Its own door, because a doorbell lives
 *   on `./server` and this door carries SolidJS.
 *
 * The SVG transform (`./mark/inline.ts`) and its generator (`./mark/emit.ts`)
 * are not a JavaScript export: a plugin's `default.nix` runs them through
 * {@link ../default.nix}, which takes the pin path as data.
 */

export { BrandMark, type BrandMarkProps } from "./Mark.tsx"
