import { singleConsumerFaces } from "@olai/plugin-api"
import type {} from "olai-plugin-outlines/slots"

export const { hold: holdRouteFaces, hung: routeFaces } = singleConsumerFaces()

export const { hold: holdPaletteFaces, hung: paletteFaces, only: paletteOnly } = singleConsumerFaces()

export const paletteCrumbs = () => paletteFaces("outline.crumb.aside")
