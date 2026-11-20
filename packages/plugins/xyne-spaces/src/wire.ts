import { defineSurface } from "@kolu/surface/define"
import { Schema } from "effect"

export const name = "xyne-spaces"

export const defaultOn = false

export const SpacesStatus = Schema.Literals(["connected", "absent", "fault"])
export type SpacesStatus = typeof SpacesStatus.Type

export const SpacesLink = Schema.Struct({
  status: SpacesStatus,
  where: Schema.String,
  told: Schema.Boolean,
  why: Schema.NullOr(Schema.String),
  since: Schema.String,
})
export type SpacesLink = typeof SpacesLink.Type

export const SPACES_UNDIALED: SpacesLink = {
  status: "absent",
  where: "OLAI_SPACES_URL, OLAI_SPACES_TOKEN",
  told: false,
  why: null,
  since: "",
}

export const sameLink: (a: SpacesLink, b: SpacesLink) => boolean = Schema.toEquivalence(SpacesLink)

export const surface = defineSurface({
  cells: {
    link: {
      schema: SpacesLink,
      default: SPACES_UNDIALED,
      verbs: ["get"],
      equals: sameLink,
    },
  },
})

export const faces = {
  browser: {
    link: "resource",
  },
} as const
