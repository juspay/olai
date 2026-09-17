import type { Carried } from "@olai/plugin-api/carry"
export interface CarriedText extends Carried { readonly kind: "chat.text"; readonly text: string }
export const carriedText = (value: Carried): value is CarriedText => value.kind === "chat.text"
