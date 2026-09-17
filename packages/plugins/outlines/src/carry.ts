import type { Carried } from "@olai/plugin-api/carry"
export interface CarriedNodes extends Carried { readonly kind: "outlines.nodes"; readonly ids: ReadonlyArray<string>; readonly file: string }
export const carriedNodes = (value: Carried): value is CarriedNodes => value.kind === "outlines.nodes"
