import { singleConsumerFaces } from "@olai/plugin-api"
import type {} from "olai-plugin-outlines/slots"
export const { hold: holdFaces, only: boxFace, hung: headerFaces } = singleConsumerFaces()

export const crumbFaces = () => headerFaces("outline.crumb.aside")
