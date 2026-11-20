import {serviceTag} from "@olai/plugin-api/contracts"
import type {Directory} from "./browser/state.ts"
export const fileAccess=serviceTag<Directory>("vault.files")
