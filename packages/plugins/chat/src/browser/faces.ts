import { singleConsumerFaces } from "@olai/plugin-api"
import type {} from "olai-plugin-outlines/slots"

const own = singleConsumerFaces()

export const holdFaces = own.hold

export const faces = (): typeof own => own

export const crumbMarks = () => own.hung("outline.crumb.aside")
