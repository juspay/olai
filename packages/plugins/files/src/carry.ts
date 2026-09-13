import type { Carried } from "@olai/plugin-api/carry"
export interface CarriedPath extends Carried { readonly kind: "files.path"; readonly path: string }
export const carriedPath = (value: Carried): value is CarriedPath => value.kind === "files.path"
