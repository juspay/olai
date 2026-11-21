import { defineSurface, OpFailure } from "@olai/plugin-api"
import { Schema } from "effect"

// What the browser file may ask the server file. Both import this one value:
// the server file answers it, and the browser file calls it. A call the gate
// refuses fails with the gate's own `OpFailure`, sentence and all.
export const surface = defineSurface({
  procedures: {
    words: {
      add: { input: Schema.Struct({ word: Schema.String }), output: Schema.Struct({}), error: OpFailure },
      next: {
        input: Schema.Struct({}),
        output: Schema.NullOr(Schema.Struct({ node: Schema.String, word: Schema.String })),
        error: OpFailure,
      },
      grade: {
        input: Schema.Struct({ node: Schema.String, grade: Schema.Literals(["again", "good", "easy"]) }),
        output: Schema.Struct({ due: Schema.String }),
        error: OpFailure,
      },
    },
    pages: {
      // A transcribed page's text, as the vault holds it now.
      read: { input: Schema.Struct({ file: Schema.String }), output: Schema.Struct({ text: Schema.String }), error: OpFailure },
    },
  },
})

// Who may call each one: the page in your browser, and not your agents.
export const faces = {
  browser: { "words.add": "tool", "words.next": "tool", "words.grade": "tool", "pages.read": "tool" },
} as const

// The calls that write. The transport hands each of these the caller's own
// writer and session rule, and the server file passes them to the gate.
export const writes = ["surface/words/add", "surface/words/grade"]
