/** Browser file access. The vault supplies membership independently of any
 * browsing UI or content renderer. */
import {serviceTag} from "@olai/plugin-api/contracts"
import type {Directory} from "./browser/state.ts"
export const fileAccess=serviceTag<Directory>("vault.files")
