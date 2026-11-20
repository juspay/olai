import { heldFaces } from "@olai/plugin-api"
import type {} from "olai-plugin-outlines/slots"

export const { hold: holdRouteFaces, hung: routeFaces } = heldFaces()

export const { hold: holdPaletteFaces, hung: paletteFaces, only: paletteOnly } = heldFaces()

export const paletteCrumbs = () => paletteFaces("outline.crumb.aside")
