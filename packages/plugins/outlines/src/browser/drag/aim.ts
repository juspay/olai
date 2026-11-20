import type { Box } from "./lines.ts"
import { type Landing, type Placed, planDrop } from "./plan.ts"

export interface Aimed {
  readonly file: string
  readonly box: Box
  readonly placed: ReadonlyArray<Placed>
}

export interface Refusal extends Box {
  readonly why: string
  readonly file: string
}

export type Aim =
  | { readonly kind: "drop"; readonly landing: Landing }
  | { readonly kind: "refused"; readonly refusal: Refusal }

const outside = (at: number, from: number, extent: number): number =>
  at < from ? from - at : at > from + extent ? at - (from + extent) : 0

const awayFrom = (field: Aimed, x: number, y: number): number => {
  const dx = outside(x, field.box.left, field.box.width)
  const dy = outside(y, field.box.top, field.box.height)
  return dx * dx + dy * dy
}

const aimedAt = (
  fields: ReadonlyArray<Aimed>,
  x: number,
  y: number,
): Aimed | undefined =>
  fields.reduce<Aimed | undefined>(
    (nearest, field) =>
      nearest === undefined || awayFrom(field, x, y) < awayFrom(nearest, x, y) ? field : nearest,
    undefined,
  )

const whyNot = (field: Aimed, carried: string): string =>
  field.file === carried
    ? `There’s nowhere here to drop it: every row in this pane is part of what you’re dragging.`
    : `A drag only moves a row within its own outline (\`${carried}\`). ` +
      `Use Move to… (⌘⇧M) to move it to \`${field.file}\`.`

export const aimAt = (
  fields: ReadonlyArray<Aimed>,
  carried: string,
  x: number,
  y: number,
): Aim | null => {
  const field = aimedAt(fields, x, y)
  if (field === undefined) return null
  if (field.placed.length === 0) {
    return { kind: "refused", refusal: { ...field.box, why: whyNot(field, carried), file: field.file } }
  }
  const landing = planDrop(field.placed, x, y)
  return landing === null ? null : { kind: "drop", landing }
}
