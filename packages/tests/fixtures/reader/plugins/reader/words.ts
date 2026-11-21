import { defineSurface } from "@olai/plugin-api"
import { Schema } from "effect"

// What the browser file may ask the server file. Both import this one value:
// the server file answers it, and the browser file calls it.
export const surface = defineSurface({
  procedures: {
    words: {
      add: { input: Schema.Struct({ word: Schema.String }), output: Schema.Struct({}) },
      next: {
        input: Schema.Struct({}),
        output: Schema.NullOr(Schema.Struct({ node: Schema.String, word: Schema.String })),
      },
      grade: {
        input: Schema.Struct({ node: Schema.String, grade: Schema.Literals(["again", "good", "easy"]) }),
        output: Schema.Struct({ due: Schema.String }),
      },
    },
    pages: {
      // A transcribed page's text, as the vault holds it now.
      read: { input: Schema.Struct({ file: Schema.String }), output: Schema.Struct({ text: Schema.String }) },
    },
  },
})

// Who may call each one: the page in your browser, and not your agents.
export const faces = {
  browser: { "words.add": "tool", "words.next": "tool", "words.grade": "tool", "pages.read": "tool" },
} as const
