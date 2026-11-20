import { Schema } from "effect"

import { type Derived, drawingPath, follow } from "./derive.ts"
import { chainOf } from "./errors.ts"
import { isMirror, isRegular, isTrashed } from "./node.ts"

export const Moved = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  file: Schema.String,
  parent: Schema.NullOr(Schema.String),
})
export type Moved = typeof Moved.Type

export const MovingRequest = Schema.Struct({
  record: Schema.String,
  to: Schema.Array(Schema.String),
})
export type MovingRequest = typeof MovingRequest.Type

export const MovingAnswer = Schema.Struct({
  moved: Schema.NullOr(Moved),
  refusals: Schema.Array(Schema.NullOr(Schema.String)),
})
export type MovingAnswer = typeof MovingAnswer.Type

export const NOT_MOVING: MovingAnswer = { moved: null, refusals: [] }

export const sameMoving: (a: MovingAnswer, b: MovingAnswer) => boolean = Schema
  .toEquivalence(MovingAnswer)

export const sameMovingRequest: (a: MovingRequest, b: MovingRequest) => boolean =
  Schema.toEquivalence(MovingRequest)

export const movingOf = (derived: Derived, request: MovingRequest): MovingAnswer => {
  const located = derived.byId.get(request.record)
  if (located === undefined) return NOT_MOVING
  const shown = follow(derived, located)
  const moved: Moved = {
    id: located.node.id,
    title: shown.kind === "found" ? shown.shows.node.title : request.record,
    file: located.file,
    parent: located.node.parent ?? null,
  }
  return {
    moved,
    refusals: request.to.map((id) => {
      const to = derived.byId.get(id)
      return to === undefined || !isRegular(to) ? null : whyNot(moved, {
        id,
        title: to.node.title,
        file: to.file,
      }, derived)
    }),
  }
}

export interface Destination {
  readonly id: string
  readonly title: string
  readonly file: string
}

export const whyNot = (
  moved: Moved,
  to: Destination,
  derived: Derived,
): string | null => {
  if (to.id === moved.id) {
    return `\`${to.title}\` is the row you are moving — nothing can go under itself.`
  }
  if (isTrashed(derived.claims, to.file)) {
    return `\`${to.title}\` has been put away — the Trash holds what is finished ` +
      `with, and nothing is moved INTO it. \`Put back\` is how something comes out.`
  }
  const drawn = drawingPath(derived, moved.id, to.id)
  if (drawn !== null) return insideItself(derived, to, drawn)
  if (to.id === moved.parent) {
    return `\`${to.title}\` is already this row's parent. A destination puts the row ` +
      `LAST under it, so picking this one would reorder rather than move — ` +
      `Alt+Shift+↑/↓ and dragging are the two ways to say that.`
  }
  return null
}

const insideItself = (
  derived: Derived,
  to: Destination,
  drawn: ReadonlyArray<string>,
): string => {
  const through = drawn.some((id) => {
    const at = derived.byId.get(id)
    return at !== undefined && isMirror(at.node)
  })
  return through
    ? `\`${to.title}\` is drawn inside this row, through a placement — ${
      chainOf(drawn)
    } — so putting it there would make the page draw itself for ever.`
    : `\`${to.title}\` is inside the row you are moving, so this would fold the ` +
      `branch into itself.`
}
