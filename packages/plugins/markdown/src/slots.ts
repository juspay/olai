/**
 * THE TWO SEATS ON A MARKDOWN NOTE'S PAGE: above its body and below the list
 * of what points at it.
 *
 * Declared by this row's `content` component as children of the page it
 * contributes for markdown files (`./browser.tsx`), so a seat lives exactly as
 * long as the page that draws it. Each is a list, as `outline.page.head` and
 * `outline.page.foot` are on an outline's page, and each face is handed the
 * note's path.
 *
 * Exported as `slots` from the server door (`./server.ts`), which is what
 * `vault-plugins_inspect` reads to tell an author the seats exist.
 */
import type { JSX } from "solid-js"
import { slotContract, type SlotDefinition } from "@olai/plugin-api/slots"

/** A face about one note, handed its path. */
export type DocumentFace = (props: { readonly file: string }) => JSX.Element

declare module "@olai/plugin-api/slots" {
  interface SlotDefinitions {
    "document.page.head": SlotDefinition<DocumentFace, "nothing">
    "document.page.foot": SlotDefinition<DocumentFace, "nothing">
  }
}

export const slotContracts = {
  "document.page.head": slotContract<DocumentFace>("document.page.head", "nothing",
    "A component handed `{ file }`, the path of a Markdown note, drawn on that note's page above its text."),
  "document.page.foot": slotContract<DocumentFace>("document.page.foot", "nothing",
    "A component handed `{ file }`, the path of a Markdown note, drawn on that note's page under its text and the list of what links to it."),
} as const
