/** The header's own activation holds the faces it draws. */
import { heldFaces } from "@olai/plugin-api"
import type {} from "olai-plugin-outlines/slots"
export const { hold: holdFaces, only: boxFace, hung: headerFaces } = heldFaces()

/** What another row hangs on a result's ancestor crumbs — chat's agent mark —
 *  handed to `PlaceLine` one crumb at a time. Empty with no such row. */
export const crumbFaces = () => headerFaces("outline.crumb.aside")
