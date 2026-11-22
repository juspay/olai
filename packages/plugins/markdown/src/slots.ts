/**
 * THE SEATS ON A MARKDOWN NOTE'S PAGE: above its body, below the list of what
 * points at it, and in its body, a fenced block a plugin draws.
 *
 * Declared by this row's `content` component as children of the page it
 * contributes for markdown files (`./browser.tsx`), so a seat lives exactly as
 * long as the page that draws it. The head and the foot are lists, as
 * `outline.page.head` and `outline.page.foot` are on an outline's page, and
 * each face is handed the note's path.
 *
 * `document.block` is keyed by plugin: a fence whose language is a plugin's
 * name is that plugin's, and its face is mounted into the fence on the note's
 * page (`@olai/markdown-ui`'s `Markdown`, `blocks`), handed the fence's text
 * and the note's path. Only the note's page hands fences over; anywhere else
 * — a plugin's approval page among them — the fence is code.
 *
 * Exported as `slots` from the server door (`./server.ts`), which is what
 * `vault-plugins_inspect` reads to tell an author the seats exist.
 */
import type { JSX } from "solid-js"
import { slotContract, type SlotDefinition } from "@olai/plugin-api/slots"

/** A face about one note, handed its path. */
export type DocumentFace = (props: { readonly file: string }) => JSX.Element

/** A plugin's drawing of a fence in its own language, handed the fence's text
 *  as written and the note's path — `@olai/markdown-ui`'s `BlockFace`, which
 *  is what the note's page hands it to. */
export type DocumentBlockFace = (props: { readonly text: string; readonly file: string }) => JSX.Element

declare module "@olai/plugin-api/slots" {
  interface SlotDefinitions {
    "document.page.head": SlotDefinition<DocumentFace, "nothing">
    "document.page.foot": SlotDefinition<DocumentFace, "nothing">
    "document.block": SlotDefinition<DocumentBlockFace, "plugin">
  }
}

export const slotContracts = {
  "document.page.head": slotContract<DocumentFace>("document.page.head", "nothing",
    "A component handed `{ file }`, the path of a Markdown note, drawn on that note's page above its text."),
  "document.page.foot": slotContract<DocumentFace>("document.page.foot", "nothing",
    "A component handed `{ file }`, the path of a Markdown note, drawn on that note's page under its text and the list of what links to it."),
  "document.block": slotContract<DocumentBlockFace>("document.block", "plugin",
    "A component handed `{ text, file }`: drawn on a Markdown note's page in place of each fenced block whose language is the plugin's own name, with `text` the block's text exactly as written and `file` the note's path. Elsewhere the block is drawn as code."),
} as const
