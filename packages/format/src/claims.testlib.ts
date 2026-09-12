/** Test-only composition of the actual rows' inert claims. Production callers must supply a table. */
import { claims } from "./kinds.ts"
import * as olai from "olai-plugin-olai/claim"
import * as markdown from "olai-plugin-markdown/claim"
import * as hypertext from "olai-plugin-hypertext/claim"
import * as csv from "olai-plugin-csv/claim"
import * as image from "olai-plugin-image/claim"
import * as pdf from "olai-plugin-pdf/claim"
export const NO_CLAIMS = claims([])
export const TEST_CLAIMS = claims([olai,markdown,hypertext,csv,image,pdf].map(row => ({ ...row.claim, kind: row.name })))
