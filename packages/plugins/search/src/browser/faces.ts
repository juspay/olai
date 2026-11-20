import { heldFaces } from "@olai/plugin-api"
import type {} from "olai-plugin-outlines/slots"
export const { hold: holdFaces, only: boxFace, hung: headerFaces } = heldFaces()

export const crumbFaces = () => headerFaces("outline.crumb.aside")
